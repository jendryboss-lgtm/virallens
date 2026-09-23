import {
  extractJsonFromModelText,
  shouldRetryInvalidJson,
  isGeminiFileActive,
  isGeminiFileFailed,
  isModerationBlocked,
  analysisStageProgress,
  GEMINI_JSON_MAX_RETRIES,
} from '@/lib/geminiHelpers';
import { QUOTAS, PRODUCT_IDS, ENTITLEMENT_ID } from '@/lib/constants';

describe('gemini File API helpers', () => {
  it('parses raw JSON', () => {
    expect(extractJsonFromModelText('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON', () => {
    expect(extractJsonFromModelText('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('parses embedded JSON object', () => {
    expect(extractJsonFromModelText('Here you go: {"score":9} thanks')).toEqual({ score: 9 });
  });

  it('throws on non-JSON', () => {
    expect(() => extractJsonFromModelText('not json')).toThrow(/non-JSON/);
  });

  it('retries invalid JSON up to configured attempts', () => {
    expect(shouldRetryInvalidJson(0)).toBe(true);
    expect(shouldRetryInvalidJson(1)).toBe(true);
    expect(shouldRetryInvalidJson(GEMINI_JSON_MAX_RETRIES)).toBe(false);
  });

  it('recognizes ACTIVE / FAILED file states', () => {
    expect(isGeminiFileActive('ACTIVE')).toBe(true);
    expect(isGeminiFileActive('PROCESSING')).toBe(false);
    expect(isGeminiFileFailed('FAILED')).toBe(true);
  });

  it('detects moderation blocks', () => {
    expect(isModerationBlocked({ promptFeedback: { blockReason: 'SAFETY' } })).toBe(true);
    expect(
      isModerationBlocked({
        candidates: [{ finishReason: 'SAFETY' }],
      }),
    ).toBe(true);
    expect(
      isModerationBlocked({
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }],
      }),
    ).toBe(false);
  });

  it('maps analysis stages to progress', () => {
    expect(analysisStageProgress('queued').percent).toBe(50);
    expect(analysisStageProgress('processing').percent).toBe(75);
    expect(analysisStageProgress('completed').percent).toBe(100);
  });
});

describe('quota / product alignment', () => {
  it('matches locked monetization contract', () => {
    expect(QUOTAS).toEqual({ trial: 3, monthly: 30, annual: 40 });
    expect(PRODUCT_IDS.monthly).toBe('monthly');
    expect(PRODUCT_IDS.yearly).toBe('yearly');
    expect(PRODUCT_IDS.lifetime).toBe('lifetime');
    expect(ENTITLEMENT_ID).toBe('virallens_pro');
  });
});
