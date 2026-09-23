/**
 * Pure helpers mirroring Edge Function File API / response handling.
 * Kept in the app package so Jest can cover retry / JSON / moderation rules.
 */

export const GEMINI_JSON_MAX_RETRIES = 2;
export const GEMINI_FILE_ACTIVE_TIMEOUT_MS = 120_000;
export const GEMINI_OVERALL_TIMEOUT_MS = 240_000;

export function shouldRetryInvalidJson(attempt: number, maxRetries = GEMINI_JSON_MAX_RETRIES): boolean {
  return attempt < maxRetries;
}

/** Extract JSON object from model text (raw, fenced, or embedded). */
export function extractJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Gemini returned non-JSON output');
  }
}

export function isGeminiFileActive(state: string): boolean {
  return state === 'ACTIVE';
}

export function isGeminiFileFailed(state: string): boolean {
  return state === 'FAILED';
}

export function isModerationBlocked(response: {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
    safetyRatings?: { probability?: string }[];
  }[];
}): boolean {
  if (response.promptFeedback?.blockReason) return true;
  const candidate = response.candidates?.[0];
  if (!candidate) return false;
  if (candidate.finishReason === 'SAFETY') return true;
  const hasParts = Boolean(candidate.content?.parts?.length);
  if (hasParts) return false;
  return Boolean(
    candidate.safetyRatings?.some(
      (r) => r.probability === 'HIGH' || r.probability === 'MEDIUM',
    ),
  );
}

/** Analysis-stage progress for UI (0–100). */
export function analysisStageProgress(
  status: string,
): { label: string; percent: number } {
  switch (status) {
    case 'pending_upload':
      return { label: 'Preparing upload', percent: 10 };
    case 'uploaded':
      return { label: 'Upload complete', percent: 35 };
    case 'queued':
      return { label: 'Queued for analysis', percent: 50 };
    case 'processing':
      return { label: 'Running multimodal analysis', percent: 75 };
    case 'completed':
      return { label: 'Analysis ready', percent: 100 };
    case 'failed':
      return { label: 'Analysis failed', percent: 100 };
    case 'expired':
      return { label: 'Expired', percent: 100 };
    default:
      return { label: status, percent: 20 };
  }
}
