import { getSupabaseUntyped } from '@/lib/supabase';
import {
  getCustomerInfo,
  hasProEntitlement,
  activeProductId,
  isTrialing,
} from '@/lib/revenuecat';
import {
  resolvePlanKind,
  remainingAnalyses,
  freeAnalysesUsed,
  freeAnalysesRemaining,
  type PlanKind,
} from '@/lib/quotas';
import { useBillingStore } from '@/store';
import type { PlanType, Subscription, Usage } from '@/types/database';

/**
 * Server entitlement is source of truth. Client RC info is used for UX only.
 * Never unlock Pro solely from local CustomerInfo.
 */
export async function refreshBillingState(userId: string): Promise<void> {
  const store = useBillingStore.getState();

  let customerInfo = null;
  try {
    customerInfo = await getCustomerInfo();
  } catch (e) {
    console.warn('[Billing] RC customer info failed', e);
  }

  const { data: sub } = await getSupabaseUntyped()
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const subscription = sub as Subscription | null;
  const serverEntitled = Boolean(subscription?.entitlement_active);
  const planFromServer = (subscription?.plan ?? 'none') as PlanKind;
  const plan: PlanKind = serverEntitled
    ? planFromServer === 'none'
      ? resolvePlanKind({
          hasPro: true,
          productId: subscription?.product_id ?? activeProductId(customerInfo),
          isTrialing: subscription?.status === 'trialing' || isTrialing(customerInfo),
        })
      : planFromServer
    : 'none';

  const now = new Date().toISOString();
  const { data: usageRow } = await getSupabaseUntyped()
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .lte('period_start', now)
    .gte('period_end', now)
    .maybeSingle();

  const usage = usageRow as Usage | null;
  let used = usage?.analyses_used ?? 0;
  let remaining = remainingAnalyses(plan, used);
  let freeRemaining = 0;

  if (!serverEntitled) {
    // Free tier: lifetime allowance, counted the same way as create-upload.
    const freeUsed = await fetchFreeAnalysesUsed(userId);
    freeRemaining = freeAnalysesRemaining(freeUsed);
    used = freeUsed;
    remaining = freeRemaining;
  }

  store.setCustomerInfo(customerInfo, {
    hasPro: serverEntitled,
    plan,
    serverEntitled,
  });
  store.setUsage(used, remaining);
  store.setFreeAnalysesRemaining(freeRemaining);
  store.setServerEntitled(serverEntitled, plan);

  if (hasProEntitlement(customerInfo) && !serverEntitled) {
    console.info('[Billing] RC entitled but server not yet — waiting for webhook.');
  }
}

const IN_FLIGHT_STATUSES = ['pending_upload', 'uploaded', 'queued', 'processing'];

async function fetchFreeAnalysesUsed(userId: string): Promise<number> {
  const sb = getSupabaseUntyped();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [completed, inFlight, usageRows] = await Promise.all([
    sb
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    sb
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', IN_FLIGHT_STATUSES)
      .gte('created_at', since),
    sb.from('usage').select('analyses_used').eq('user_id', userId),
  ]);
  const usageTotal = ((usageRows.data ?? []) as { analyses_used: number | null }[]).reduce(
    (sum, r) => sum + (r.analyses_used ?? 0),
    0,
  );
  return freeAnalysesUsed({
    completedCount: completed.count ?? 0,
    usageTotal,
    inFlightCount: inFlight.count ?? 0,
  });
}

export function planLabel(plan: PlanKind | PlanType): string {
  switch (plan) {
    case 'trial':
      return 'Pro Trial';
    case 'monthly':
      return 'Pro Monthly';
    case 'annual':
      return 'Pro Annual';
    default:
      return 'Free';
  }
}
