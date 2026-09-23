export const QUOTAS = {
  trial: 3,
  monthly: 30,
  annual: 40,
} as const;

export const PRODUCT_IDS = {
  monthly: 'virallens_pro_monthly',
  annual: 'virallens_pro_annual',
} as const;

export type PlanType = 'none' | 'trial' | 'monthly' | 'annual';

export function quotaForPlan(plan: PlanType): number {
  if (plan === 'trial') return QUOTAS.trial;
  if (plan === 'monthly') return QUOTAS.monthly;
  if (plan === 'annual') return QUOTAS.annual;
  return 0;
}

export function resolvePlanFromProduct(
  productId: string | null | undefined,
  isTrialing: boolean,
): PlanType {
  if (isTrialing) return 'trial';
  if (productId === PRODUCT_IDS.annual) return 'annual';
  if (productId === PRODUCT_IDS.monthly) return 'monthly';
  return 'none';
}
