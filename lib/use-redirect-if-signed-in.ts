'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Send users away from auth screens when a session already exists (Google OAuth or email/password).
 * Uses getSession (fast local read) plus onAuthStateChange so hydration races are covered.
 */
export function useRedirectIfSignedIn(nextPath: string) {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowser();

    const go = () => router.replace(nextPath);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) go();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) go();
    });

    return () => subscription.unsubscribe();
  }, [router, nextPath]);
}
