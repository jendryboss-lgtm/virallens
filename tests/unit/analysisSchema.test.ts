import {
  parseAnalysisResult,
  safeParseAnalysisResult,
  AnalysisResultSchema,
} from '@/lib/analysisSchema';
import { sampleAnalysis } from '../fixtures/sampleAnalysis';
import { DISCLAIMER } from '@/theme';

describe('AnalysisResultSchema', () => {
  it('parses a valid analysis payload', () => {
    const result = parseAnalysisResult(sampleAnalysis);
    expect(result.overallScore).toBe(72);
    expect(result.scores.hook).toBe(80);
    expect(result.improvements).toHaveLength(1);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it('rejects out-of-range scores', () => {
    const bad = {
      ...sampleAnalysis,
      scores: { ...sampleAnalysis.scores, hook: 140 },
    };
    const parsed = safeParseAnalysisResult(bad);
    expect(parsed.success).toBe(false);
  });

  it('rejects missing summary', () => {
    const { summary: _omit, ...rest } = sampleAnalysis;
    const parsed = AnalysisResultSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it('requires prediction ranges', () => {
    const bad = {
      ...sampleAnalysis,
      predictions: {
        ...sampleAnalysis.predictions,
        views: { min: 10 },
      },
    };
    const parsed = safeParseAnalysisResult(bad);
    expect(parsed.success).toBe(false);
  });
});
