import React from 'react';
import { useRouter } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { FREE_ANALYSES_LIMIT } from '@/lib/constants';
import { PaywallPanel } from '@/features/billing/PaywallPanel';
import { useBillingStore } from '@/store';

export default function PaywallScreen() {
  const router = useRouter();
  const serverEntitled = useBillingStore((s) => s.serverEntitled);
  const freeRemaining = useBillingStore((s) => s.freeAnalysesRemaining);

  return (
    <Screen scroll>
      <PaywallPanel
        onSuccess={() => {
          if (serverEntitled) {
            router.replace('/(tabs)/home');
          } else {
            // Purchase succeeded client-side; wait for webhook — still allow home with limited UX
            router.replace('/(tabs)/home');
          }
        }}
      />
      <Button
        title={
          freeRemaining > 0
            ? `Continue free (${freeRemaining} of ${FREE_ANALYSES_LIMIT} left)`
            : 'Not now'
        }
        variant="ghost"
        onPress={() => router.replace('/(tabs)/home')}
      />
    </Screen>
  );
}
