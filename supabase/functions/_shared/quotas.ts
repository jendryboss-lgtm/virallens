export const QUOTAS = {
  trial: 3,
  monthly: 30,
  annual: 40,
} as const;

/**
 * Free tier: non-Pro users get this many analyses per account lifetime, then the paywall.
 * Keep in sync with src/lib/constants.ts FREE_ANALYSES_LIMIT.
 */
export const FREE_ANALYSES_LIMIT = 3;

export const PRODUCT_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
  lifetime: 'lifetime',
} as const;

export const ENTITLEMENT_ID = 'virallens_pro';

export type PlanType = 'none' | 'trial' | 'monthly' | 'annual';

export function quotaForPlan(plan: PlanType): number {
  if (plan === 'trial') return QUOTAS.trial;
  if (plan === 'monthly') return QUOTAS.monthly;
  if (plan === 'annual') return QUOTAS.annual;
  return 0;
}

/**
 * Map RevenueCat product → Supabase plan_type.
 * yearly and lifetime both store as 'annual' (lifetime uses annual quota; no schema migration).
 */
export function resolvePlanFromProduct(
  productId: string | null | undefined,
  isTrialing: boolean,
): PlanType {
  if (isTrialing) return 'trial';
  if (productId === PRODUCT_IDS.yearly) return 'annual';
  if (productId === PRODUCT_IDS.lifetime) return 'annual';
  if (productId === PRODUCT_IDS.monthly) return 'monthly';
  return 'none';
}

export function isProProductOrEntitlement(
  productId: string | null | undefined,
  entitlementIds: string[],
): boolean {
  if (entitlementIds.includes(ENTITLEMENT_ID)) return true;
  if (!productId) return false;
  return (
    productId === PRODUCT_IDS.monthly ||
    productId === PRODUCT_IDS.yearly ||
    productId === PRODUCT_IDS.lifetime
  );
}

/**
 * Lifetime analyses consumed for free-tier gating.
 * - completedCount: analyses rows with status 'completed'
 * - usageTotal: sum of usage.analyses_used across all periods (service-role only, so it
 *   survives users deleting their own analyses rows)
 * - inFlightCount: recent analyses still pending/uploading/processing (prevents parallel bypass)
 */
export function freeAnalysesUsed(opts: {
  completedCount: number;
  usageTotal: number;
  inFlightCount: number;
}): number {
  const done = Math.max(opts.completedCount || 0, opts.usageTotal || 0);
  return done + Math.max(0, opts.inFlightCount || 0);
}

export function freeAnalysesRemaining(used: number): number {
  return Math.max(0, FREE_ANALYSES_LIMIT - used);
}
