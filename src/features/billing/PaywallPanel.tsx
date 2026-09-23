import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import { Button, Card, DisclaimerBanner } from '@/components/ui';
import {
  getOfferings,
  findPackage,
  purchasePackage,
  restorePurchases,
  hasProEntitlement,
  PRODUCT_IDS,
  isRevenueCatConfigured,
} from '@/lib/revenuecat';
import { QUOTAS } from '@/lib/constants';
import { env } from '@/lib/env';
import { colors, spacing, typography } from '@/theme';
import { refreshBillingState } from './sync';
import { useAuthStore } from '@/store';

interface Props {
  onSuccess?: () => void;
}

export function PaywallPanel({ onSuccess }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState<'monthly' | 'annual' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isRevenueCatConfigured()) {
      queueMicrotask(() => {
        if (!cancelled) {
          setError('Purchases are not configured yet. Add RevenueCat API keys.');
        }
      });
      return () => {
        cancelled = true;
      };
    }
    getOfferings()
      .then((o) => {
        if (!cancelled) setOfferings(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load offerings');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthly = findPackage(offerings, PRODUCT_IDS.monthly);
  const annual = findPackage(offerings, PRODUCT_IDS.annual);

  async function buy(pkg: PurchasesPackage | null, kind: 'monthly' | 'annual') {
    if (!pkg) {
      Alert.alert('Unavailable', 'This product is not available in the current offering.');
      return;
    }
    setLoading(kind);
    setError(null);
    try {
      const info = await purchasePackage(pkg);
      if (!hasProEntitlement(info)) {
        throw new Error('Entitlement not active after purchase.');
      }
      if (userId) await refreshBillingState(userId);
      // Still fail-closed until webhook marks server entitlement — inform user
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Purchase failed';
      if (!/cancelled|canceled/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  }

  async function onRestore() {
    setLoading('restore');
    setError(null);
    try {
      await restorePurchases();
      if (userId) await refreshBillingState(userId);
      Alert.alert('Restore complete', 'If you have an active Pro subscription, it will sync shortly.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Unlock ViralLens Pro</Text>
      <Text style={styles.sub}>
        Start a 3-day intro trial. Analyze shorts with directional scores, improvements, and
        revision ideas — never marketed as unlimited.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.planTitle}>Monthly</Text>
        <Text style={styles.price}>
          {monthly?.product.priceString ?? '$9.99'}
          <Text style={styles.per}> / month</Text>
        </Text>
        <Text style={styles.quota}>{QUOTAS.monthly} analyses per billing period</Text>
        <Text style={styles.trial}>3-day intro trial available where offered by the store</Text>
        <Button
          title="Start monthly"
          loading={loading === 'monthly'}
          disabled={!!loading}
          onPress={() => buy(monthly, 'monthly')}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={[styles.card, styles.featured]}>
        <Text style={styles.badge}>Best value</Text>
        <Text style={styles.planTitle}>Annual</Text>
        <Text style={styles.price}>
          {annual?.product.priceString ?? '$39.99'}
          <Text style={styles.per}> / year</Text>
        </Text>
        <Text style={styles.quota}>{QUOTAS.annual} analyses per month</Text>
        <Text style={styles.trial}>Includes 3-day intro trial</Text>
        <Button
          title="Start annual with trial"
          variant="accent"
          loading={loading === 'annual'}
          disabled={!!loading}
          onPress={() => buy(annual, 'annual')}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Text style={styles.trialNote}>
        Trial quota: up to {QUOTAS.trial} completed analyses. Remaining counts are always shown in
        the app.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Restore purchases"
        variant="ghost"
        loading={loading === 'restore'}
        disabled={!!loading}
        onPress={onRestore}
      />


      <Button
        title="Manage subscription"
        variant="ghost"
        onPress={() =>
          Linking.openURL(
            Platform.OS === 'ios'
              ? 'https://apps.apple.com/account/subscriptions'
              : 'https://play.google.com/store/account/subscriptions',
          )
        }
      />

      <View style={styles.legal}>
        <Text style={styles.link} onPress={() => Linking.openURL(env.termsUrl)}>
          Terms
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(env.privacyUrl)}>
          Privacy
        </Text>
      </View>

      <DisclaimerBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  title: { ...typography.title },
  sub: { ...typography.bodySecondary },
  card: { gap: spacing.xs },
  featured: { borderColor: colors.accent },
  badge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planTitle: { ...typography.subtitle },
  price: { ...typography.title, color: colors.primary },
  per: { ...typography.bodySecondary, fontSize: 16 },
  quota: { ...typography.bodySecondary },
  trial: { ...typography.caption, color: colors.accent },
  trialNote: { ...typography.caption },
  error: { ...typography.caption, color: colors.danger },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  link: { ...typography.caption, color: colors.accent, textDecorationLine: 'underline' },
  dot: { ...typography.caption },
});
