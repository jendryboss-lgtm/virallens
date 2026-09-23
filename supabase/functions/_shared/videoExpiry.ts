import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/** Delete raw video object and mark analysis row. Safe to call repeatedly. */
export async function deleteAnalysisVideo(
  admin: SupabaseClient,
  analysisId: string,
  storagePath: string | null,
) {
  if (storagePath) {
    await admin.storage.from('videos').remove([storagePath]);
  }
  await admin
    .from('analyses')
    .update({
      video_deleted_at: new Date().toISOString(),
      storage_path: null,
    })
    .eq('id', analysisId);
}

/** Sweep: delete videos past expiry or completed + still present. */
export async function sweepExpiredVideos(admin: SupabaseClient) {
  const now = new Date().toISOString();
  const { data } = await admin
    .from('analyses')
    .select('id, storage_path')
    .is('video_deleted_at', null)
    .not('storage_path', 'is', null)
    .or(`video_expires_at.lte.${now},status.eq.completed`);

  for (const row of data ?? []) {
    await deleteAnalysisVideo(admin, row.id, row.storage_path);
  }
}
