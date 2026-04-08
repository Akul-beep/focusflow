import type { StateStorage } from 'zustand/middleware';

/** Persist name used by zustand (must match `persist({ name })`). */
export const FOCUSFLOW_ZUSTAND_PERSIST_NAME = 'student-scheduler-storage';

const LEGACY_ZUSTAND_KEY = FOCUSFLOW_ZUSTAND_PERSIST_NAME;

/**
 * `null` until bootstrap runs — zustand must use `skipHydration` until then.
 * `'local'` = signed out; otherwise Supabase `user.id`.
 */
let activeSuffix: string | null = null;

export function getFocusflowStorageSuffix(): string | null {
  return activeSuffix;
}

/** @internal Set by storage bootstrap only. */
export function setFocusflowStorageSuffixInternal(suffix: string): void {
  activeSuffix = suffix;
}

export function syncQueueStorageKey(): string {
  return `focusflow-sync-queue__${activeSuffix ?? 'local'}`;
}

export function morningBriefingStorageKey(): string {
  return `focusflow-last-briefing-date__${activeSuffix ?? 'local'}`;
}

/** First-run feature tour completed/skipped (one per account / device scope). */
export function featureTourSeenStorageKey(): string {
  return `focusflow-feature-tour-v1__${activeSuffix ?? 'local'}`;
}

/** Per-day skipped micro-task ids, isolated per account. */
export function skippedMicroTasksStorageKey(isoDate: string): string {
  return `focusflow-skipped-micro__${activeSuffix ?? 'local'}__${isoDate}`;
}

/**
 * Zustand JSON storage: one blob per (`persistName` × account).
 *
 * **Never** copy `…__local` or the legacy unscoped key into a signed-in user’s key — that caused
 * another account’s / guest data to appear under the wrong Google user. Cloud + `…__userId` only
 * for logged-in users; `syncFromSupabase` fills an empty user bucket.
 */
export function createScopedZustandStateStorage(): StateStorage {
  return {
    getItem(name) {
      const suffix = activeSuffix;
      if (suffix === null) return null;
      const key = `${name}__${suffix}`;
      const scoped = localStorage.getItem(key);
      if (scoped != null) return scoped;

      if (suffix === 'local' && name === LEGACY_ZUSTAND_KEY) {
        const legacy = localStorage.getItem(LEGACY_ZUSTAND_KEY);
        if (legacy) {
          localStorage.setItem(key, legacy);
          localStorage.removeItem(LEGACY_ZUSTAND_KEY);
          return legacy;
        }
      }
      return null;
    },
    setItem(name, value) {
      const suffix = activeSuffix;
      if (suffix === null) return;
      localStorage.setItem(`${name}__${suffix}`, value);
    },
    removeItem(name) {
      const suffix = activeSuffix;
      if (suffix === null) return;
      localStorage.removeItem(`${name}__${suffix}`);
    },
  };
}

/** Clear sync queue, briefing marker, and skip-session keys for the active scope. */
export function clearAuxiliaryScopedStorage(): void {
  if (typeof window === 'undefined') return;
  const suffix = activeSuffix ?? 'local';
  clearFocusflowAuxiliaryKeysForSuffix(suffix);
}

/** Remove persisted planner blob + sync queue + briefing + skipped-micro keys for one scope (e.g. on sign-out or account switch). */
export function clearFocusflowStorageForSuffix(suffix: string): void {
  if (typeof window === 'undefined' || !suffix) return;
  localStorage.removeItem(`${FOCUSFLOW_ZUSTAND_PERSIST_NAME}__${suffix}`);
  clearFocusflowAuxiliaryKeysForSuffix(suffix);
}

function clearFocusflowAuxiliaryKeysForSuffix(suffix: string): void {
  localStorage.removeItem(`focusflow-sync-queue__${suffix}`);
  localStorage.removeItem(`focusflow-last-briefing-date__${suffix}`);
  localStorage.removeItem(`focusflow-feature-tour-v1__${suffix}`);
  const prefix = `focusflow-skipped-micro__${suffix}__`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
