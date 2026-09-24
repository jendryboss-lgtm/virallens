import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import {
  isProProductOrEntitlement,
  resolvePlanFromProduct,
  type PlanType,
} from '../_shared/quotas.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'Server error';
}

/**
 * RevenueCat webhook — source of truth for Pro entitlement.
 * Client cannot unlock Pro by flipping local state.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    const auth = req.headers.get('Authorization') ?? '';
    // Fail closed: never process entitlement changes without a configured secret.
    if (!secret) {
      console.error('rc-webhook: REVENUECAT_WEBHOOK_SECRET not configured');
      return jsonResponse({ error: 'Webhook not configured' }, 503);
    }
    if (auth !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }
    // deno-lint-ignore no-explicit-any
    const event: any = payload?.event ?? payload ?? {};
    const appUserId = String(event.app_user_id ?? event.appUserId ?? '');
    const type = String(event.type ?? '');
    const productId = event.product_id ?? event.productId ?? null;
    const entitlementIds: string[] = event.entitlement_ids ?? event.entitlementIds ?? [];
    const periodType = String(event.period_type ?? event.periodType ?? '');
    const expirationAt = event.expiration_at_ms
      ? new Date(Number(event.expiration_at_ms)).toISOString()
      : event.expiration_at ?? null;
    const purchasedAt = event.purchased_at_ms
      ? new Date(Number(event.purchased_at_ms)).toISOString()
      : event.purchased_at ?? null;

    // RC dashboard "Send test" — acknowledge without DB write.
    if (type === 'TEST' || type === 'TEST_EVENT') {
      return jsonResponse({ ok: true, test: true, type });
    }

    if (!appUserId) {
      // e.g. TRANSFER events carry transferred_from/transferred_to instead.
      return jsonResponse({ ok: true, skipped: true, reason: 'missing_app_user_id', type });
    }

    // app_user_id must be our Supabase auth user UUID (Purchases.logIn).
    if (!UUID_RE.test(appUserId)) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'non_uuid_app_user_id',
        type,
      });
    }

    const admin = adminClient();
    const userId = appUserId;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      // Unknown user (RC sandbox / test UUID). Ack so RC does not disable the hook.
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'unknown_user',
        userId,
        type,
      });
    }

    const entitledEvents = new Set([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'PRODUCT_CHANGE',
      'NON_RENEWING_PURCHASE',
      'SUBSCRIPTION_EXTENDED',
      'TEMPORARY_ENTITLEMENT_GRANT',
      'TRANSFER',
    ]);
    const revokeEvents = new Set(['EXPIRATION', 'BILLING_ISSUE']);

    const hasProEntitlement = isProProductOrEntitlement(productId, entitlementIds);

    let entitlementActive = false;
    let status: string = 'inactive';
    let plan: PlanType = 'none';
    const isTrialing = periodType === 'TRIAL' || periodType === 'INTRO';

    if (entitledEvents.has(type) && hasProEntitlement) {
      entitlementActive = true;
      status = isTrialing ? 'trialing' : 'active';
      plan = resolvePlanFromProduct(productId, isTrialing);
    } else if (type === 'CANCELLATION') {
      // Auto-renew off / refund. Still entitled until expiration unless RC dropped the entitlement.
      entitlementActive = hasProEntitlement;
      status = hasProEntitlement ? 'canceled' : 'expired';
      plan = hasProEntitlement ? resolvePlanFromProduct(productId, isTrialing) : 'none';
    } else if (revokeEvents.has(type)) {
      entitlementActive = false;
      status = type === 'BILLING_ISSUE' ? 'past_due' : 'expired';
      plan = 'none';
    } else {
      // Unhandled / informational events (SUBSCRIPTION_PAUSED, INVOICE_ISSUANCE,
      // SUBSCRIBER_ALIAS, non-Pro products, ...) must never revoke entitlement.
      return jsonResponse({ ok: true, skipped: true, reason: 'unhandled_event', type });
    }

    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: userId,
        status,
        plan,
        product_id: productId,
        rc_app_user_id: appUserId,
        entitlement_active: entitlementActive,
        trial_ends_at: isTrialing ? expirationAt : null,
        current_period_start: purchasedAt,
        current_period_end: expirationAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) throw error;

    return jsonResponse({ ok: true, userId, entitlementActive, plan, type });
  } catch (e) {
    console.error('rc-webhook', e);
    return jsonResponse({ error: errMessage(e) }, 500);
  }
});
