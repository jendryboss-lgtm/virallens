import { QUOTAS, PRODUCT_IDS } from './constants';

export type PlanKind = 'none' | 'trial' | 'monthly' | 'annual';

export function resolvePlanKind(opts: {
  hasPro: boolean;
  productId?: string | null;
  isTrialing?: boolean;
}): PlanKind {
  if (!opts.hasPro) return 'none';
  if (opts.isTrialing) return 'trial';
  if (opts.productId === PRODUCT_IDS.annual) return 'annual';
  if (opts.productId === PRODUCT_IDS.monthly) return 'monthly';
  // Fail closed to monthly quota if product unknown but entitled
  return 'monthly';
}

export function quotaForPlan(plan: PlanKind): number {
  switch (plan) {
    case 'trial':
      return QUOTAS.trial;
    case 'monthly':
      return QUOTAS.monthly;
    case 'annual':
      return QUOTAS.annual;
    default:
      return 0;
  }
}

export function remainingAnalyses(plan: PlanKind, used: number): number {
  return Math.max(0, quotaForPlan(plan) - used);
}

export function canStartAnalysis(plan: PlanKind, used: number): boolean {
  return remainingAnalyses(plan, used) > 0;
}
