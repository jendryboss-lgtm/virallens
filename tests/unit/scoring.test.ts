import {
  scoreColor,
  scoreLabel,
  averageScore,
  formatRange,
} from '@/lib/scoring';
import { colors } from '@/theme';
import {
  remainingAnalyses,
  canStartAnalysis,
  quotaForPlan,
  resolvePlanKind,
} from '@/lib/quotas';
import { QUOTAS } from '@/lib/constants';

describe('scoring presentation', () => {
  it('maps score bands to colors', () => {
    expect(scoreColor(90)).toBe(colors.scoreHigh);
    expect(scoreColor(60)).toBe(colors.scoreMid);
    expect(scoreColor(20)).toBe(colors.scoreLow);
  });

  it('labels scores', () => {
    expect(scoreLabel(90)).toBe('Excellent');
    expect(scoreLabel(50)).toBe('Needs work');
  });

  it('averages breakdown', () => {
    expect(
      averageScore({
        hook: 100,
        pacing: 80,
        storytelling: 60,
        visuals: 40,
        audio: 20,
        cta: 0,
      }),
    ).toBe(50);
  });

  it('formats broad ranges without fake precision', () => {
    expect(formatRange(1500, 12000)).toBe('1.5K – 12.0K');
    expect(formatRange(2_000_000, 5_500_000)).toBe('2.0M – 5.5M');
  });
});

describe('quotas', () => {
  it('uses locked monetization limits', () => {
    expect(quotaForPlan('trial')).toBe(QUOTAS.trial);
    expect(quotaForPlan('monthly')).toBe(QUOTAS.monthly);
    expect(quotaForPlan('annual')).toBe(QUOTAS.annual);
    expect(quotaForPlan('none')).toBe(0);
  });

  it('never implies unlimited remaining', () => {
    expect(remainingAnalyses('trial', 1)).toBe(2);
    expect(remainingAnalyses('monthly', 30)).toBe(0);
    expect(canStartAnalysis('annual', 40)).toBe(false);
    expect(canStartAnalysis('none', 0)).toBe(false);
  });

  it('resolves plan from RC-ish signals', () => {
    expect(
      resolvePlanKind({ hasPro: true, isTrialing: true, productId: 'virallens_pro_annual' }),
    ).toBe('trial');
    expect(resolvePlanKind({ hasPro: true, productId: 'virallens_pro_monthly' })).toBe('monthly');
    expect(resolvePlanKind({ hasPro: false })).toBe('none');
  });
});
