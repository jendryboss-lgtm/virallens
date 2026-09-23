import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import {
  isProProductOrEntitlement,
  resolvePlanFromProduct,
  type PlanType,
} from '../_shared/quotas.ts';

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
    if (secret && auth !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json();
    const event = payload.event ?? payload;
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

    if (!appUserId) return jsonResponse({ error: 'Missing app_user_id' }, 400);

    const admin = adminClient();

    // app_user_id should be our Supabase user UUID (set via Purchases.logIn)
    const userId = appUserId;

    const entitledEvents = new Set([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'PRODUCT_CHANGE',
      'NON_RENEWING_PURCHASE',
      'TEMPORARY_ENTITLEMENT_GRANT',
    ]);
    const revokeEvents = new Set([
      'CANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
      'SUBSCRIBER_ALIAS',
    ]);

    const hasProEntitlement = isProProductOrEntitlement(productId, entitlementIds);

    let entitlementActive = false;
    let status: string = 'inactive';
    let plan: PlanType = 'none';
    let isTrialing = periodType === 'TRIAL' || periodType === 'INTRO';

    if (entitledEvents.has(type) && hasProEntitlement) {
      entitlementActive = true;
      status = isTrialing ? 'trialing' : 'active';
      plan = resolvePlanFromProduct(productId, isTrialing);
    } else if (type === 'CANCELLATION' && hasProEntitlement) {
      // Still entitled until expiration (lifetime has no expiration — keep active)
      entitlementActive = true;
      status = 'canceled';
      plan = resolvePlanFromProduct(productId, isTrialing);
    } else if (revokeEvents.has(type) || type === 'EXPIRATION') {
      entitlementActive = false;
      status = type === 'BILLING_ISSUE' ? 'past_due' : 'expired';
      plan = 'none';
    } else if (hasProEntitlement && type === 'TRANSFER') {
      entitlementActive = true;
      status = 'active';
      plan = resolvePlanFromProduct(productId, isTrialing);
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
    return jsonResponse({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
