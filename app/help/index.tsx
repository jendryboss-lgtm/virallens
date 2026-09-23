import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, DisclaimerBanner, Screen } from '@/components/ui';
import { env } from '@/lib/env';
import { QUOTAS } from '@/lib/constants';
import { colors, spacing, typography } from '@/theme';

const SUPPORT_EMAIL = 'support@virallens.app';

export default function HelpScreen() {
  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Help & support',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Text style={styles.title}>How ViralLens works</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Upload a short (MP4/MOV/WebM, ≤90s, ≤100MB). We run multimodal analysis and return
          directional scores, improvements, and revision ideas.
        </Text>
        <Text style={styles.body}>
          Quotas: trial ≤{QUOTAS.trial} completed analyses · monthly {QUOTAS.monthly}/period · annual{' '}
          {QUOTAS.annual}/month. Remaining counts are always shown in-app.
        </Text>
      </Card>

      <Text style={styles.heading}>Privacy</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Raw videos are stored privately and deleted after analysis (or on failure) and expire within
          24 hours. You can delete individual analyses or wipe your account and all data from Settings.
        </Text>
        <Text style={styles.body}>
          AI consent is required before analysis. You confirm ownership when deleting content.
        </Text>
      </Card>

      <Text style={styles.heading}>Billing</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Subscriptions are managed through the App Store or Google Play. Use Restore purchases if you
          reinstall. Pro unlock requires the RevenueCat webhook to mark server entitlement.
        </Text>
      </Card>

      <View style={{ height: spacing.lg }} />
      <Button
        title="Email support"
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=ViralLens%20support`)}
      />
      <Button title="Privacy policy" variant="ghost" onPress={() => Linking.openURL(env.privacyUrl)} />
      <Button title="Terms of use" variant="ghost" onPress={() => Linking.openURL(env.termsUrl)} />

      <View style={{ height: spacing.xl }} />
      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.lg },
  heading: { ...typography.subtitle, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  body: { ...typography.bodySecondary },
});
