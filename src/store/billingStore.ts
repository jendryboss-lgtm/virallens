import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';
import type { PlanKind } from '@/lib/quotas';

interface BillingState {
  customerInfo: CustomerInfo | null;
  hasPro: boolean;
  plan: PlanKind;
  analysesUsed: number;
  analysesRemaining: number;
  /** Lifetime free analyses left for non-Pro users (FREE_ANALYSES_LIMIT minus used). */
  freeAnalysesRemaining: number;
  /** Server-verified flag from subscriptions table — never unlock from client alone */
  serverEntitled: boolean;
  setCustomerInfo: (info: CustomerInfo | null, derived: Partial<BillingState>) => void;
  setUsage: (used: number, remaining: number) => void;
  setFreeAnalysesRemaining: (remaining: number) => void;
  setServerEntitled: (entitled: boolean, plan: PlanKind) => void;
  reset: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  customerInfo: null,
  hasPro: false,
  plan: 'none',
  analysesUsed: 0,
  analysesRemaining: 0,
  freeAnalysesRemaining: 0,
  serverEntitled: false,
  setCustomerInfo: (info, derived) =>
    set({
      customerInfo: info,
      ...derived,
    }),
  setUsage: (analysesUsed, analysesRemaining) => set({ analysesUsed, analysesRemaining }),
  setFreeAnalysesRemaining: (freeAnalysesRemaining) => set({ freeAnalysesRemaining }),
  setServerEntitled: (serverEntitled, plan) =>
    set({
      serverEntitled,
      plan,
      hasPro: serverEntitled,
    }),
  reset: () =>
    set({
      customerInfo: null,
      hasPro: false,
      plan: 'none',
      analysesUsed: 0,
      analysesRemaining: 0,
      freeAnalysesRemaining: 0,
      serverEntitled: false,
    }),
}));
