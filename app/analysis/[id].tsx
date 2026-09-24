import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, ProgressBar } from '@/components/ui';
import { ResultsView } from '@/components/analysis/ResultsView';
import { fetchAnalysis, deleteAnalysis, cancelAnalysis } from '@/features/upload/api';
import { parseAnalysisResult } from '@/lib/analysisSchema';
import { isConfigured } from '@/lib/env';
import { analysisStageProgress } from '@/lib/geminiHelpers';
import { colors, typography } from '@/theme';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => fetchAnalysis(id!),
    enabled: Boolean(id) && isConfigured(),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'queued' || status === 'processing' || status === 'uploaded') return 2500;
      return false;
    },
  });

  const rawResult = query.data?.result;
  const result = useMemo(() => {
    if (!rawResult) return null;
    try {
      return parseAnalysisResult(rawResult);
    } catch {
      return null;
    }
  }, [rawResult]);

  async function onDelete() {
    Alert.alert(
      'Delete this analysis?',
      'Confirm you own this content. Deleting removes the result and any remaining stored video from ViralLens.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I own this — delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAnalysis(id!);
            await qc.invalidateQueries({ queryKey: ['analyses'] });
            router.back();
          },
        },
      ],
    );
  }

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!query.data) {
    return <EmptyState title="Not found" description="This analysis does not exist." />;
  }

  if (query.data.status !== 'completed' || !result) {
    const stage = analysisStageProgress(query.data.status);
    const failed = query.data.status === 'failed' || query.data.status === 'expired';
    const cancellable = ['pending_upload', 'uploaded', 'queued', 'processing'].includes(
      query.data.status,
    );
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: failed ? 'Failed' : 'Processing' }} />
        <Text style={styles.status}>{stage.label}</Text>
        <View style={{ width: '80%', marginTop: 16 }}>
          <ProgressBar value={stage.percent} color={failed ? colors.danger : colors.accent} />
        </View>
        <Text style={styles.sub}>
          {query.data.error_message ?? 'Hang tight — analysis updates in realtime.'}
        </Text>
        {!failed ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
        {cancellable ? (
          <Button
            title="Cancel analysis"
            variant="ghost"
            style={{ marginTop: 24 }}
            onPress={async () => {
              await cancelAnalysis(id!);
              await qc.invalidateQueries({ queryKey: ['analyses'] });
              router.back();
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Results',
          headerRight: () => (
            <Pressable onPress={onDelete}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          ),
        }}
      />
      <ResultsView result={result} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  status: { ...typography.subtitle, textTransform: 'capitalize' },
  sub: { ...typography.bodySecondary, textAlign: 'center', marginTop: 8 },
});
