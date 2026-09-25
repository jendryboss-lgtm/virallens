import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore, useBillingStore, useDemoStore } from '@/store';
import { isConfigured } from '@/lib/env';
import { PAYWALL_HREF } from '@/lib/routes';

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
  const webGuest = useDemoStore((s) => s.webGuest);

  useEffect(() => {
    if (!hydrated) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inPaywall = segments[0] === '(paywall)';

    if (webGuest && !session) {
      // Web preview "Explore demo" guest: no gating, all screens browsable.
      if (segments[0] === 'index' || (segments as string[]).length === 0) {
        router.replace('/(tabs)/home');
      }
      return;
    }

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
      if (freeRemaining > 0) {
        // Free tier: let users try their free analyses; paywall is reachable on demand.
        if (inAuth || inOnboarding || segments[0] === 'index') {
          router.replace('/(tabs)/home');
        }
        return;
      }
      // Free analyses used up: paywall first (tabs / sample stay reachable via "Not now").
      if (!inPaywall && segments[0] !== '(tabs)' && segments[0] !== 'analysis') {
        router.replace(PAYWALL_HREF);
      }
      return;
    }

    if (inAuth || inOnboarding || inPaywall || segments[0] === 'index') {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, session, profile, serverEntitled, freeRemaining, segments, router, webGuest]);

  return null;
}
