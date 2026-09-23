import { getSupabase, getSupabaseUntyped } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabaseUntyped()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(
  userId: string,
  patch: Partial<Profile>,
): Promise<Profile> {
  const { data, error } = await getSupabaseUntyped()
    .from('profiles')
    .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
