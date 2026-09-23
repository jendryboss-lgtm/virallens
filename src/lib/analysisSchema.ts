import { z } from 'zod';
import { DISCLAIMER } from '@/theme';

export const RangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

export const RetentionPointSchema = z.object({
  second: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export const ImprovementSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['hook', 'pacing', 'storytelling', 'visuals', 'audio', 'cta', 'other']),
  severity: z.enum(['critical', 'important', 'optional']),
  timestampStart: z.number().nonnegative().nullable(),
  timestampEnd: z.number().nonnegative().nullable(),
  problem: z.string().min(1),
  recommendation: z.string().min(1),
});

export const ShotPlanItemSchema = z.object({
  startSecond: z.number().nonnegative(),
  endSecond: z.number().nonnegative(),
  instruction: z.string().min(1),
});

export const RevisionsSchema = z.object({
  hooks: z.array(z.string()).default([]),
  caption: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
  callsToAction: z.array(z.string()).default([]),
  shotPlan: z.array(ShotPlanItemSchema).default([]),
});

export const ScoreBreakdownSchema = z.object({
  hook: z.number().min(0).max(100),
  pacing: z.number().min(0).max(100),
  storytelling: z.number().min(0).max(100),
  visuals: z.number().min(0).max(100),
  audio: z.number().min(0).max(100),
  cta: z.number().min(0).max(100),
});

export const PredictionsSchema = z.object({
  views: RangeSchema,
  likes: RangeSchema,
  comments: RangeSchema,
  shares: RangeSchema,
});

export const AnalysisResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(1),
  detectedPlatform: z.string().nullable().optional(),
  detectedNiche: z.string().nullable().optional(),
  scores: ScoreBreakdownSchema,
  predictions: PredictionsSchema,
  retentionCurve: z.array(RetentionPointSchema).default([]),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(ImprovementSchema).default([]),
  revisions: RevisionsSchema,
  disclaimer: z.string().default(DISCLAIMER),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type Improvement = z.infer<typeof ImprovementSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export function parseAnalysisResult(raw: unknown): AnalysisResult {
  const parsed = AnalysisResultSchema.parse(raw);
  return {
    ...parsed,
    disclaimer: DISCLAIMER,
  };
}

export function safeParseAnalysisResult(raw: unknown) {
  return AnalysisResultSchema.safeParse(raw);
}
