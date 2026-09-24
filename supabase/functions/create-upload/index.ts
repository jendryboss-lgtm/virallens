import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/supabase.ts';
import {
  FREE_ANALYSES_LIMIT,
  freeAnalysesRemaining,
  freeAnalysesUsed,
  quotaForPlan,
  type PlanType,
} from '../_shared/quotas.ts';

const ALLOWED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_DURATION = 90;
const MAX_SIZE = 100 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userSb = userClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userSb.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const mimeType = String(body.mimeType ?? '');
    const durationSeconds = Number(body.durationSeconds ?? 0);
    const sizeBytes = Number(body.sizeBytes ?? 0);
    const platformHint = body.platformHint ? String(body.platformHint) : null;

    if (!ALLOWED_MIME.has(mimeType)) {
      return jsonResponse({ error: 'Unsupported MIME type' }, 400);
    }
    if (!(durationSeconds > 0) || durationSeconds > MAX_DURATION) {
      return jsonResponse({ error: `Duration must be 1–${MAX_DURATION}s` }, 400);
    }
    if (!(sizeBytes > 0) || sizeBytes > MAX_SIZE) {
      return jsonResponse({ error: 'File exceeds size limit (100MB)' }, 400);
    }

    const admin = adminClient();

    // Ownership + consent
    const { data: profile } = await admin
      .from('profiles')
      .select('ai_consent, onboarding_completed')
      .eq('id', user.id)
      .single();

    if (!profile?.ai_consent) {
      return jsonResponse({ error: 'AI consent required' }, 403);
    }

    // Server-side entitlement (never trust client)
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.entitlement_active) {
      // Free tier: FREE_ANALYSES_LIMIT analyses per account lifetime, then paywall.
      const used = await countFreeUsage(admin, user.id);
      if (freeAnalysesRemaining(used) <= 0) {
        return jsonResponse(
          {
            error: `You've used your ${FREE_ANALYSES_LIMIT} free analyses. Upgrade to Pro to keep analyzing.`,
            code: 'free_quota_exhausted',
            freeLimit: FREE_ANALYSES_LIMIT,
            freeUsed: used,
          },
          402,
        );
      }
    } else {
      const plan = (sub.plan ?? 'none') as PlanType;
      const quota = quotaForPlan(plan);
      if (quota <= 0) return jsonResponse({ error: 'No quota for plan' }, 402);

      const now = new Date();
      const periodStart = sub.current_period_start
        ? new Date(sub.current_period_start)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end)
        : new Date(now.getFullYear(), now.getMonth() + 1, 1);

      let { data: usage } = await admin
        .from('usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_start', periodStart.toISOString())
        .maybeSingle();

      if (!usage) {
        const { data: created, error } = await admin
          .from('usage')
          .insert({
            user_id: user.id,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            analyses_used: 0,
            plan,
          })
          .select('*')
          .single();
        if (error) throw error;
        usage = created;
      }

      if ((usage?.analyses_used ?? 0) >= quota) {
        return jsonResponse(
          { error: 'Analysis quota exhausted for this period', code: 'plan_quota_exhausted' },
          402,
        );
      }
    }

    const analysisId = crypto.randomUUID();
    const ext = mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/webm' ? 'webm' : 'mp4';
    const path = `${user.id}/${analysisId}.${ext}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from('analyses').insert({
      id: analysisId,
      user_id: user.id,
      status: 'pending_upload',
      storage_path: path,
      mime_type: mimeType,
      duration_seconds: durationSeconds,
      size_bytes: sizeBytes,
      platform_hint: platformHint,
      video_expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const { data: signed, error: signError } = await admin.storage
      .from('videos')
      .createSignedUploadUrl(path);

    if (signError || !signed) throw signError ?? new Error('Failed to create signed upload URL');

    return jsonResponse({
      analysisId,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      path,
      expiresAt,
    });
  } catch (e) {
    console.error('create-upload', e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});

const IN_FLIGHT_STATUSES = ['pending_upload', 'uploaded', 'queued', 'processing'];
const IN_FLIGHT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Lifetime analyses consumed by this user, for free-tier gating. */
async function countFreeUsage(
  admin: ReturnType<typeof adminClient>,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - IN_FLIGHT_WINDOW_MS).toISOString();
  const [completed, inFlight, usageRows] = await Promise.all([
    admin
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    admin
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', IN_FLIGHT_STATUSES)
      .gte('created_at', since),
    admin.from('usage').select('analyses_used').eq('user_id', userId),
  ]);
  if (completed.error) throw completed.error;
  if (inFlight.error) throw inFlight.error;
  if (usageRows.error) throw usageRows.error;
  const usageTotal = (usageRows.data ?? []).reduce(
    (sum: number, r: { analyses_used: number | null }) => sum + (r.analyses_used ?? 0),
    0,
  );
  return freeAnalysesUsed({
    completedCount: completed.count ?? 0,
    usageTotal,
    inFlightCount: inFlight.count ?? 0,
  });
}
