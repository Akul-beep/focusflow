'use client';

import { useStore, resetFocusflowStoreData } from '@/lib/store';
import {
  clearFocusflowStorageForSuffix,
  setFocusflowStorageSuffixInternal,
} from '@/lib/focusflow-storage-scope';

let lastAppliedSuffix: string | null = null;

/**
 * Point localStorage at the signed-in user (or `local` when signed out).
 *
 * **Important:** We do **not** wipe memory when moving `local` ↔ signed-in user. Data often lives
 * only under `…__local` or the legacy key until first load with a user id — clearing RAM then
 * rehydrating an empty `…__userId` key deleted everyone’s tasks. We only wipe when switching
 * **one signed-in account to another** (two different non-`local` suffixes).
 *
 * When leaving a signed-in account (→ `local`) or switching accounts, we remove that account’s
 * scoped localStorage so cached data is not readable from this device without signing in again
 * (cloud remains the source of truth).
 */
export async function applyFocusflowStorageScope(userId: string | null): Promise<void> {
  const next = userId ?? 'local';

  if (lastAppliedSuffix === next) {
    return;
  }

  const previous = lastAppliedSuffix;
  const switchingBetweenTwoCloudAccounts =
    previous !== null &&
    previous !== 'local' &&
    next !== 'local' &&
    previous !== next;
  const guestToUser = next !== 'local' && previous === 'local';
  const userToGuest = previous !== null && previous !== 'local' && next === 'local';

  /** Prevent guest (or prior account) RAM from being persisted under the wrong scope. */
  const needsMemoryReset =
    switchingBetweenTwoCloudAccounts || guestToUser || userToGuest;

  if (switchingBetweenTwoCloudAccounts) {
    clearFocusflowStorageForSuffix(previous);
  }

  if (needsMemoryReset) {
    resetFocusflowStoreData();
  }

  lastAppliedSuffix = next;
  setFocusflowStorageSuffixInternal(next);
  await useStore.persist.rehydrate();

  if (userToGuest) {
    clearFocusflowStorageForSuffix(previous!);
  }
}
