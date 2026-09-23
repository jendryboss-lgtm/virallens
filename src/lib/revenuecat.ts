import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { env } from './env';
import { ENTITLEMENT_ID, PRODUCT_IDS } from './constants';

let configured = false;

const MANAGE_SUB_URL_IOS = 'https://apps.apple.com/account/subscriptions';
const MANAGE_SUB_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

function resolveApiKey(): string {
  const ios = env.revenueCatIosKey?.trim() ?? '';
  const android = env.revenueCatAndroidKey?.trim() ?? '';
  const preferred = Platform.OS === 'ios' ? ios : android;
  if (preferred) return preferred;

  // Test Store keys (test_…) are interchangeable across platforms for local/dev.
  const fallback = Platform.OS === 'ios' ? android : ios;
  if (fallback.startsWith('test_')) return fallback;
  return fallback || '';
}

export function configureRevenueCat(appUserId?: string): void {
  const apiKey = resolveApiKey();

  if (!apiKey) {
    console.warn('[RevenueCat] API key missing — purchases disabled until configured.');
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function identifyUser(userId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

export async function logoutRevenueCat(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.getCustomerInfo();
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!configured) return null;
  return Purchases.getOfferings();
}

export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export function activeProductId(info: CustomerInfo | null): string | null {
  if (!info) return null;
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  return entitlement?.productIdentifier ?? null;
}

export function isTrialing(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return false;
  const periodType = (entitlement as { periodType?: string }).periodType;
  return periodType === 'TRIAL' || periodType === 'INTRO';
}

export function isUserCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as {
    userCancelled?: boolean | null;
    code?: string | number;
    message?: string;
  };
  if (e.userCancelled === true) return true;
  if (e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return true;
  if (typeof e.message === 'string' && /cancelled|canceled/i.test(e.message)) return true;
  return false;
}

export function purchasesErrorMessage(error: unknown, fallback = 'Purchase failed'): string {
  if (isUserCancelledError(error)) return '';
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message ?? '');
    if (msg) return msg;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (!configured) {
    throw new Error('Purchases are not configured.');
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (!hasProEntitlement(customerInfo)) {
      throw new Error('Purchase completed but Pro entitlement is not active. Contact support.');
    }
    return customerInfo;
  } catch (error) {
    if (isUserCancelledError(error)) {
      const cancel = new Error('Purchase cancelled');
      (cancel as Error & { userCancelled: boolean }).userCancelled = true;
      throw cancel;
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (!configured) {
    throw new Error('Purchases are not configured.');
  }
  return Purchases.restorePurchases();
}

export function findPackage(
  offerings: PurchasesOfferings | null,
  productId: string,
): PurchasesPackage | null {
  const current = offerings?.current;
  if (!current) return null;
  const all = [...current.availablePackages];
  return all.find((p) => p.product.identifier === productId) ?? null;
}

export type PresentPaywallOutcome =
  | { kind: 'purchased' | 'restored'; customerInfo: CustomerInfo | null }
  | { kind: 'cancelled' | 'not_presented' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string };

/**
 * Present the RevenueCat dashboard-designed paywall (react-native-purchases-ui).
 * Prefer this over custom package cards when the UI module is available.
 */
export async function presentRevenueCatPaywall(opts?: {
  /** If true, skip presenting when the user already has the Pro entitlement. */
  onlyIfNeeded?: boolean;
}): Promise<PresentPaywallOutcome> {
  if (!configured) {
    return { kind: 'unavailable', message: 'Purchases are not configured.' };
  }

  try {
    const result = opts?.onlyIfNeeded
      ? await RevenueCatUI.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: ENTITLEMENT_ID,
        })
      : await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED: {
        let customerInfo: CustomerInfo | null = null;
        try {
          customerInfo = await Purchases.getCustomerInfo();
        } catch {
          customerInfo = null;
        }
        return {
          kind: result === PAYWALL_RESULT.PURCHASED ? 'purchased' : 'restored',
          customerInfo,
        };
      }
      case PAYWALL_RESULT.CANCELLED:
        return { kind: 'cancelled' };
      case PAYWALL_RESULT.NOT_PRESENTED:
        return { kind: 'not_presented' };
      case PAYWALL_RESULT.ERROR:
      default:
        return { kind: 'error', message: 'Paywall closed with an error.' };
    }
  } catch (error) {
    if (isUserCancelledError(error)) {
      return { kind: 'cancelled' };
    }
    return {
      kind: 'error',
      message: purchasesErrorMessage(error, 'Failed to present RevenueCat paywall'),
    };
  }
}

/**
 * Present RevenueCat Customer Center when configured; otherwise open store subscription URL.
 */
export async function presentCustomerCenter(): Promise<'customer_center' | 'store_url'> {
  if (configured) {
    try {
      await RevenueCatUI.presentCustomerCenter();
      return 'customer_center';
    } catch (error) {
      console.warn('[RevenueCat] presentCustomerCenter failed, falling back to store URL', error);
    }
  }
  const url = Platform.OS === 'ios' ? MANAGE_SUB_URL_IOS : MANAGE_SUB_URL_ANDROID;
  await Linking.openURL(url);
  return 'store_url';
}

export { PRODUCT_IDS, ENTITLEMENT_ID, PAYWALL_RESULT };
