export const QUOTAS = {
  trial: 3,
  monthly: 30,
  annual: 40,
} as const;

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
