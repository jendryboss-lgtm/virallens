import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Screen, DisclaimerBanner } from '@/components/ui';
import { growthGoalOptions } from '@/features/onboarding/prefs';
import { useAuthStore } from '@/store';
import { upsertProfile } from '@/features/auth/api';
import type { GrowthGoal } from '@/types/database';
import { spacing, typography } from '@/theme';
import { PAYWALL_HREF } from '@/lib/routes';

export default function GoalsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const profile = useAuthStore((s) => s.profile);
  const [goal, setGoal] = useState<GrowthGoal | null>((profile?.growth_goal as GrowthGoal) ?? null);
  const [consent, setConsent] = useState(Boolean(profile?.ai_consent));
  const [loading, setLoading] = useState(false);

  async function finish() {
    if (!goal || !userId || !consent) return;
    setLoading(true);
    try {
      const updated = await upsertProfile(userId, {
        growth_goal: goal,
        ai_consent: true,
        onboarding_completed: true,
      });
      setProfile(updated);
      router.replace(PAYWALL_HREF);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.step}>3 of 3</Text>
      <Text style={styles.title}>What are you optimizing for?</Text>
      <Text style={styles.sub}>We’ll prioritize feedback toward this growth goal.</Text>
      <View style={styles.chips}>
        {growthGoalOptions.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={goal === o.value}
            onPress={() => setGoal(o.value)}
          />
        ))}
      </View>
      <Chip
        label="I consent to AI analysis of videos I upload"
        selected={consent}
        onPress={() => setConsent((c) => !c)}
      />
      <View style={{ height: spacing.lg }} />
      <DisclaimerBanner />
      <View style={{ height: spacing.lg }} />
      <Button
        title="Finish setup"
        onPress={finish}
        disabled={!goal || !consent}
        loading={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { ...typography.caption, marginBottom: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.sm },
  sub: { ...typography.bodySecondary, marginBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl },
});
