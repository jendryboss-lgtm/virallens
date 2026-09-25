import { Platform } from 'react-native';

/**
 * On web, `/(paywall)/index` and `/` collide (group index == root index) and render
 * "Unmatched Route". Web uses the `/paywall` alias route (app/paywall.tsx); native keeps
 * the original group href unchanged.
 */
export const PAYWALL_HREF = (Platform.OS === 'web' ? '/paywall' : '/(paywall)/index') as '/(paywall)/index';
export const HELP_HREF = (Platform.OS === 'web' ? '/help' : '/help/index') as '/help/index';
