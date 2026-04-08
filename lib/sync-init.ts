'use client';

// Initialize sync on app load (or after sign-in). Caller may pass `user` from a prior `getUser()`.
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabase/config';
import { getSupabaseBrowser } from './supabase/browser';
import { useStore } from './store';

export async function initializeSync(knownUser?: User | null) {
  if (!isSupabaseConfigured) return;

  try {
    let user: User | null | undefined = knownUser;
    if (user === undefined) {
      const {
        data: { user: u },
      } = await getSupabaseBrowser().auth.getUser();
      user = u ?? null;
    }

    if (!user) return;

    const { syncFromSupabase } = useStore.getState();
    await syncFromSupabase(user);
  } catch {
    // Offline, ad-blocked `.supabase.co`, or auth host unreachable — keep using local storage
    console.warn('Sync initialization skipped (cannot reach Supabase; using local data only).');
  }
}
