import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const RangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

export const AnalysisResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(1),
  detectedPlatform: z.string().nullable().optional(),
  detectedNiche: z.string().nullable().optional(),
  scores: z.object({
    hook: z.number().min(0).max(100),
    pacing: z.number().min(0).max(100),
    storytelling: z.number().min(0).max(100),
    visuals: z.number().min(0).max(100),
    audio: z.number().min(0).max(100),
    cta: z.number().min(0).max(100),
  }),
  predictions: z.object({
    views: RangeSchema,
    likes: RangeSchema,
    comments: RangeSchema,
    shares: RangeSchema,
  }),
  retentionCurve: z
    .array(z.object({ second: z.number().nonnegative(), percentage: z.number().min(0).max(100) }))
    .default([]),
  strengths: z.array(z.string()).default([]),
  improvements: z
    .array(
      z.object({
        id: z.string().min(1),
        category: z.enum(['hook', 'pacing', 'storytelling', 'visuals', 'audio', 'cta', 'other']),
        severity: z.enum(['critical', 'important', 'optional']),
        timestampStart: z.number().nonnegative().nullable(),
        timestampEnd: z.number().nonnegative().nullable(),
        problem: z.string().min(1),
        recommendation: z.string().min(1),
      }),
    )
    .default([]),
  revisions: z.object({
    hooks: z.array(z.string()).default([]),
    caption: z.string().default(''),
    hashtags: z.array(z.string()).default([]),
    callsToAction: z.array(z.string()).default([]),
    shotPlan: z
      .array(
        z.object({
          startSecond: z.number().nonnegative(),
          endSecond: z.number().nonnegative(),
          instruction: z.string().min(1),
        }),
      )
      .default([]),
  }),
  disclaimer: z.string().default(
    'Estimates are directional and do not guarantee social-media performance.',
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const DISCLAIMER =
  'Estimates are directional and do not guarantee social-media performance.';
