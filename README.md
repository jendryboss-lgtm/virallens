# ViralLens

Production Expo (React Native + TypeScript) app for directional short-form video analysis.

**Branding:** dark charcoal / electric violet / cyan. Original copy. Competitor apps are capability references only.

**Disclaimer (always shown):** Estimates are directional and do not guarantee social-media performance.

## Stack

- Expo SDK 57 + Expo Router + TypeScript
- Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)
- Gemini multimodal (Edge Functions only — never in the mobile app)
- RevenueCat (`pro` entitlement)
- TanStack Query, Zustand, Zod, React Hook Form
- StyleSheet design system, EAS, Jest, ESLint, Prettier

## Monetization (locked)

| Item | Value |
|------|-------|
| Entitlement | `pro` |
| Monthly | `virallens_pro_monthly` — $9.99 · 30 analyses / billing period |
| Annual | `virallens_pro_annual` — $39.99 · 40 analyses / month |
| Trial | 3-day intro · ≤3 completed analyses |
| Unlock rule | RevenueCat **webhook** sets `subscriptions.entitlement_active`. Client cannot unlock Pro by flipping local state. |

Never advertise unlimited. Always show remaining analyses.

## Repo layout

```
app/                 # Expo Router screens
src/
  components/        # UI + analysis presentation
  features/          # auth, onboarding, upload, billing, settings
  lib/               # supabase, revenuecat, zod schemas, quotas
  store/             # zustand
  theme/             # colors / spacing / typography
supabase/
  migrations/        # Postgres + RLS + private videos bucket
  functions/         # create-upload, enqueue-analysis, process-analysis, rc-webhook, delete-user
tests/
```

## Prerequisites

- Node 22+
- Expo / EAS CLI
- Supabase project
- Google AI (Gemini) API key
- RevenueCat project + App Store / Play products
- Apple Developer + Google Play accounts for store builds

## 1. Mobile env

```bash
cp .env.example .env
```

Set only public values:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_PRIVACY_URL=
EXPO_PUBLIC_TERMS_URL=
```

**Never** put `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the app.

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run lint
npm test
npx expo start
```

## 2. Supabase

1. Create a project.
2. Apply migration: `supabase/migrations/20260323000001_init.sql` (SQL editor or `supabase db push`).
3. Confirm private `videos` bucket exists (migration creates it).
4. Deploy Edge Functions:

```bash
supabase functions deploy create-upload
supabase functions deploy enqueue-analysis
supabase functions deploy process-analysis
supabase functions deploy rc-webhook
supabase functions deploy delete-user
```

5. Set secrets:

```bash
supabase secrets set GEMINI_API_KEY=...
supabase secrets set REVENUECAT_WEBHOOK_SECRET=...
```

Service role key is injected automatically in Edge Functions.

### Pipeline

1. App calls `create-upload` → server checks MIME / duration / size / AI consent / **server entitlement** / quota → returns signed upload URL.
2. App uploads video to signed URL.
3. App calls `enqueue-analysis` → status `queued` → invokes `process-analysis` asynchronously.
4. `process-analysis` downloads video, calls Gemini, validates JSON with Zod, stores result, increments usage, deletes raw video.
5. Client subscribes to `analyses` Realtime updates.
6. Raw videos also expire ≤24h (`video_expires_at`).

## 3. RevenueCat

1. Create entitlement `pro`.
2. Create products `virallens_pro_monthly` and `virallens_pro_annual` with a 3-day intro trial on annual (or both, per store rules).
3. Attach products to an Offering.
4. Webhook → `https://YOUR_PROJECT.supabase.co/functions/v1/rc-webhook` with Authorization bearer = `REVENUECAT_WEBHOOK_SECRET`.
5. Identify users with Supabase user UUID (`Purchases.logIn`).

## 4. EAS / TestFlight

Full steps: **[docs/DEPLOY.md](docs/DEPLOY.md)** · env checklist: **[scripts/check-env.md](scripts/check-env.md)** · store copy: **[docs/STORE_LISTING.md](docs/STORE_LISTING.md)**

1. `npm i -g eas-cli && eas login`
2. Replace `extra.eas.projectId` in `app.json`.
3. Profiles in `eas.json`: `development`, `preview`, `production`.
4. `eas build --profile preview` / `production`
5. `eas submit --profile production` for TestFlight / Play internal testing.

`process-analysis` uses the **Gemini Files API** (upload → ACTIVE → generateContent → delete) so large videos are not base64-inlined.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run format` | Prettier |

## Security notes

- Gemini key: Edge Functions only.
- Entitlements: webhook → `subscriptions` table; UI uses `serverEntitled`.
- Storage: private bucket; object paths `{userId}/{analysisId}.ext`.
- No mock subscription success in production paths.

## License

Private / proprietary unless otherwise stated.
