import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Screen } from '@/components/ui';
import { nicheOptions, experienceOptions } from '@/features/onboarding/prefs';
import { useAuthStore } from '@/store';
import { upsertProfile } from '@/features/auth/api';
import type { ExperienceLevel, NichePref } from '@/types/database';
import { spacing, typography } from '@/theme';

export default function NicheScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const profile = useAuthStore((s) => s.profile);
  const [niche, setNiche] = useState<NichePref | null>((profile?.niche as NichePref) ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    (profile?.experience as ExperienceLevel) ?? null,
  );
  const [loading, setLoading] = useState(false);

  async function next() {
    if (!niche || !experience || !userId) return;
    setLoading(true);
    try {
      const updated = await upsertProfile(userId, { niche, experience });
      setProfile(updated);
      router.push('/(onboarding)/goals');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.step}>2 of 3</Text>
      <Text style={styles.title}>Your niche & experience</Text>
      <Text style={styles.sub}>Helps Gemini frame recommendations for your audience.</Text>
      <Text style={styles.label}>Niche</Text>
      <View style={styles.chips}>
        {nicheOptions.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={niche === o.value}
            onPress={() => setNiche(o.value)}
          />
        ))}
      </View>
      <Text style={styles.label}>Experience</Text>
      <View style={styles.chips}>
        {experienceOptions.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={experience === o.value}
            onPress={() => setExperience(o.value)}
          />
        ))}
      </View>
      <Button
        title="Continue"
        onPress={next}
        disabled={!niche || !experience}
        loading={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { ...typography.caption, marginBottom: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.sm },
  sub: { ...typography.bodySecondary, marginBottom: spacing.xl },
  label: { ...typography.label, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl },
});
