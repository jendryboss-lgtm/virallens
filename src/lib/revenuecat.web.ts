/**
 * Web shim for RevenueCat. react-native-purchases / -ui are native-only for this app,
 * so on web every purchase path is disabled and the paywall UI shows a notice instead.
 * Metro picks this file for `--platform web`; iOS/Android keep using revenuecat.ts.
 */
import { Linking } from 'react-native';
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT_ID, PRODUCT_IDS } from './constants';

export const WEB_PURCHASES_NOTICE = 'Purchases only work in the iPhone app.';

export const PAYWALL_RESULT = {
  NOT_PRESENTED: 'NOT_PRESENTED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
} as const;

export function configureRevenueCat(_appUserId?: string): void {
  /* no-op on web */
}
export function isRevenueCatConfigured(): boolean {
  return false;
}
export async function identifyUser(_userId: string): Promise<CustomerInfo | null> {
  return null;
}
export async function logoutRevenueCat(): Promise<void> {}
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  return null;
}
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  return null;
}
export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}
export function activeProductId(info: CustomerInfo | null): string | null {
  return info?.entitlements.active[ENTITLEMENT_ID]?.productIdentifier ?? null;
}
export function isTrialing(_info: CustomerInfo | null): boolean {
  return false;
}
export function isUserCancelledError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { userCancelled?: boolean }).userCancelled);
}
export function purchasesErrorMessage(error: unknown, fallback = 'Purchase failed'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
export async function purchasePackage(_pkg: PurchasesPackage): Promise<CustomerInfo> {
  throw new Error(WEB_PURCHASES_NOTICE);
}
export async function restorePurchases(): Promise<CustomerInfo> {
  throw new Error(WEB_PURCHASES_NOTICE);
}
export function findPackage(
  offerings: PurchasesOfferings | null,
  productId: string,
): PurchasesPackage | null {
  return offerings?.current?.availablePackages.find((p) => p.product.identifier === productId) ?? null;
}

export type PresentPaywallOutcome =
  | { kind: 'purchased' | 'restored'; customerInfo: CustomerInfo | null }
  | { kind: 'cancelled' | 'not_presented' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string };

export async function presentRevenueCatPaywall(_opts?: {
  onlyIfNeeded?: boolean;
}): Promise<PresentPaywallOutcome> {
  return { kind: 'unavailable', message: WEB_PURCHASES_NOTICE };
}
export async function presentCustomerCenter(): Promise<'customer_center' | 'store_url'> {
  await Linking.openURL('https://apps.apple.com/account/subscriptions');
  return 'store_url';
}

export { PRODUCT_IDS, ENTITLEMENT_ID };
