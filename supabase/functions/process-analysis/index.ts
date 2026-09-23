import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { AnalysisResultSchema, DISCLAIMER } from '../_shared/analysisSchema.ts';
import { deleteAnalysisVideo } from '../_shared/videoExpiry.ts';
import { quotaForPlan, type PlanType } from '../_shared/quotas.ts';

const GEMINI_MODEL = 'gemini-2.0-flash';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const admin = adminClient();
  let analysisId: string | null = null;

  try {
    // Service-role only
    const auth = req.headers.get('Authorization') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!auth.includes(serviceKey)) {
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

    await admin.from('analyses').update({ status: 'processing', error_message: null }).eq('id', analysisId);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (!analysis.storage_path) throw new Error('Missing storage path');

    const { data: fileBlob, error: dlError } = await admin.storage
      .from('videos')
      .download(analysis.storage_path);
    if (dlError || !fileBlob) throw dlError ?? new Error('Video download failed');

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const base64 = btoa(String.fromCharCode(...chunkBytes(bytes)));

    const profile = analysis.profiles ?? {};
    const prompt = buildPrompt({
      platform: profile.platform ?? analysis.platform_hint,
      niche: profile.niche,
      experience: profile.experience,
      growthGoal: profile.growth_goal,
      durationSeconds: analysis.duration_seconds,
    });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: analysis.mime_type ?? 'video/mp4',
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini error ${geminiRes.status}: ${errText.slice(0, 500)}`);
    }

    const geminiJson = await geminiRes.json();
    const text =
      geminiJson?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      '';

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned non-JSON output');
    }

    const parsed = AnalysisResultSchema.parse(raw);
    parsed.disclaimer = DISCLAIMER;
    // Broaden ranges slightly to avoid fake precision
    parsed.predictions = broadenPredictions(parsed.predictions);

    await admin
      .from('analyses')
      .update({
        status: 'completed',
        result: parsed,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', analysisId);

    // Increment usage for completed analysis
    await incrementUsage(admin, analysis.user_id);

    // Delete raw video after successful analysis
    await deleteAnalysisVideo(admin, analysisId, analysis.storage_path);

    return jsonResponse({ ok: true, analysisId });
  } catch (e) {
    console.error('process-analysis', e);
    if (analysisId) {
      await admin
        .from('analyses')
        .update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'Analysis failed',
        })
        .eq('id', analysisId);
    }
    return jsonResponse({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});

function chunkBytes(bytes: Uint8Array, chunkSize = 0x8000): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode(...chunk);
  }
  return result;
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
