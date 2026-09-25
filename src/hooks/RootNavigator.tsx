import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore, useBillingStore } from '@/store';
import { isConfigured } from '@/lib/env';

/**
 * Gate routing: splash → auth → onboarding → tabs (Pro, or free analyses left) / paywall (free analyses used up)
 */
export function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const serverEntitled = useBillingStore((s) => s.serverEntitled);
  const freeRemaining = useBillingStore((s) => s.freeAnalysesRemaining);

  useEffect(() => {
    if (!hydrated) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inPaywall = segments[0] === '(paywall)';

    if (!isConfigured()) {
      // Allow browsing UI without backend for local review of screens
      return;
    }

    // Public while signed out: client-only sample results, help/legal, and a paywall preview.
    const isPublicPreview =
      inPaywall ||
      (segments[0] === 'analysis' && (segments as string[])[1] === 'demo') ||
      segments[0] === 'help' ||
      segments[0] === 'legal';

    if (!session) {
      if (!inAuth && !isPublicPreview) router.replace('/(auth)/welcome');
      return;
    }

    if (!profile?.onboarding_completed) {
      if (!inOnboarding) router.replace('/(onboarding)/platform');
      return;
    }

    if (!serverEntitled) {
      if (freeRemaining > 0) {
        // Free tier: let users try their free analyses; paywall is reachable on demand.
        if (inAuth || inOnboarding || segments[0] === 'index') {
          router.replace('/(tabs)/home');
        }
        return;
      }
      // Free analyses used up: paywall first (tabs / sample stay reachable via "Not now").
      if (!inPaywall && segments[0] !== '(tabs)' && segments[0] !== 'analysis') {
        router.replace('/(paywall)/index');
      }
      return;
    }

    if (inAuth || inOnboarding || inPaywall || segments[0] === 'index') {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, session, profile, serverEntitled, freeRemaining, segments, router]);

  return null;
}
