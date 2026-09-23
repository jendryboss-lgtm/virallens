import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card, DisclaimerBanner, Screen } from '@/components/ui';
import { LEGAL_LAST_UPDATED, PRIVACY_SECTIONS } from '@/content/legal';
import { colors, spacing, typography } from '@/theme';

export default function PrivacyPolicyScreen() {
  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</Text>
      {PRIVACY_SECTIONS.map((section) => (
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
