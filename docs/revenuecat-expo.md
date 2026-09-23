# RevenueCat + Expo (ViralLens)

ViralLens uses **Expo + `react-native-purchases` + `react-native-purchases-ui`**.  
Do **not** use Swift Package Manager / SwiftUI paywalls — this is a React Native app.

## Product & entitlement IDs (must match dashboard)

| Kind | RevenueCat identifier | App / DB mapping |
|------|------------------------|------------------|
| Entitlement | `virallens_pro` | `ENTITLEMENT_ID` |
| Monthly | `monthly` | plan `monthly` · 30 analyses / period |
| Yearly | `yearly` | plan `annual` · 40 analyses / month |
| Lifetime | `lifetime` | plan `annual` (quota) · no `plan_type` enum change |

Webhook (`rc-webhook`) is the source of truth for `subscriptions.entitlement_active`.  
Lifetime purchases map to `plan = 'annual'` so we do not need a Postgres migration.

## SDK keys

| Env | Dev / Test Store | Production |
|-----|------------------|------------|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `test_…` | `appl_…` |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `test_…` (same Test Store key is fine) | `goog_…` |

Configure in `.env` (gitignored). See `.env.example`.

The client resolves the platform key and, for `test_` keys only, falls back to the other platform key if the preferred one is missing.

## Presenting paywall / customer center (app)

```ts
import {
  presentRevenueCatPaywall,
  presentCustomerCenter,
  presentRevenueCatPaywall as openPaywall,
} from '@/lib/revenuecat';

// Dashboard-designed paywall (primary CTA)
await presentRevenueCatPaywall();
// or only if missing entitlement:
await presentRevenueCatPaywall({ onlyIfNeeded: true });

// Manage subscription
await presentCustomerCenter(); // Customer Center, else store URL
```

Under the hood:

- `RevenueCatUI.presentPaywall()` / `presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'virallens_pro' })`
- `RevenueCatUI.presentCustomerCenter()`

Custom monthly / yearly / lifetime cards remain as a fallback if the UI paywall fails to present.

## Dashboard checklist

1. **Products**  
   - Create / import store products with identifiers `monthly`, `yearly`, `lifetime` (or Test Store products with those IDs).
2. **Entitlement**  
   - Create entitlement `virallens_pro`.  
   - Attach **all three** products to `virallens_pro`.
3. **Offering**  
   - Create a current Offering and attach packages for monthly, yearly, lifetime.
4. **Paywall editor**  
   - Design a paywall for the current Offering in RevenueCat Paywalls.  
   - App calls `presentPaywall` so the dashboard design is what users see.
5. **Customer Center**  
   - Enable Customer Center in the dashboard (management, restore, support links).
6. **Webhook**  
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/rc-webhook`  
   - Authorization: Bearer `REVENUECAT_WEBHOOK_SECRET`  
   - Events: initial purchase, renewal, cancellation, expiration, product change, non-renewing purchase, etc.
7. **Identify**  
   - App calls `Purchases.logIn(supabaseUserId)` after auth.
8. **Keys**  
   - Sandbox / local: Test Store `test_…` on both iOS and Android env vars.  
   - Production builds: platform-specific `appl_` / `goog_` keys via EAS secrets.

## Native note

`react-native-purchases-ui` requires a **dev client / EAS native build** (not Expo Go alone for full paywall UI). After adding the package, rebuild with EAS.

## Related files

- `src/lib/revenuecat.ts` — configure, paywall, customer center, purchase helpers  
- `src/lib/constants.ts` — `PRODUCT_IDS`, `ENTITLEMENT_ID`, `QUOTAS`  
- `src/features/billing/PaywallPanel.tsx` — primary UI paywall + fallback cards  
- `supabase/functions/rc-webhook` + `_shared/quotas.ts` — server entitlement
