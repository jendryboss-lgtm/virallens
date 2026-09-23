import React, { PropsWithChildren, useEffect } from 'react';
import { AppState } from 'react-native';
import { isConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { configureRevenueCat, identifyUser, logoutRevenueCat } from '@/lib/revenuecat';
import { useAuthStore, useBillingStore } from '@/store';
import { fetchProfile } from './api';
import { refreshBillingState } from '@/features/billing/sync';

export function AuthProvider({ children }: PropsWithChildren) {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetBilling = useBillingStore((s) => s.reset);

  useEffect(() => {
    if (!isConfigured()) {
      setHydrated(true);
      return;
    }

    configureRevenueCat();

    const supabase = getSupabase();

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        try {
          const profile = await fetchProfile(data.session.user.id);
          setProfile(profile);
          await identifyUser(data.session.user.id);
          await refreshBillingState(data.session.user.id);
        } catch (e) {
          console.warn('[Auth] hydrate failed', e);
        }
      }
      setHydrated(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        try {
          const profile = await fetchProfile(session.user.id);
          setProfile(profile);
          await identifyUser(session.user.id);
          await refreshBillingState(session.user.id);
        } catch (e) {
          console.warn('[Auth] auth change failed', e);
        }
      } else {
        resetAuth();
        resetBilling();
        try {
          await logoutRevenueCat();
        } catch {
          /* ignore */
        }
      }
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
    };
  }, [setSession, setProfile, setHydrated, resetAuth, resetBilling]);

  return <>{children}</>;
}
