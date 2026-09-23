import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
import { listAnalyses } from '@/features/upload/api';
import { isConfigured } from '@/lib/env';
import { colors, radius, spacing, typography } from '@/theme';
import type { Analysis } from '@/types/database';
import { parseAnalysisResult } from '@/lib/analysisSchema';

export default function HistoryScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ['analyses'],
    queryFn: listAnalyses,
    enabled: isConfigured(),
  });

  return (
    <Screen contentStyle={{ paddingHorizontal: 0 }}>
      <Text style={styles.title}>History</Text>
      {!isConfigured() ? (
        <EmptyState title="Connect Supabase" description="Add env keys to load analysis history." />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No analyses yet"
              description="Upload a short to see results here."
              actionLabel="Analyze"
              onAction={() => router.push('/(tabs)/upload')}
            />
          }
          renderItem={({ item }) => <HistoryRow item={item} onPress={() => router.push(`/analysis/${item.id}`)} />}
          refreshing={query.isFetching}
          onRefresh={() => query.refetch()}
        />
      )}
      {(query.data?.length ?? 0) >= 2 ? (
        <Pressable style={styles.compare} onPress={() => router.push('/analysis/compare')}>
          <Text style={styles.compareText}>Compare two analyses</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function HistoryRow({ item, onPress }: { item: Analysis; onPress: () => void }) {
  let score: number | null = null;
  if (item.result) {
    try {
      score = parseAnalysisResult(item.result).overallScore;
    } catch {
      score = null;
    }
  }
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{new Date(item.created_at).toLocaleString()}</Text>
        <Text style={styles.rowSub}>{item.status.replace('_', ' ')}</Text>
      </View>
      {score != null ? <Text style={styles.score}>{Math.round(score)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption, textTransform: 'capitalize' },
  score: { ...typography.subtitle, color: colors.primary },
  compare: { padding: spacing.lg, alignItems: 'center' },
  compareText: { ...typography.label, color: colors.accent },
});
