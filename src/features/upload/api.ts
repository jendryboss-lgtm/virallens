import * as FileSystem from 'expo-file-system/legacy';
import { getSupabaseUntyped, invokeFunction } from '@/lib/supabase';
import { VIDEO_LIMITS } from '@/lib/constants';
import type { Analysis } from '@/types/database';

export interface CreateUploadResponse {
  analysisId: string;
  uploadUrl: string;
  token: string;
  path: string;
  expiresAt: string;
}

export interface PickedVideo {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
}

export function validateLocalVideo(video: PickedVideo): string | null {
  if (!VIDEO_LIMITS.allowedMimeTypes.includes(video.mimeType as never)) {
    return `Unsupported format (${video.mimeType}). Use MP4 or MOV.`;
  }
  if (video.fileSize > VIDEO_LIMITS.maxSizeBytes) {
    return `File too large. Max ${VIDEO_LIMITS.maxSizeBytes / (1024 * 1024)} MB.`;
  }
  if (video.durationSeconds > VIDEO_LIMITS.maxDurationSeconds) {
    return `Video too long. Max ${VIDEO_LIMITS.maxDurationSeconds}s.`;
  }
  if (video.durationSeconds <= 0) {
    return 'Could not read video duration.';
  }
  return null;
}

export async function createUploadSession(input: {
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  platformHint?: string;
}): Promise<CreateUploadResponse> {
  return invokeFunction<CreateUploadResponse>('create-upload', input);
}

export async function uploadVideoToSignedUrl(
  localUri: string,
  uploadUrl: string,
  mimeType: string,
): Promise<void> {
  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': mimeType,
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with status ${result.status}`);
  }
}

export async function enqueueAnalysis(analysisId: string): Promise<void> {
  await invokeFunction('enqueue-analysis', { analysisId });
}

export async function fetchAnalysis(id: string): Promise<Analysis | null> {
  const { data, error } = await getSupabaseUntyped()
    .from('analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAnalyses(): Promise<Analysis[]> {
  const { data, error } = await getSupabaseUntyped()
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await getSupabaseUntyped().from('analyses').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeAnalysis(
  analysisId: string,
  onChange: (row: Analysis) => void,
) {
  const channel = getSupabaseUntyped()
    .channel(`analysis:${analysisId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'analyses',
        filter: `id=eq.${analysisId}`,
      },
      (payload) => {
        onChange(payload.new as Analysis);
      },
    )
    .subscribe();

  return () => {
    getSupabaseUntyped().removeChannel(channel);
  };
}
