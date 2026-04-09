'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useRedirectIfSignedIn } from '@/lib/use-redirect-if-signed-in';
import Link from 'next/link';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/default-signed-in-path';

function LoginInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRaw = searchParams.get('next') || DEFAULT_SIGNED_IN_PATH;
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : DEFAULT_SIGNED_IN_PATH;
  const urlError = searchParams.get('error');
  const oauthDetails = searchParams.get('details');

  useEffect(() => {
    if (urlError === 'auth_failed') {
      setError('Sign-in failed. Try again or use another method.');
    } else if (urlError === 'config') {
      setError('This server is missing Supabase configuration.');
    } else if (urlError === 'oauth') {
      const decoded =
        oauthDetails != null && oauthDetails.length > 0
          ? (() => {
              try {
                return decodeURIComponent(oauthDetails.replace(/\+/g, ' '));
              } catch {
                return oauthDetails;
              }
            })()
          : '';
      setError(
        decoded
          ? `Google sign-in was rejected: ${decoded}`
          : 'Google sign-in failed. Check Supabase redirect URLs and try again.'
      );
    }
  }, [urlError, oauthDetails]);

  useRedirectIfSignedIn(next);

  const handleEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured on this deployment.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: signErr } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      window.location.assign(next);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured on this deployment.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError((data.error as string) || 'Could not start Google sign-in.');
    } catch {
      setError('Could not start Google sign-in.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="relative min-h-screen bg-[#FAF9F5] flex flex-col items-center justify-center px-4 py-12">
        <Link
          href="/"
          className="absolute top-6 left-4 sm:left-8 text-sm font-heading font-medium text-[#D97757] hover:underline"
        >
          ← Flowly home
        </Link>
        <p className="text-sm text-[#5C5B56] text-center max-w-md">
          Cloud sign-in is disabled — add <code className="text-xs bg-[#E8E6DC] px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          and <code className="text-xs bg-[#E8E6DC] px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use accounts
          and sync.
        </p>
        <Link href={DEFAULT_SIGNED_IN_PATH} className="mt-4 text-sm font-heading font-medium text-[#D97757] hover:underline">
          Continue without cloud (local only)
        </Link>
      </div>
    );
  }

  return (
    <AuthForm
      mode="login"
      onEmailSubmit={handleEmail}
      onGoogle={handleGoogle}
      loading={loading}
      error={error}
      homeLinkHref="/"
      switchHref="/signup"
      switchLabel="Create an account"
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-sm text-[#B0AEA5]">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
