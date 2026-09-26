import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { AnalysisResultSchema, DISCLAIMER } from '../_shared/analysisSchema.ts';
import { deleteAnalysisVideo } from '../_shared/videoExpiry.ts';
import { quotaForPlan, type PlanType } from '../_shared/quotas.ts';
import {
  uploadGeminiFile,
  waitForGeminiFileActive,
  deleteGeminiFile,
  generateContentWithFile,
  GeminiModerationError,
  GeminiTimeoutError,
} from '../_shared/geminiFiles.ts';

const MAX_JSON_RETRIES = 2;
const OVERALL_TIMEOUT_MS = 240_000;
const FILE_ACTIVE_TIMEOUT_MS = 120_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const admin = adminClient();
  let analysisId: string | null = null;
  let storagePath: string | null = null;
  let geminiFileName: string | null = null;
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const apiKeyHeader = req.headers.get('apikey') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Edge runtime may inject the new sb_secret_* key while callers still send the
    // legacy service_role JWT. Accept either.
    const bearerToken = auth.replace(/^Bearer\s+/i, '').trim();
    let jwtRole: string | null = null;
    if (bearerToken.split('.').length === 3) {
      try {
        const payload = JSON.parse(atob(bearerToken.split('.')[1]!));
        jwtRole = typeof payload.role === 'string' ? payload.role : null;
      } catch {
        jwtRole = null;
      }
    }

    const authorized =
      (!!serviceKey &&
        (auth.includes(serviceKey) ||
          apiKeyHeader === serviceKey ||
          bearerToken === serviceKey)) ||
      jwtRole === 'service_role';

    if (!authorized) {
      console.error('process-analysis auth failed', {
        authLen: auth.length,
        apiKeyLen: apiKeyHeader.length,
        serviceKeyLen: serviceKey.length,
        authHasBearer: auth.startsWith('Bearer '),
        jwtRole,
      });
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const body = await req.json();
    analysisId = String(body.analysisId ?? '');
    if (!analysisId) return jsonResponse({ error: 'analysisId required' }, 400);

    const { data: analysis, error } = await admin
      .from('analyses')
      .select('*, profiles:user_id (platform, niche, experience, growth_goal)')
      .eq('id', analysisId)
      .single();
    if (error || !analysis) return jsonResponse({ error: 'Not found' }, 404);

    // Idempotent: already completed — do not re-charge usage
    if (analysis.status === 'completed' && analysis.result) {
      return jsonResponse({ ok: true, analysisId, idempotent: true });
    }

    // Soft-cancel / terminal states
    if (analysis.status === 'failed' || analysis.status === 'expired') {
      return jsonResponse({ ok: false, analysisId, skipped: analysis.status });
    }

    storagePath = analysis.storage_path;

    // Claim job (idempotent if already processing — continue)
    await admin
      .from('analyses')
      .update({ status: 'processing', error_message: null })
      .eq('id', analysisId)
      .in('status', ['queued', 'uploaded', 'processing']);

    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');
    if (!analysis.storage_path) throw new Error('Missing storage path');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS);

    try {
      const { data: fileBlob, error: dlError } = await admin.storage
        .from('videos')
        .download(analysis.storage_path);
      if (dlError || !fileBlob) throw dlError ?? new Error('Video download failed');

      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const mimeType = analysis.mime_type ?? 'video/mp4';

      const uploaded = await uploadGeminiFile({
        apiKey: geminiKey,
        bytes,
        mimeType,
        displayName: `virallens-${analysisId}`,
        signal: controller.signal,
      });
      geminiFileName = uploaded.name;

      const active = await waitForGeminiFileActive({
        apiKey: geminiKey,
        fileName: uploaded.name,
        timeoutMs: FILE_ACTIVE_TIMEOUT_MS,
        signal: controller.signal,
      });

      const profile = analysis.profiles ?? {};
      const prompt = buildPrompt({
        platform: profile.platform ?? analysis.platform_hint,
        niche: profile.niche,
        experience: profile.experience,
        growthGoal: profile.growth_goal,
        durationSeconds: analysis.duration_seconds,
      });

      let parsed: ReturnType<typeof AnalysisResultSchema.parse> | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
        const gen = await generateContentWithFile({
          apiKey: geminiKey,
          fileUri: active.uri,
          mimeType: active.mimeType || mimeType,
          prompt:
            attempt === 0
              ? prompt
              : `${prompt}\n\nIMPORTANT: Previous reply was invalid JSON. Return ONLY valid JSON matching the schema.`,
          signal: controller.signal,
        });

        if (gen.blocked) {
          throw new GeminiModerationError(
            `Content blocked by model safety filters${gen.blockReason ? `: ${gen.blockReason}` : ''}`,
          );
        }

        try {
          const raw = extractJson(gen.text);
          parsed = AnalysisResultSchema.parse(raw);
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (attempt >= MAX_JSON_RETRIES) break;
        }
      }

      if (!parsed) {
        throw lastError ?? new Error('Gemini returned non-JSON output');
      }

      parsed.disclaimer = DISCLAIMER;
      parsed.predictions = broadenPredictions(parsed.predictions);

      // Idempotent complete: only transition from processing/queued
      const { data: updated, error: upErr } = await admin
        .from('analyses')
        .update({
          status: 'completed',
          result: parsed,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', analysisId)
        .in('status', ['processing', 'queued', 'uploaded'])
        .select('id')
        .maybeSingle();

      if (upErr) throw upErr;

      if (updated) {
        await incrementUsage(admin, analysis.user_id);
      }

      await deleteAnalysisVideo(admin, analysisId, analysis.storage_path);
      storagePath = null;

      return jsonResponse({ ok: true, analysisId });
    } finally {
      clearTimeout(timeout);
      if (geminiFileName && geminiKey) {
        await deleteGeminiFile(geminiKey, geminiFileName);
      }
    }
  } catch (e) {
    console.error('process-analysis', e);
    const message =
      e instanceof GeminiModerationError
        ? e.message
        : e instanceof GeminiTimeoutError || (e instanceof DOMException && e.name === 'AbortError')
          ? 'Analysis timed out'
          : e instanceof Error
            ? e.message
            : 'Analysis failed';

    if (analysisId) {
      // Idempotent fail — do not overwrite completed
      await admin
        .from('analyses')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', analysisId)
        .neq('status', 'completed');

      // Delete raw video after failure per policy
      if (storagePath) {
        await deleteAnalysisVideo(admin, analysisId, storagePath);
      } else {
        const { data: row } = await admin
          .from('analyses')
          .select('storage_path')
          .eq('id', analysisId)
          .maybeSingle();
        if (row?.storage_path) {
          await deleteAnalysisVideo(admin, analysisId, row.storage_path);
        }
      }
    }

    if (geminiFileName && geminiKey) {
      await deleteGeminiFile(geminiKey, geminiFileName);
    }

    const status =
      e instanceof GeminiModerationError ? 422 : e instanceof GeminiTimeoutError ? 504 : 500;
    return jsonResponse({ error: message }, status);
  }
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) return JSON.parse(fence[1].trim());
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Gemini returned non-JSON output');
  }
}

