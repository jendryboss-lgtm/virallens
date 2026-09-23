import React from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { PaywallPanel } from '@/features/billing/PaywallPanel';
import { useBillingStore } from '@/store';

export default function PaywallScreen() {
  const router = useRouter();
  const serverEntitled = useBillingStore((s) => s.serverEntitled);

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
    </Screen>
  );
}
