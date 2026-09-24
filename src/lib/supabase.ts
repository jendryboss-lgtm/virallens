import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isConfigured } from './env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!isConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Escape hatch when generated Database generics are too strict for a call site */
export function getSupabaseUntyped(): SupabaseClient {
  return getSupabase() as unknown as SupabaseClient;
}

/** Edge function error with HTTP status + optional machine-readable code from the body. */
export class EdgeFunctionError extends Error {
  status: number | null;
  code: string | null;
  constructor(message: string, status: number | null, code: string | null) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.status = status;
    this.code = code;
  }
}

export function isPaymentRequiredError(e: unknown): boolean {
  return e instanceof EdgeFunctionError && e.status === 402;
}

export async function invokeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      let message = error.message;
      let code: string | null = null;
      try {
        const json = (await ctx.clone().json()) as { error?: string; code?: string };
        if (json?.error) message = json.error;
        if (json?.code) code = json.code;
      } catch {
        /* non-JSON body */
      }
      throw new EdgeFunctionError(message, ctx.status, code);
    }
    throw error;
  }
  return data as T;
}