function buildPrompt(ctx: {
  platform?: string | null;
  niche?: string | null;
  experience?: string | null;
  growthGoal?: string | null;
  durationSeconds?: number | null;
}) {
  return `You are ViralLens, an expert short-form video analyst.
Analyze this vertical short and return ONLY JSON matching the schema described.

Creator context:
- Platform: ${ctx.platform ?? 'unknown'}
- Niche: ${ctx.niche ?? 'unknown'}
- Experience: ${ctx.experience ?? 'unknown'}
- Growth goal: ${ctx.growthGoal ?? 'unknown'}
- Duration seconds: ${ctx.durationSeconds ?? 'unknown'}

Schema keys:
overallScore (0-100), confidence (low|medium|high), summary,
detectedPlatform, detectedNiche,
scores: {hook,pacing,storytelling,visuals,audio,cta} each 0-100,
predictions: views/likes/comments/shares as {min,max} BROAD ranges (no fake precision),
retentionCurve: [{second, percentage}],
strengths: string[],
improvements: [{id, category(hook|pacing|storytelling|visuals|audio|cta|other), severity(critical|important|optional), timestampStart, timestampEnd, problem, recommendation}],
revisions: {hooks[], caption, hashtags[], callsToAction[], shotPlan[{startSecond,endSecond,instruction}]},
disclaimer: "Estimates are directional and do not guarantee social-media performance."

Rules:
- Predictions must be wide ranges, never single-point estimates.
- Be constructive and specific with timestamps when possible.
- Always include the disclaimer string exactly.`;
}

function broadenPredictions(p: {
  views: { min: number; max: number };
  likes: { min: number; max: number };
  comments: { min: number; max: number };
  shares: { min: number; max: number };
}) {
  const widen = (r: { min: number; max: number }) => {
    const mid = (r.min + r.max) / 2;
    const span = Math.max(r.max - r.min, mid * 0.5, 10);
    return {
      min: Math.max(0, Math.round(mid - span)),
      max: Math.round(mid + span),
    };
  };
  return {
    views: widen(p.views),
    likes: widen(p.likes),
    comments: widen(p.comments),
    shares: widen(p.shares),
  };
}

async function incrementUsage(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data: sub } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  const plan = (sub?.plan ?? 'none') as PlanType;
  const now = new Date();
  const periodStart = sub?.current_period_start
    ? new Date(sub.current_period_start)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data: usage } = await admin
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle();

  if (!usage) {
    await admin.from('usage').insert({
      user_id: userId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      analyses_used: 1,
      plan,
    });
    return;
  }

  const quota = quotaForPlan(plan);
  if (usage.analyses_used >= quota) {
    console.warn('Usage already at quota when completing analysis', userId);
  }

  await admin
    .from('usage')
    .update({ analyses_used: usage.analyses_used + 1, plan })
    .eq('id', usage.id);
}
