export const PRODUCT_IDS = {
  monthly: 'virallens_pro_monthly',
  annual: 'virallens_pro_annual',
} as const;

export const ENTITLEMENT_ID = 'pro';

export const QUOTAS = {
  trial: 3,
  monthly: 30,
  annual: 40,
} as const;

export const VIDEO_LIMITS = {
  maxDurationSeconds: 90,
  maxSizeBytes: 100 * 1024 * 1024, // 100 MB
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] as const,
} as const;

export const ANALYSIS_STATUSES = [
  'pending_upload',
  'uploaded',
  'queued',
  'processing',
  'completed',
  'failed',
  'expired',
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const PLATFORMS = ['tiktok', 'instagram_reels', 'youtube_shorts', 'other'] as const;
export const NICHES = [
  'comedy',
  'education',
  'lifestyle',
  'fitness',
  'beauty',
  'food',
  'gaming',
  'business',
  'tech',
  'other',
] as const;
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const GROWTH_GOALS = [
  'followers',
  'engagement',
  'views',
  'sales',
  'brand_awareness',
] as const;
