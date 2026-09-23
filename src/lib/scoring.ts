import { colors } from '@/theme';
import type { ScoreBreakdown } from './analysisSchema';

export function scoreColor(score: number): string {
  if (score >= 75) return colors.scoreHigh;
  if (score >= 50) return colors.scoreMid;
  return colors.scoreLow;
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Solid';
  if (score >= 45) return 'Needs work';
  return 'Weak';
}

export function averageScore(scores: ScoreBreakdown): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function formatRange(min: number, max: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

export const SCORE_KEYS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'pacing', label: 'Pacing' },
  { key: 'storytelling', label: 'Story' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'audio', label: 'Audio' },
  { key: 'cta', label: 'CTA' },
];
