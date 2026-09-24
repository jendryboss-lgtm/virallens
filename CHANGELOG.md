# Changelog

All notable ViralLens milestones. Dates in America/Phoenix (PT).

## [Unreleased] — ops polish

- EAS `preview-sim` profile: standalone Release iOS Simulator build (JS bundled, no Metro) for demos
- GitHub Actions CI on PR/push to `main` (`npm ci`, typecheck, lint, test)
- In-app Privacy Policy and Terms of Use screens (placeholder copy from store listing)
- Legal links from paywall, Settings, and Help
- Free tier: 3 lifetime analyses for non-Pro users (server-enforced in `create-upload`, 402 + paywall when used up); app routes free users to Home instead of forcing the paywall
- `rc-webhook` hardening: ack RevenueCat TEST events, skip unknown/non-UUID users, fail closed without secret, never revoke Pro on unhandled events

## [0.2.0] — 2026-09-23 — TestFlight-ready

- Gemini File API helpers for large video uploads in Edge Functions
- Branding assets, EAS profile polish, deploy and store-listing docs
- Help & support screen; settings/upload/analysis UX gaps closed
- Unit coverage for Gemini helpers

## [0.1.0] — 2026-09-23 — Foundation

- Expo Router app (auth, onboarding, tabs, paywall, analysis)
- Supabase Auth, Postgres + RLS, private video storage, Edge Functions
- RevenueCat Pro entitlement (webhook unlock; quotas always visible)
- Directional multimodal analysis pipeline (scores, improvements, revisions)
- Design system, Jest, ESLint, Prettier; seed README and LICENSE
