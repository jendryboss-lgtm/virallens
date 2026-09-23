import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Screen } from '@/components/ui';
import { platformOptions } from '@/features/onboarding/prefs';
import { useAuthStore } from '@/store';
import { upsertProfile } from '@/features/auth/api';
import type { PlatformPref } from '@/types/database';
import { spacing, typography } from '@/theme';

export default function PlatformScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const profile = useAuthStore((s) => s.profile);
  const [selected, setSelected] = useState<PlatformPref | null>(
    (profile?.platform as PlatformPref) ?? null,
  );
  const [loading, setLoading] = useState(false);

  async function next() {
    if (!selected || !userId) return;
    setLoading(true);
    try {
      const updated = await upsertProfile(userId, { platform: selected });
      setProfile(updated);
      router.push('/(onboarding)/niche');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.step}>1 of 3</Text>
      <Text style={styles.title}>Where do you post?</Text>
      <Text style={styles.sub}>We tune analysis for your primary short-form platform.</Text>
      <View style={styles.chips}>
        {platformOptions.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={selected === o.value}
            onPress={() => setSelected(o.value)}
          />
        ))}
      </View>
      <Button title="Continue" onPress={next} disabled={!selected} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { ...typography.caption, marginBottom: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.sm },
  sub: { ...typography.bodySecondary, marginBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xxl },
});
