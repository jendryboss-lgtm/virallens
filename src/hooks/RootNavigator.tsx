import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore, useBillingStore } from '@/store';
import { isConfigured } from '@/lib/env';

/**
 * Gate routing: splash → auth → onboarding → paywall (if no server entitlement) → tabs
 */
export function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const serverEntitled = useBillingStore((s) => s.serverEntitled);

  useEffect(() => {
    if (!hydrated) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inPaywall = segments[0] === '(paywall)';

    if (!isConfigured()) {
      // Allow browsing UI without backend for local review of screens
      return;
    }

    if (!session) {
      if (!inAuth) router.replace('/(auth)/welcome');
      return;
    }

    if (!profile?.onboarding_completed) {
      if (!inOnboarding) router.replace('/(onboarding)/platform');
      return;
    }

    if (!serverEntitled) {
      if (!inPaywall && segments[0] !== '(tabs)') {
        // Allow tabs only after entitlement; force paywall otherwise
        if (!inPaywall) router.replace('/(paywall)/index');
      }
      return;
    }

    if (inAuth || inOnboarding || inPaywall || segments[0] === 'index') {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, session, profile, serverEntitled, segments, router]);

  return null;
}
