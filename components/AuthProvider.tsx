'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  /** First hydration from session (avoid flashing “signed out” while we read cookies). */
  authLoading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSupabaseUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setAuthLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
        setAuthLoading(false);
        return;
      }

      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const data = (await res.json()) as { user: AuthUser | null };
      if (data.user?.id) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Re-read session whenever the route changes (e.g. return to Settings) — without clearing the UI first.
  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  // Single subscription for the whole app; keep UI in sync after sign-in / sign-out / token refresh.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const supabase = getSupabaseBrowser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user));
      setAuthLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(() => ({ user, authLoading, refresh }), [user, authLoading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
