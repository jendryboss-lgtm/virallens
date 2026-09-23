import {
  PLATFORMS,
  NICHES,
  EXPERIENCE_LEVELS,
  GROWTH_GOALS,
} from '@/lib/constants';

export const platformOptions = PLATFORMS.map((v) => ({
  value: v,
  label: {
    tiktok: 'TikTok',
    instagram_reels: 'Instagram Reels',
    youtube_shorts: 'YouTube Shorts',
    other: 'Other',
  }[v],
}));

export const nicheOptions = NICHES.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' '),
}));

export const experienceOptions = EXPERIENCE_LEVELS.map((v) => ({
  value: v,
  label: v.charAt(0).toUpperCase() + v.slice(1),
}));

export const growthGoalOptions = GROWTH_GOALS.map((v) => ({
  value: v,
  label: {
    followers: 'Grow followers',
    engagement: 'Boost engagement',
    views: 'Maximize views',
    sales: 'Drive sales',
    brand_awareness: 'Build brand awareness',
  }[v],
}));
