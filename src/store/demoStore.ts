import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Web-only "Explore demo" guest mode. Lets reviewers click through the main screens
 * in the browser without an account. Never enabled on iOS/Android.
 */
const KEY = 'virallens.webGuest';

function readInitial(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      window.localStorage?.setItem(KEY, '1');
      return true;
    }
    return window.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function persist(value: boolean) {
  if (Platform.OS !== 'web') return;
  try {
    if (value) window.localStorage?.setItem(KEY, '1');
    else window.localStorage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

interface DemoState {
  webGuest: boolean;
  enterWebGuest: () => void;
  exitWebGuest: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  webGuest: readInitial(),
  enterWebGuest: () => {
    if (Platform.OS !== 'web') return;
    persist(true);
    set({ webGuest: true });
  },
  exitWebGuest: () => {
    persist(false);
    set({ webGuest: false });
  },
}));
