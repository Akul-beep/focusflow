'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initializeSync } from '@/lib/sync-init';
import { applyFocusflowStorageScope } from '@/lib/storage-bootstrap';
import { flushSyncPushToCloud, useStore } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import BoxLoader from '@/components/ui/BoxLoader';

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const { evaluateMorningBriefing, retryQueuedSyncs } = useStore();
  const [storageReady, setStorageReady] = useState(false);

  // Scope + rehydrate before showing app routes. Use getSession() first (local/cookies — fast); getUser()
  // validates with Supabase in the background. Awaiting getUser() here added a full network round-trip
  // before every page could render.
  useLayoutEffect(() => {
    let cancelled = false;

    void (async () => {
      let sessionUser: User | null = null;
      try {
        if (isSupabaseConfigured) {
          const { data } = await getSupabaseBrowser().auth.getSession();
          if (cancelled) return;
          sessionUser = data.session?.user ?? null;
          await applyFocusflowStorageScope(sessionUser?.id ?? null);
        } else {
          await applyFocusflowStorageScope(null);
        }
      } catch {
        if (!cancelled) await applyFocusflowStorageScope(null);
      }

      if (cancelled) return;
      evaluateMorningBriefing();
      setStorageReady(true);

      const runCloudCatchUp = async () => {
        try {
          if (isSupabaseConfigured) {
            const supabase = getSupabaseBrowser();
            const {
              data: { user: validated },
            } = await supabase.auth.getUser();
            if (cancelled) return;
            const validId = validated?.id ?? null;
            const sessionId = sessionUser?.id ?? null;
            if (validId !== sessionId) {
              sessionUser = validated ?? null;
              await applyFocusflowStorageScope(validId);
              evaluateMorningBriefing();
            }
            await initializeSync(sessionUser);
          }
        } catch {
          /* initializeSync already logs */
        }
        try {
          await retryQueuedSyncs();
        } catch {
          /* ignore */
        }
      };
      void runCloudCatchUp();
    })();

    return () => {
      cancelled = true;
    };
  }, [evaluateMorningBriefing, retryQueuedSyncs]);

  useEffect(() => {
    if (!storageReady) return;

    const onOnline = () => {
      retryQueuedSyncs().catch(() => {});
    };
    window.addEventListener('online', onOnline);

    let unsubscribe: (() => void) | undefined;
    if (isSupabaseConfigured) {
      try {
        const { data } = getSupabaseBrowser().auth.onAuthStateChange(async (_event, session) => {
          await applyFocusflowStorageScope(session?.user?.id ?? null);
          if (session?.user) {
            await useStore.getState().syncFromSupabase(session.user);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        // ignore
      }
    }

    return () => {
      window.removeEventListener('online', onOnline);
      unsubscribe?.();
    };
  }, [storageReady, retryQueuedSyncs]);

  // Tab / window focus: flush local edits when hiding; when visible again, pull then push so other tabs/devices merge in.
  useEffect(() => {
    if (!storageReady || !isSupabaseConfigured) return;

    let visibleTimer: ReturnType<typeof setTimeout> | null = null;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushSyncPushToCloud().catch(() => {});
        return;
      }
      if (document.visibilityState !== 'visible') return;
      if (visibleTimer) clearTimeout(visibleTimer);
      visibleTimer = setTimeout(() => {
        visibleTimer = null;
        void (async () => {
          try {
            const { data } = await getSupabaseBrowser().auth.getSession();
            const u = data.session?.user;
            if (!u) return;
            const s = useStore.getState();
            await s.syncFromSupabase(u);
          } catch {
            /* ignore */
          }
        })();
      }, 400);
    };

    document.addEventListener('visibilitychange', onVisibility);
    // `visibilitychange` does not always run before a full tab close; these fire closer to unload
    // so debounced exam syllabus edits still reach Supabase when the user closes the tab quickly.
    const flushOnLeave = () => {
      void flushSyncPushToCloud().catch(() => {});
    };
    window.addEventListener('pagehide', flushOnLeave);
    window.addEventListener('beforeunload', flushOnLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushOnLeave);
      window.removeEventListener('beforeunload', flushOnLeave);
      if (visibleTimer) clearTimeout(visibleTimer);
    };
  }, [storageReady]);

  // Keep cloud + local reasonably fresh during long active sessions.
  useEffect(() => {
    if (!storageReady || !isSupabaseConfigured) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const { data } = await getSupabaseBrowser().auth.getSession();
          const u = data.session?.user;
          if (!u) return;
          const s = useStore.getState();
          await s.syncFromSupabase(u);
          await flushSyncPushToCloud();
        } catch {
          /* ignore */
        }
      })();
    }, 60_000);
    return () => clearInterval(timer);
  }, [storageReady]);

  if (!storageReady) {
    return <BoxLoader label="Opening Flowly..." />;
  }

  return <>{children}</>;
}
