import { useSyncExternalStore } from 'react';
export type AuthSession = { userId: string; accessToken: string };
let session: AuthSession | null = null;
const listeners = new Set<() => void>();
/** Login/refresh owner supplies verified-session metadata; never persist credentials. */
export function setAuthSession(next: AuthSession | null) {
  session = next;
  listeners.forEach(listener => listener());
}
export function useAuthSession() {
  return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => session, () => null);
}
