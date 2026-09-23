import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { env } from './env';
import { ENTITLEMENT_ID, PRODUCT_IDS } from './constants';

let configured = false;

export function configureRevenueCat(appUserId?: string): void {
  const apiKey =
    Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey;

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

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (!configured) {
    throw new Error('Purchases are not configured.');
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  if (!hasProEntitlement(customerInfo)) {
    throw new Error('Purchase completed but Pro entitlement is not active. Contact support.');
  }
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (!configured) {
    throw new Error('Purchases are not configured.');
  }
  const info = await Purchases.restorePurchases();
  return info;
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

export { PRODUCT_IDS, ENTITLEMENT_ID };
