import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DisclaimerBanner, EmptyState, ProgressBar } from '@/components/ui';
import { ScoreRing } from '@/components/analysis/ScoreRing';
import { ScoreBreakdownList } from '@/components/analysis/ScoreBreakdownList';
import { ImprovementCard } from '@/components/analysis/ImprovementCard';
import { fetchAnalysis, deleteAnalysis, cancelAnalysis } from '@/features/upload/api';
import { parseAnalysisResult } from '@/lib/analysisSchema';
import { formatRange } from '@/lib/scoring';
import { isConfigured } from '@/lib/env';
import { analysisStageProgress } from '@/lib/geminiHelpers';
import { colors, radius, spacing, typography } from '@/theme';

type Tab = 'analytics' | 'improvements' | 'revisions';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('analytics');

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
      <View style={styles.tabs}>
        {([
          ['analytics', 'Analytics'],
          ['improvements', 'Improvements'],
          ['revisions', 'Revisions'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'analytics' ? (
          <View style={styles.section}>
            <View style={styles.scoreWrap}>
              <ScoreRing score={result.overallScore} />
              <Text style={styles.confidence}>Confidence: {result.confidence}</Text>
            </View>
            <Text style={styles.summary}>{result.summary}</Text>
            <ScoreBreakdownList scores={result.scores} />
            <Text style={styles.heading}>Directional predictions</Text>
            <View style={styles.predGrid}>
              {(
                [
                  ['Views', result.predictions.views],
                  ['Likes', result.predictions.likes],
                  ['Comments', result.predictions.comments],
                  ['Shares', result.predictions.shares],
                ] as const
              ).map(([label, range]) => (
                <View key={label} style={styles.predCard}>
                  <Text style={styles.predLabel}>{label}</Text>
                  <Text style={styles.predValue}>{formatRange(range.min, range.max)}</Text>
                </View>
              ))}
            </View>
            {result.strengths.length > 0 ? (
              <>
                <Text style={styles.heading}>Strengths</Text>
                {result.strengths.map((s) => (
                  <Text key={s} style={styles.bullet}>
                    • {s}
                  </Text>
                ))}
              </>
            ) : null}
            {result.retentionCurve.length > 0 ? (
              <>
                <Text style={styles.heading}>Retention sketch</Text>
                {result.retentionCurve.slice(0, 8).map((p) => (
                  <Text key={p.second} style={styles.bullet}>
                    {p.second}s → {Math.round(p.percentage)}%
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {tab === 'improvements' ? (
          <View style={styles.section}>
            {result.improvements.length === 0 ? (
              <Text style={styles.sub}>No improvement items returned.</Text>
            ) : (
              result.improvements.map((item) => <ImprovementCard key={item.id} item={item} />)
            )}
          </View>
        ) : null}

        {tab === 'revisions' ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Hook alternatives</Text>
            {result.revisions.hooks.map((h) => (
              <Text key={h} style={styles.bullet}>
                • {h}
              </Text>
            ))}
            <Text style={styles.heading}>Caption</Text>
            <Text style={styles.body}>{result.revisions.caption || '—'}</Text>
            <Text style={styles.heading}>Hashtags</Text>
            <Text style={styles.body}>
              {result.revisions.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ') ||
                '—'}
            </Text>
            <Text style={styles.heading}>Calls to action</Text>
            {result.revisions.callsToAction.map((c) => (
              <Text key={c} style={styles.bullet}>
                • {c}
              </Text>
            ))}
            <Text style={styles.heading}>Shot plan</Text>
            {result.revisions.shotPlan.map((s, i) => (
              <Text key={`${s.startSecond}-${i}`} style={styles.bullet}>
                {s.startSecond}s–{s.endSecond}s: {s.instruction}
              </Text>
            ))}
          </View>
        ) : null}

        <DisclaimerBanner text={result.disclaimer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  status: { ...typography.subtitle, textTransform: 'capitalize' },
  sub: { ...typography.bodySecondary, textAlign: 'center', marginTop: 8 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  section: { gap: spacing.md },
  scoreWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  confidence: { ...typography.caption, textTransform: 'capitalize' },
  summary: { ...typography.body },
  heading: { ...typography.subtitle, marginTop: spacing.md },
  body: { ...typography.bodySecondary },
  bullet: { ...typography.bodySecondary, marginBottom: spacing.xs },
  predGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  predCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  predLabel: { ...typography.caption },
  predValue: { ...typography.subtitle, color: colors.accent },
});
