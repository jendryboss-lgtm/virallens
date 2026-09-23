import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, EmptyState, DisclaimerBanner } from '@/components/ui';
import { listAnalyses } from '@/features/upload/api';
import { parseAnalysisResult } from '@/lib/analysisSchema';
import { SCORE_KEYS, scoreColor } from '@/lib/scoring';
import { isConfigured } from '@/lib/env';
import { colors, radius, spacing, typography } from '@/theme';

export default function CompareScreen() {
  const query = useQuery({
    queryKey: ['analyses'],
    queryFn: listAnalyses,
    enabled: isConfigured(),
  });

  const completed = useMemo(
    () => (query.data ?? []).filter((a) => a.status === 'completed' && a.result),
    [query.data],
  );

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const left = completed.find((a) => a.id === leftId);
  const right = completed.find((a) => a.id === rightId);

  let leftResult = null;
  let rightResult = null;
  try {
    if (left?.result) leftResult = parseAnalysisResult(left.result);
    if (right?.result) rightResult = parseAnalysisResult(right.result);
  } catch {
    /* ignore */
  }

  if (completed.length < 2) {
    return (
      <Screen>
        <EmptyState
          title="Need two completed analyses"
          description="Run at least two analyses to compare scores side by side."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Compare</Text>
      <Text style={styles.sub}>Pick two completed analyses.</Text>

      <Text style={styles.label}>Analysis A</Text>
      <View style={styles.chips}>
        {completed.map((a) => (
          <Pressable
            key={`l-${a.id}`}
            onPress={() => setLeftId(a.id)}
            style={[styles.chip, leftId === a.id && styles.chipActive]}
          >
            <Text style={styles.chipText}>{new Date(a.created_at).toLocaleDateString()}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Analysis B</Text>
      <View style={styles.chips}>
        {completed.map((a) => (
          <Pressable
            key={`r-${a.id}`}
            onPress={() => setRightId(a.id)}
            style={[styles.chip, rightId === a.id && styles.chipActive]}
          >
            <Text style={styles.chipText}>{new Date(a.created_at).toLocaleDateString()}</Text>
          </Pressable>
        ))}
      </View>

      {leftResult && rightResult ? (
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Overall</Text>
            <Text style={[styles.cell, { color: scoreColor(leftResult.overallScore) }]}>
              {Math.round(leftResult.overallScore)}
            </Text>
            <Text style={[styles.cell, { color: scoreColor(rightResult.overallScore) }]}>
              {Math.round(rightResult.overallScore)}
            </Text>
          </View>
          {SCORE_KEYS.map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.cellLabel}>{label}</Text>
              <Text style={styles.cell}>{Math.round(leftResult!.scores[key])}</Text>
              <Text style={styles.cell}>{Math.round(rightResult!.scores[key])}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sub}>Select both sides to compare.</Text>
      )}

      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title },
  sub: { ...typography.bodySecondary, marginBottom: spacing.lg },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.text },
  table: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  cellLabel: { ...typography.label, flex: 1.2, padding: spacing.md, color: colors.text },
  cell: { ...typography.body, flex: 1, padding: spacing.md, textAlign: 'center', fontWeight: '700' },
});
