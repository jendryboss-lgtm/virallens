import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  presentRevenueCatPaywall,
  presentCustomerCenter,
  isUserCancelledError,
  purchasesErrorMessage,
} from '@/lib/revenuecat';
import { FREE_ANALYSES_LIMIT, QUOTAS } from '@/lib/constants';
import { colors, spacing, typography } from '@/theme';
import { refreshBillingState } from './sync';
import { useAuthStore } from '@/store';

interface Props {
  onSuccess?: () => void;
}

const IS_WEB = Platform.OS === 'web';
const WEB_NOTICE = 'Purchases only work in the iPhone app.';

type LoadKind = 'paywall' | 'monthly' | 'yearly' | 'lifetime' | 'restore' | 'manage' | null;

export function PaywallPanel({ onSuccess }: Props) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState<LoadKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [uiPaywallFailed, setUiPaywallFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (IS_WEB) {
      return () => {
        cancelled = true;
      };
    }
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
  const yearly = findPackage(offerings, PRODUCT_IDS.yearly);
  const lifetime = findPackage(offerings, PRODUCT_IDS.lifetime);

  async function afterPurchaseSuccess() {
    if (userId) await refreshBillingState(userId);
    onSuccess?.();
  }

  async function openDashboardPaywall() {
    setLoading('paywall');
    setError(null);
    try {
      const outcome = await presentRevenueCatPaywall();
      if (outcome.kind === 'purchased' || outcome.kind === 'restored') {
        if (outcome.customerInfo && !hasProEntitlement(outcome.customerInfo)) {
          // Webhook is source of truth — still treat as success for UX refresh
          console.info('[Paywall] RC result without local entitlement yet — waiting for webhook.');
        }
        await afterPurchaseSuccess();
        return;
      }
      if (outcome.kind === 'cancelled' || outcome.kind === 'not_presented') {
        return;
      }
      // UI package / paywall unavailable — keep custom cards as fallback
      setUiPaywallFailed(true);
      setError(
        outcome.kind === 'error' || outcome.kind === 'unavailable'
          ? outcome.message
          : 'Failed to present paywall',
      );
    } catch (e: unknown) {
      if (!isUserCancelledError(e)) {
        setUiPaywallFailed(true);
        setError(purchasesErrorMessage(e, 'Failed to open paywall'));
      }
    } finally {
      setLoading(null);
    }
  }

  async function buy(pkg: PurchasesPackage | null, kind: 'monthly' | 'yearly' | 'lifetime') {
    if (IS_WEB) {
      setError(WEB_NOTICE);
      return;
    }
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
      await afterPurchaseSuccess();
    } catch (e: unknown) {
      if (!isUserCancelledError(e)) {
        setError(purchasesErrorMessage(e, 'Purchase failed'));
      }
    } finally {
      setLoading(null);
    }
  }

  async function onRestore() {
    if (IS_WEB) {
      setError(WEB_NOTICE);
      return;
    }
    setLoading('restore');
    setError(null);
    try {
      await restorePurchases();
      if (userId) await refreshBillingState(userId);
      Alert.alert('Restore complete', 'If you have an active Pro subscription, it will sync shortly.');
    } catch (e: unknown) {
      setError(purchasesErrorMessage(e, 'Restore failed'));
    } finally {
      setLoading(null);
    }
  }

  async function onManage() {
    if (IS_WEB) {
      setError(WEB_NOTICE);
      return;
    }
    setLoading('manage');
    try {
      await presentCustomerCenter();
    } catch (e: unknown) {
      setError(purchasesErrorMessage(e, 'Could not open subscription management'));
    } finally {
      setLoading(null);
    }
  }

  const showFallbackCards = uiPaywallFailed || !isRevenueCatConfigured();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Unlock ViralLens Pro</Text>
      <Text style={styles.sub}>
        Start a 3-day intro trial where offered. Analyze shorts with directional scores,
        improvements, and revision ideas — never marketed as unlimited.
      </Text>

      {IS_WEB ? (
        <Card style={styles.webNotice}>
          <Text style={styles.webNoticeText}>
            Web preview — {WEB_NOTICE} Plans are shown for reference only.
          </Text>
        </Card>
      ) : null}

      {isRevenueCatConfigured() ? (
        <Button
          title="View plans"
          variant="accent"
          loading={loading === 'paywall'}
          disabled={!!loading}
          onPress={openDashboardPaywall}
        />
      ) : null}

      {showFallbackCards ? (
        <>
          <Text style={styles.fallbackNote}>
            {uiPaywallFailed
              ? 'Dashboard paywall unavailable — choose a plan below.'
              : 'Choose a plan:'}
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
            <Text style={styles.planTitle}>Yearly</Text>
            <Text style={styles.price}>
              {yearly?.product.priceString ?? '$39.99'}
              <Text style={styles.per}> / year</Text>
            </Text>
            <Text style={styles.quota}>{QUOTAS.annual} analyses per month</Text>
            <Text style={styles.trial}>Includes 3-day intro trial where offered</Text>
            <Button
              title="Start yearly with trial"
              variant="accent"
              loading={loading === 'yearly'}
              disabled={!!loading}
              onPress={() => buy(yearly, 'yearly')}
              style={{ marginTop: spacing.md }}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.planTitle}>Lifetime</Text>
            <Text style={styles.price}>{lifetime?.product.priceString ?? 'One-time'}</Text>
            <Text style={styles.quota}>
              {QUOTAS.annual} analyses per month (lifetime access)
            </Text>
            <Button
              title="Buy lifetime"
              loading={loading === 'lifetime'}
              disabled={!!loading}
              onPress={() => buy(lifetime, 'lifetime')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </>
      ) : (
        <Text style={styles.fallbackHint}>
          Or use Restore / Manage below. Custom plan cards appear if the RevenueCat paywall
          cannot open.
        </Text>
      )}

      <Text style={styles.trialNote}>
        Free: {FREE_ANALYSES_LIMIT} analyses to try ViralLens. Trial quota: up to {QUOTAS.trial}{' '}
        completed analyses. Remaining counts are always shown in the app.
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
        loading={loading === 'manage'}
        disabled={!!loading}
        onPress={onManage}
      />

      <View style={styles.legal}>
        <Text style={styles.link} onPress={() => router.push('/legal/terms')}>
          Terms
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => router.push('/legal/privacy')}>
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
  fallbackNote: { ...typography.subtitle },
  fallbackHint: { ...typography.caption, color: colors.textMuted },
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
  webNotice: { borderColor: colors.accent },
  webNoticeText: { ...typography.caption, color: colors.accent },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  link: { ...typography.caption, color: colors.accent, textDecorationLine: 'underline' },
  dot: { ...typography.caption },
});
