# ViralLens env checklist

Use before local run, EAS build, or function deploy. **Do not commit secrets.**

## Mobile (`.env` / EAS secrets)

| Variable | Required | Notes |
|----------|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | `https://….supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon/public key only |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | iOS | `test_…` (Test Store) or `appl_…` (prod) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Android | `test_…` (same Test Store key OK) or `goog_…` (prod) |
| `EXPO_PUBLIC_PRIVACY_URL` | Recommended | Default `https://virallens.app/privacy` |
| `EXPO_PUBLIC_TERMS_URL` | Recommended | Default `https://virallens.app/terms` |

### Must NOT be in the app

- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_WEBHOOK_SECRET`
- Any Apple/Google signing certs or Play JSON keys

## Supabase Edge Function secrets

```bash
supabase secrets list
supabase secrets set GEMINI_API_KEY=…
supabase secrets set REVENUECAT_WEBHOOK_SECRET=…
```

Auto-injected: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## RevenueCat

- [ ] Entitlement `virallens_pro`
- [ ] Products `monthly` / `yearly` / `lifetime` attached to entitlement
- [ ] Current Offering + Paywall editor + Customer Center
- [ ] Webhook → `…/functions/v1/rc-webhook` with bearer secret
- [ ] See `docs/revenuecat-expo.md`

## EAS / stores

- [ ] `app.json` → `extra.eas.projectId` set
- [ ] `eas.json` → `submit.production.ios.ascAppId` set
- [ ] Apple Team + distribution cert / provisioning
- [ ] Play Console app + service account for submit

## Quick verify

```bash
test -n "$EXPO_PUBLIC_SUPABASE_URL" && echo "supabase url ok"
npm run typecheck && npm run lint && npm test
```
