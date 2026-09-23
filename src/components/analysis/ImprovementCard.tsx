import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Improvement } from '@/lib/analysisSchema';
import { Card } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

const severityColor = {
  critical: colors.danger,
  important: colors.warning,
  optional: colors.accent,
} as const;

export function ImprovementCard({ item }: { item: Improvement }) {
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: severityColor[item.severity] }]}>
          <Text style={styles.badgeText}>{item.severity}</Text>
        </View>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      {item.timestampStart != null ? (
        <Text style={styles.time}>
          {formatTs(item.timestampStart)}
          {item.timestampEnd != null ? ` – ${formatTs(item.timestampEnd)}` : ''}
        </Text>
      ) : null}
      <Text style={styles.problem}>{item.problem}</Text>
      <Text style={styles.rec}>{item.recommendation}</Text>
    </Card>
  );
}

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { ...typography.caption, color: colors.bg, fontWeight: '700', textTransform: 'uppercase' },
  category: { ...typography.label, color: colors.accent, textTransform: 'capitalize' },
  time: { ...typography.caption, color: colors.textMuted },
  problem: { ...typography.body, fontWeight: '600' },
  rec: { ...typography.bodySecondary },
});
