import {
  canAnalyze,
  freeAnalysesRemaining,
  freeAnalysesUsed,
} from '@/lib/quotas';
import { FREE_ANALYSES_LIMIT, QUOTAS } from '@/lib/constants';

describe('free tier quota', () => {
  it('allows 3 lifetime free analyses', () => {
    expect(FREE_ANALYSES_LIMIT).toBe(3);
    expect(freeAnalysesRemaining(0)).toBe(3);
    expect(freeAnalysesRemaining(2)).toBe(1);
    expect(freeAnalysesRemaining(3)).toBe(0);
    expect(freeAnalysesRemaining(10)).toBe(0);
  });

  it('counts the larger of completed rows and usage totals, plus in-flight', () => {
    expect(freeAnalysesUsed({ completedCount: 1, usageTotal: 0 })).toBe(1);
    // User deleted analyses rows — usage table still remembers.
    expect(freeAnalysesUsed({ completedCount: 0, usageTotal: 2 })).toBe(2);
    expect(freeAnalysesUsed({ completedCount: 2, usageTotal: 2, inFlightCount: 1 })).toBe(3);
    expect(freeAnalysesUsed({ completedCount: 0, usageTotal: 0, inFlightCount: -1 })).toBe(0);
  });

  it('gates non-Pro users on free allowance and Pro users on plan quota', () => {
    expect(
      canAnalyze({ serverEntitled: false, plan: 'none', analysesUsed: 0, freeRemaining: 3 }),
    ).toBe(true);
    expect(
      canAnalyze({ serverEntitled: false, plan: 'none', analysesUsed: 3, freeRemaining: 0 }),
    ).toBe(false);
    expect(
      canAnalyze({
        serverEntitled: true,
        plan: 'monthly',
        analysesUsed: QUOTAS.monthly - 1,
        freeRemaining: 0,
      }),
    ).toBe(true);
    expect(
      canAnalyze({
        serverEntitled: true,
        plan: 'monthly',
        analysesUsed: QUOTAS.monthly,
        freeRemaining: 3,
      }),
    ).toBe(false);
  });
});
