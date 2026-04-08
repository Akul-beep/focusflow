'use client';

import { clearFocusflowStorageForSuffix } from '@/lib/focusflow-storage-scope';
import { flushSyncPushToCloud } from '@/lib/store';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/** Best-effort cloud upload before leaving — capped so sign-out stays responsive. */
const SIGN_OUT_UPLOAD_BUDGET_MS = 3500;

/** Flush pending cloud writes (bounded wait), revoke Supabase + server cookies, clear scoped cache, then go to marketing home (`/`). */
export async function signOutAndRedirectToLogin(): Promise<void> {
  let uid: string | null = null;
  if (isSupabaseConfigured) {
    const client = getSupabaseBrowser();
    const {
      data: { session },
    } = await client.auth.getSession();
    uid = session?.user?.id ?? null;
    if (uid) {
      await Promise.race([
        flushSyncPushToCloud().catch(() => {}),
        new Promise<void>((resolve) => {
          setTimeout(resolve, SIGN_OUT_UPLOAD_BUDGET_MS);
        }),
      ]);
    }
    await client.auth.signOut();
  }
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
  if (uid) {
    clearFocusflowStorageForSuffix(uid);
  }
  window.location.assign('/');
}
