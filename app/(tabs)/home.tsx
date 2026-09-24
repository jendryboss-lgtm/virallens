import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, DisclaimerBanner, Screen } from '@/components/ui';
import { useAuthStore, useBillingStore } from '@/store';
import { planLabel } from '@/features/billing/sync';
import { FREE_ANALYSES_LIMIT } from '@/lib/constants';
import { colors, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { plan, analysesRemaining, analysesUsed, serverEntitled, freeAnalysesRemaining } =
    useBillingStore();

  return (
    <Screen scroll>
      <Text style={styles.hello}>
        Hey{profile?.display_name ? `, ${profile.display_name}` : ''}
      </Text>
      <Text style={styles.title}>Check a draft before you post</Text>

      <Card style={styles.quota}>
        <Text style={styles.quotaLabel}>Plan</Text>
        <Text style={styles.quotaValue}>{planLabel(plan)}</Text>
        <Text style={styles.quotaLabel}>
          {serverEntitled ? 'Analyses remaining' : 'Free analyses remaining'}
        </Text>
        <Text style={styles.quotaValue}>
          {serverEntitled ? analysesRemaining : freeAnalysesRemaining}
          <Text style={styles.used}>
            {serverEntitled
              ? ` (${analysesUsed} used this period)`
              : ` of ${FREE_ANALYSES_LIMIT} free`}
          </Text>
        </Text>
        {!serverEntitled ? (
          <Button
            title="Unlock Pro"
            onPress={() => router.push('/(paywall)/index')}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </Card>

      <Button
        title="Check a draft before you post"
        onPress={() => router.push('/(tabs)/upload')}
      />
      <Button
        title="View history"
        variant="secondary"
        onPress={() => router.push('/(tabs)/history')}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title="Preview sample results"
        variant="ghost"
        onPress={() => router.push('/analysis/demo')}
        style={{ marginTop: spacing.sm }}
      />

      <View style={{ height: spacing.xl }} />
      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { ...typography.caption, color: colors.accent },
  title: { ...typography.title, marginBottom: spacing.xl },
  quota: { marginBottom: spacing.xl, gap: spacing.xs },
  quotaLabel: { ...typography.label },
  quotaValue: { ...typography.subtitle, marginBottom: spacing.sm },
  used: { ...typography.caption, fontWeight: '400' },
});
