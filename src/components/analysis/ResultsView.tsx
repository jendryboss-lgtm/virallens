import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DisclaimerBanner } from '@/components/ui';
import { ScoreRing } from '@/components/analysis/ScoreRing';
import { ScoreBreakdownList } from '@/components/analysis/ScoreBreakdownList';
import { ImprovementCard } from '@/components/analysis/ImprovementCard';
import type { AnalysisResult } from '@/lib/analysisSchema';
import { formatRange } from '@/lib/scoring';
import { colors, radius, spacing, typography } from '@/theme';

type Tab = 'analytics' | 'improvements' | 'revisions';

export function ResultsView({
  result,
  isSample = false,
}: {
  result: AnalysisResult;
  isSample?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('analytics');

  return (
    <View style={styles.root}>
      {isSample ? (
        <View style={styles.sampleBanner}>
          <Text style={styles.sampleBannerText}>Sample results — not a live analysis</Text>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {(
          [
            ['analytics', 'Analytics'],
            ['improvements', 'Improvements'],
            ['revisions', 'Revisions'],
          ] as const
        ).map(([key, label]) => (
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
            <Text style={styles.hero}>Will it go viral?</Text>
            <View style={styles.scoreWrap}>
              <ScoreRing score={result.overallScore} title="Virality Potential" />
              <Text style={styles.confidence}>Confidence: {result.confidence}</Text>
            </View>
            <Text style={styles.summary}>{result.summary}</Text>

            <Text style={styles.heading}>Reach outlook</Text>
            <View style={styles.featuredRow}>
              <View style={[styles.predCard, styles.predCardFeatured]}>
                <Text style={styles.predLabel}>Views</Text>
                <Text style={[styles.predValue, styles.predValueFeatured]}>
                  {formatRange(result.predictions.views.min, result.predictions.views.max)}
                </Text>
              </View>
              <View style={[styles.predCard, styles.predCardFeatured]}>
                <Text style={styles.predLabel}>Likes</Text>
                <Text style={[styles.predValue, styles.predValueFeatured]}>
                  {formatRange(result.predictions.likes.min, result.predictions.likes.max)}
                </Text>
              </View>
            </View>
            <View style={styles.predGrid}>
              <View style={styles.predCard}>
                <Text style={styles.predLabel}>Comments</Text>
                <Text style={styles.predValue}>
                  {formatRange(result.predictions.comments.min, result.predictions.comments.max)}
                </Text>
              </View>
              <View style={styles.predCard}>
                <Text style={styles.predLabel}>Shares</Text>
                <Text style={styles.predValue}>
                  {formatRange(result.predictions.shares.min, result.predictions.shares.max)}
                </Text>
              </View>
            </View>

            <ScoreBreakdownList scores={result.scores} />

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
  sampleBanner: {
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sampleBannerText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
    fontWeight: '700',
  },
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
  hero: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  scoreWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  confidence: { ...typography.caption, textTransform: 'capitalize' },
  summary: { ...typography.body },
  heading: { ...typography.subtitle, marginTop: spacing.md },
  body: { ...typography.bodySecondary },
  sub: { ...typography.bodySecondary, textAlign: 'center' },
  bullet: { ...typography.bodySecondary, marginBottom: spacing.xs },
  featuredRow: { flexDirection: 'row', gap: spacing.sm },
  predGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  predCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  predCardFeatured: {
    width: '48%',
    flexGrow: 1,
    paddingVertical: spacing.lg,
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
  },
  predLabel: { ...typography.caption },
  predValue: { ...typography.subtitle, color: colors.accent },
  predValueFeatured: { fontSize: 22, lineHeight: 28, marginTop: spacing.xs },
});
