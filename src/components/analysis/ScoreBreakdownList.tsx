import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ScoreBreakdown } from '@/lib/analysisSchema';
import { SCORE_KEYS, scoreColor } from '@/lib/scoring';
import { ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export function ScoreBreakdownList({ scores }: { scores: ScoreBreakdown }) {
  return (
    <View style={styles.wrap}>
      {SCORE_KEYS.map(({ key, label }) => (
        <View key={key} style={styles.row}>
          <View style={styles.header}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color: scoreColor(scores[key]) }]}>
              {Math.round(scores[key])}
            </Text>
          </View>
          <ProgressBar value={scores[key]} color={scoreColor(scores[key])} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.text },
  value: { ...typography.label },
});
