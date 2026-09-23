import { invokeFunction } from '@/lib/supabase';
import { upsertProfile } from '@/features/auth/api';
import type { Profile } from '@/types/database';

export async function updatePreferences(
  userId: string,
  prefs: Partial<
    Pick<Profile, 'platform' | 'niche' | 'experience' | 'growth_goal' | 'display_name' | 'ai_consent'>
  >,
) {
  return upsertProfile(userId, prefs);
}

export async function deleteAccountAndData(): Promise<void> {
  await invokeFunction('delete-user', {});
}
