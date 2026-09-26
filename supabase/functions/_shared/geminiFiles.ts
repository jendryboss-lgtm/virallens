/**
 * Gemini Files API helpers for large video analysis.
 * Flow: upload → poll ACTIVE → generateContent(fileUri) → delete.
 */

const FILES_BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-flash-latest';

export interface GeminiFileRef {
  name: string;
  uri: string;
  mimeType: string;
  state: string;
}

export class GeminiModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiModerationError';
  }
}

export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

/** Upload bytes via resumable protocol, return file metadata. */
export async function uploadGeminiFile(opts: {
  apiKey: string;
  bytes: Uint8Array;
  mimeType: string;
  displayName: string;
  signal?: AbortSignal;
}): Promise<GeminiFileRef> {
  const { apiKey, bytes, mimeType, displayName, signal } = opts;

  const startRes = await fetch(
    `${FILES_BASE}/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      signal,
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Gemini file upload start failed ${startRes.status}: ${errText.slice(0, 400)}`);
  }

  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL') ?? startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini file upload missing X-Goog-Upload-URL');
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gemini file upload finalize failed ${uploadRes.status}: ${errText.slice(0, 400)}`);
  }

  const json = await uploadRes.json();
  const file = json.file ?? json;
  return {
    name: String(file.name ?? ''),
    uri: String(file.uri ?? file.name ?? ''),
    mimeType: String(file.mimeType ?? mimeType),
    state: String(file.state ?? 'PROCESSING'),
  };
}

/** Poll until ACTIVE or FAILED / timeout. */
export async function waitForGeminiFileActive(opts: {
  apiKey: string;
  fileName: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}): Promise<GeminiFileRef> {
  const {
    apiKey,
    fileName,
    timeoutMs = 120_000,
    pollIntervalMs = 2_000,
    signal,
  } = opts;
  const started = Date.now();
  const name = fileName.startsWith('files/') ? fileName : `files/${fileName}`;

  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) throw new GeminiTimeoutError('Aborted while waiting for Gemini file');

    const res = await fetch(`${FILES_BASE}/v1beta/${name}?key=${apiKey}`, { signal });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini file status failed ${res.status}: ${errText.slice(0, 400)}`);
    }
    const json = await res.json();
    const state = String(json.state ?? '');
    const ref: GeminiFileRef = {
      name: String(json.name ?? name),
      uri: String(json.uri ?? json.name ?? name),
      mimeType: String(json.mimeType ?? 'video/mp4'),
      state,
    };
    if (state === 'ACTIVE') return ref;
    if (state === 'FAILED') {
      throw new Error(`Gemini file processing failed: ${JSON.stringify(json.error ?? json)}`);
    }
    await sleep(pollIntervalMs, signal);
  }
  throw new GeminiTimeoutError(`Gemini file not ACTIVE within ${timeoutMs}ms`);
}

/** Best-effort delete of uploaded Gemini file. */
export async function deleteGeminiFile(apiKey: string, fileName: string): Promise<void> {
  const name = fileName.startsWith('files/') ? fileName : `files/${fileName}`;
  try {
    await fetch(`${FILES_BASE}/v1beta/${name}?key=${apiKey}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('deleteGeminiFile failed', e);
  }
}

export async function generateContentWithFile(opts: {
  apiKey: string;
  fileUri: string;
  mimeType: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
  temperature?: number;
}): Promise<{ text: string; raw: unknown; blocked: boolean; blockReason?: string }> {
  const model = opts.model ?? DEFAULT_MODEL;
  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: opts.prompt },
          {
            file_data: {
              mime_type: opts.mimeType,
              file_uri: opts.fileUri,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      responseMimeType: 'application/json',
    },
  });

  let res: Response | null = null;
  let errText = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(
      `${FILES_BASE}/v1beta/models/${model}:generateContent?key=${opts.apiKey}`,
      {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      },
    );
    if (res.ok) break;
    errText = await res.text();
    const retryable = res.status === 503 || res.status === 429;
    if (!retryable || attempt === 3) {
      throw new Error(`Gemini generateContent error ${res.status}: ${errText.slice(0, 500)}`);
    }
    const delayMs = 2000 * (attempt + 1) * (attempt + 1);
    console.warn(`Gemini ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/4)`);
    await sleep(delayMs, opts.signal);
  }

  const raw = await res!.json();
  const blockReason =
    raw?.promptFeedback?.blockReason ??
    raw?.candidates?.[0]?.finishReason === 'SAFETY'
      ? 'SAFETY'
      : undefined;
  const blocked = Boolean(
    raw?.promptFeedback?.blockReason ||
      raw?.candidates?.[0]?.finishReason === 'SAFETY' ||
      (Array.isArray(raw?.candidates?.[0]?.safetyRatings) &&
        raw.candidates[0].safetyRatings.some(
          (r: { probability?: string }) =>
            r.probability === 'HIGH' || r.probability === 'MEDIUM',
        ) &&
        !raw?.candidates?.[0]?.content?.parts?.length),
  );

  const text =
    raw?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
    '';

  return { text, raw, blocked, blockReason: blockReason ? String(blockReason) : undefined };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GeminiTimeoutError('Aborted'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new GeminiTimeoutError('Aborted'));
      },
      { once: true },
    );
  });
}

export { DEFAULT_MODEL };
