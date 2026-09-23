import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card, DisclaimerBanner, Screen } from '@/components/ui';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS } from '@/content/legal';
import { colors, spacing, typography } from '@/theme';

export default function TermsOfUseScreen() {
  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Terms of Use',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</Text>
      {TERMS_SECTIONS.map((section) => (
        <View key={section.heading} style={styles.block}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Card style={styles.card}>
            <Text style={styles.body}>{section.body}</Text>
          </Card>
        </View>
      ))}
      <View style={{ height: spacing.lg }} />
      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  block: { marginBottom: spacing.md },
  heading: { ...typography.subtitle, marginBottom: spacing.sm },
  card: { gap: spacing.sm },
  body: { ...typography.bodySecondary },
});
