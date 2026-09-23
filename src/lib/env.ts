import { z } from 'zod';

const EnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: z.string().optional(),
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: z.string().optional(),
  EXPO_PUBLIC_PRIVACY_URL: z.string().url().optional(),
  EXPO_PUBLIC_TERMS_URL: z.string().url().optional(),
});

const parsed = EnvSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
});

export const env = {
  supabaseUrl: parsed.success ? parsed.data.EXPO_PUBLIC_SUPABASE_URL ?? '' : '',
  supabaseAnonKey: parsed.success ? parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' : '',
  revenueCatIosKey: parsed.success ? parsed.data.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '' : '',
  revenueCatAndroidKey: parsed.success ? parsed.data.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '' : '',
  privacyUrl: parsed.success
    ? parsed.data.EXPO_PUBLIC_PRIVACY_URL ?? 'https://virallens.app/privacy'
    : 'https://virallens.app/privacy',
  termsUrl: parsed.success
    ? parsed.data.EXPO_PUBLIC_TERMS_URL ?? 'https://virallens.app/terms'
    : 'https://virallens.app/terms',
};

export function isConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
