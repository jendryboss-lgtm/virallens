import { FREE_ANALYSES_LIMIT, QUOTAS, PRODUCT_IDS } from './constants';

export type PlanKind = 'none' | 'trial' | 'monthly' | 'annual';

export function resolvePlanKind(opts: {
  hasPro: boolean;
  productId?: string | null;
  isTrialing?: boolean;
}): PlanKind {
  if (!opts.hasPro) return 'none';
  if (opts.isTrialing) return 'trial';
  // Yearly store product maps to annual plan/quota in DB.
  if (opts.productId === PRODUCT_IDS.yearly) return 'annual';
  // Lifetime maps to annual quota without adding a plan_type enum value.
  if (opts.productId === PRODUCT_IDS.lifetime) return 'annual';
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

/**
 * Lifetime analyses consumed for free-tier gating (mirrors create-upload on the server).
 * Uses the larger of completed analyses rows and summed usage rows (usage survives deletes),
 * plus analyses still in flight.
 */
export function freeAnalysesUsed(opts: {
  completedCount: number;
  usageTotal: number;
  inFlightCount?: number;
}): number {
  const done = Math.max(opts.completedCount || 0, opts.usageTotal || 0);
  return done + Math.max(0, opts.inFlightCount || 0);
}

export function freeAnalysesRemaining(used: number): number {
  return Math.max(0, FREE_ANALYSES_LIMIT - used);
}

/**
 * Whether the user may start a new analysis. Pro users use their plan quota for the period;
 * everyone else uses the lifetime free allowance. Server re-checks either way.
 */
export function canAnalyze(opts: {
  serverEntitled: boolean;
  plan: PlanKind;
  analysesUsed: number;
  freeRemaining: number;
}): boolean {
  if (opts.serverEntitled) return canStartAnalysis(opts.plan, opts.analysesUsed);
  return opts.freeRemaining > 0;
}
