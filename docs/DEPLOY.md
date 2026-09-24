# ViralLens deploy & TestFlight guide

Exact steps for Supabase, secrets, RevenueCat webhook, EAS build/submit, and TestFlight.

## 0. Prerequisites

- Node 22+, npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm i -g eas-cli`)
- Apple Developer + App Store Connect access
- Google Play Console (Android)
- Gemini API key (Google AI Studio)
- RevenueCat project with `virallens_pro` entitlement

## 1. Clone & env

```bash
git clone https://github.com/jendryboss-lgtm/virallens.git
cd virallens
cp .env.example .env
npm install --legacy-peer-deps
```

Fill **public** mobile env only (see `scripts/check-env.md`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_PRIVACY_URL=https://virallens.app/privacy
EXPO_PUBLIC_TERMS_URL=https://virallens.app/terms
```

Never put `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the app or git.

## 2. Supabase migrate + functions

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
# or paste supabase/migrations/20260323000001_init.sql in SQL editor

supabase functions deploy create-upload
supabase functions deploy enqueue-analysis
supabase functions deploy process-analysis
supabase functions deploy rc-webhook
supabase functions deploy delete-user
```

### Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_key
supabase secrets set REVENUECAT_WEBHOOK_SECRET=long_random_secret
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for Edge Functions.

Confirm private bucket `videos` exists (created by migration).

### Pipeline (File API)

1. `create-upload` — MIME / duration / size / AI consent / **server entitlement** or free allowance (3 lifetime analyses for non-Pro) / quota → signed URL  
2. Client uploads video  
3. `enqueue-analysis` → `queued` → async `process-analysis`  
4. `process-analysis` downloads video → **Gemini Files API** (upload → wait ACTIVE → generateContent with file URI → delete file) → Zod validate (1–2 JSON retries) → store result → increment usage → delete storage video  
5. On failure/moderation/timeout: mark failed, delete storage video, delete Gemini file  
6. Client Realtime on `analyses`

## 3. RevenueCat

See **[docs/revenuecat-expo.md](revenuecat-expo.md)** for the full Expo + Paywalls checklist.

1. Entitlement: `virallens_pro`  
2. Products: `monthly`, `yearly`, `lifetime` (3-day intro trial on yearly where offered)  
3. Attach products to entitlement + current Offering; design Paywall + Customer Center  
4. Webhook URL:

```
https://YOUR_PROJECT.supabase.co/functions/v1/rc-webhook
```

Authorization: Bearer `REVENUECAT_WEBHOOK_SECRET`  
5. Identify with Supabase user UUID (`Purchases.logIn`)  
6. Keys: Test Store `test_…` for local; `appl_` / `goog_` for store builds

Unlock rule: webhook sets `subscriptions.entitlement_active`. Client cannot unlock Pro locally.  
Yearly and lifetime map to DB plan `annual` (lifetime uses annual quota; no enum migration).

## 4. EAS project

1. `eas login`  
2. `eas init` — paste project id into `app.json` → `extra.eas.projectId`  
3. Set ASC App ID in `eas.json` → `submit.production.ios.ascAppId`  
4. Configure credentials when prompted (`eas credentials`)

Profiles: `development` (dev client), `preview` (internal), `production` (store / TestFlight).

## 5. Build & TestFlight

```bash
# iOS internal / TestFlight candidate
eas build --platform ios --profile preview
# or production
eas build --platform ios --profile production

# Submit to App Store Connect / TestFlight
eas submit --platform ios --profile production --latest
```

In App Store Connect: assign build to TestFlight group, add testers, wait for processing.

Android:

```bash
eas build --platform android --profile preview
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

## 6. Quality gates (before every release)

```bash
npm run typecheck
npm run lint
npm test
```

## 7. Smoke checklist

- [ ] Sign up / sign in  
- [ ] 3 onboarding screens + AI consent  
- [ ] Paywall shows trial clarity, restore, manage, terms/privacy  
- [ ] Upload rejects >90s / >100MB / bad MIME  
- [ ] Progress + cancel during analysis  
- [ ] Results tabs: Analytics / Improvements / Revisions + disclaimer  
- [ ] History + compare  
- [ ] Settings prefs, AI consent toggle, delete analysis (ownership), delete all data  
- [ ] Help & support reachable  
- [ ] Quota remaining updates after completed analysis  

## Blocked on user secrets

Until these exist in your accounts (not in git): Supabase URL/anon, Gemini key, RC iOS/Android keys + webhook secret, EAS project id, Apple ASC app id / certs, Play service account.
