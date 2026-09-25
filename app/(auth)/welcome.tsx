import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, DisclaimerBanner } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useDemoStore } from '@/store';

export default function WelcomeScreen() {
  const router = useRouter();
  const enterWebGuest = useDemoStore((s) => s.enterWebGuest);
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.brand}>ViralLens</Text>
        <Text style={styles.tagline}>
          Directional short-form analysis — scores, improvements, and revision ideas powered by
          multimodal AI.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/(auth)/sign-up')} />
        <Button
          title="Sign in"
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-in')}
        />
        {Platform.OS === 'web' ? (
          <>
            <Button
              title="Explore demo (web preview)"
              variant="ghost"
              onPress={() => {
                enterWebGuest();
                router.replace('/(tabs)/home');
              }}
            />
            <Text style={styles.demoNote}>
              Web preview: browse screens without an account. Uploads and purchases need the
              iPhone app.
            </Text>
          </>
        ) : null}
      </View>
      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  hero: { marginTop: spacing.xxxl, gap: spacing.lg },
  brand: { ...typography.hero, color: colors.primary },
  tagline: { ...typography.bodySecondary },
  actions: { gap: spacing.md, marginVertical: spacing.xl },
  demoNote: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
