import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Screen, TextField } from '@/components/ui';
import { useAuthStore, useBillingStore } from '@/store';
import { signOut } from '@/features/auth/api';
import { updatePreferences, deleteAccountAndData } from '@/features/settings/api';
import { restorePurchases, hasProEntitlement } from '@/lib/revenuecat';
import { refreshBillingState, planLabel } from '@/features/billing/sync';
import {
  platformOptions,
  nicheOptions,
  experienceOptions,
  growthGoalOptions,
} from '@/features/onboarding/prefs';
import { env } from '@/lib/env';
import { colors, spacing, typography } from '@/theme';
import type { ExperienceLevel, GrowthGoal, NichePref, PlatformPref } from '@/types/database';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetBilling = useBillingStore((s) => s.reset);
  const { plan, analysesRemaining, serverEntitled } = useBillingStore();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [platform, setPlatform] = useState<PlatformPref | null>(profile?.platform ?? null);
  const [niche, setNiche] = useState<NichePref | null>(profile?.niche ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(profile?.experience ?? null);
  const [goal, setGoal] = useState<GrowthGoal | null>(profile?.growth_goal ?? null);
  const [saving, setSaving] = useState(false);

  async function savePrefs() {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updatePreferences(user.id, {
        display_name: displayName || null,
        platform,
        niche,
        experience,
        growth_goal: goal,
      });
      setProfile(updated);
      Alert.alert('Saved', 'Preferences updated.');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onRestore() {
    try {
      const info = await restorePurchases();
      if (user) await refreshBillingState(user.id);
      Alert.alert(
        'Restore complete',
        hasProEntitlement(info)
          ? 'Active purchase found. Server entitlement syncs via webhook.'
          : 'No active Pro entitlement found.',
      );
    } catch (e: unknown) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function onSignOut() {
    await signOut();
    resetAuth();
    resetBilling();
    router.replace('/(auth)/welcome');
  }

  function onDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, analyses, and uploaded videos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountAndData();
              resetAuth();
              resetBilling();
              router.replace('/(auth)/welcome');
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
            }
          },
        },
      ],
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Subscription</Text>
      <Text style={styles.body}>
        {planLabel(plan)} · {serverEntitled ? `${analysesRemaining} analyses left` : 'Not entitled'}
      </Text>
      <Button title="Manage / Upgrade" variant="secondary" onPress={() => router.push('/(paywall)/index')} />
      <Button title="Restore purchases" variant="ghost" onPress={onRestore} />

      <Text style={styles.section}>Profile</Text>
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />

      <Text style={styles.label}>Platform</Text>
      <View style={styles.chips}>
        {platformOptions.map((o) => (
          <Chip key={o.value} label={o.label} selected={platform === o.value} onPress={() => setPlatform(o.value)} />
        ))}
      </View>
      <Text style={styles.label}>Niche</Text>
      <View style={styles.chips}>
        {nicheOptions.map((o) => (
          <Chip key={o.value} label={o.label} selected={niche === o.value} onPress={() => setNiche(o.value)} />
        ))}
      </View>
      <Text style={styles.label}>Experience</Text>
      <View style={styles.chips}>
        {experienceOptions.map((o) => (
          <Chip key={o.value} label={o.label} selected={experience === o.value} onPress={() => setExperience(o.value)} />
        ))}
      </View>
      <Text style={styles.label}>Growth goal</Text>
      <View style={styles.chips}>
        {growthGoalOptions.map((o) => (
          <Chip key={o.value} label={o.label} selected={goal === o.value} onPress={() => setGoal(o.value)} />
        ))}
      </View>
      <Button title="Save preferences" loading={saving} onPress={savePrefs} />

      <Text style={styles.section}>Legal & privacy</Text>
      <Button title="Privacy policy" variant="ghost" onPress={() => Linking.openURL(env.privacyUrl)} />
      <Button title="Terms of use" variant="ghost" onPress={() => Linking.openURL(env.termsUrl)} />
      <Text style={styles.consent}>
        AI consent: {profile?.ai_consent ? 'Granted' : 'Not granted'} — required to analyze uploads.
      </Text>

      <Text style={styles.section}>Account</Text>
      <Button title="Sign out" variant="secondary" onPress={onSignOut} />
      <Button title="Delete account & data" variant="danger" onPress={onDeleteAccount} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.xl },
  section: { ...typography.subtitle, marginTop: spacing.xl, marginBottom: spacing.md },
  body: { ...typography.bodySecondary, marginBottom: spacing.md },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  consent: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
