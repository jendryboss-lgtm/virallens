export const sampleAnalysis = {
  overallScore: 72,
  confidence: 'medium' as const,
  summary: 'Solid hook with uneven pacing in the middle third.',
  detectedPlatform: 'tiktok',
  detectedNiche: 'education',
  scores: {
    hook: 80,
    pacing: 62,
    storytelling: 70,
    visuals: 75,
    audio: 68,
    cta: 55,
  },
  predictions: {
    views: { min: 2000, max: 18000 },
    likes: { min: 150, max: 1200 },
    comments: { min: 10, max: 90 },
    shares: { min: 5, max: 80 },
  },
  retentionCurve: [
    { second: 0, percentage: 100 },
    { second: 3, percentage: 78 },
    { second: 8, percentage: 55 },
  ],
  strengths: ['Clear opening question', 'Readable captions'],
  improvements: [
    {
      id: 'imp-1',
      category: 'cta' as const,
      severity: 'important' as const,
      timestampStart: 20,
      timestampEnd: 25,
      problem: 'CTA is whispered at the end.',
      recommendation: 'State a single clear ask on-screen in the final 3 seconds.',
    },
  ],
  revisions: {
    hooks: ['Stop scrolling if you keep losing viewers at 3 seconds.'],
    caption: 'I fixed the mid-video drop — here is the retention trick.',
    hashtags: ['shortform', 'creator tips'],
    callsToAction: ['Save this for your next edit'],
    shotPlan: [
      { startSecond: 0, endSecond: 3, instruction: 'Face camera, ask the retention question.' },
      { startSecond: 3, endSecond: 12, instruction: 'Cut to B-roll of timeline scrub.' },
    ],
  },
  disclaimer: 'Estimates are directional and do not guarantee social-media performance.',
};
