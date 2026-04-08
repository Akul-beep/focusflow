'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';

export type AuthFormMode = 'login' | 'signup';

type AuthFormProps = {
  mode: AuthFormMode;
  onEmailSubmit: (email: string, password: string) => void | Promise<void>;
  onGoogle: () => void | Promise<void>;
  loading: boolean;
  error: string | null;
  /** Non-error message (e.g. “check your email” after sign-up). */
  notice?: string | null;
  /** When omitted, the sign-in ↔ sign-up switch link is hidden. */
  switchHref?: string;
  switchLabel?: string;
  /** Link back to marketing home (logged-out `/`). */
  homeLinkHref?: string;
};

export default function AuthForm({
  mode,
  onEmailSubmit,
  onGoogle,
  loading,
  error,
  notice,
  switchHref,
  switchLabel,
  homeLinkHref,
}: AuthFormProps) {
  const handleForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    void onEmailSubmit(email, password);
  };

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle =
    mode === 'login'
      ? 'Sign in to sync tasks, calendar, and focus data across your devices.'
      : 'Start planning with AI scheduling — your data stays private to your account.';

  return (
    <div className="relative min-h-screen bg-[var(--surface-page)] flex flex-col items-center justify-center px-4 py-12">
      {homeLinkHref ? (
        <Link
          href={homeLinkHref}
          className="absolute top-6 left-4 sm:left-8 text-sm font-heading font-medium text-[var(--accent)] hover:underline"
        >
          ← Flowly home
        </Link>
      ) : null}
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-heading font-semibold tracking-wide text-[var(--accent)] uppercase mb-2">
            Flowly
          </p>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--text-subtle)] leading-relaxed">{subtitle}</p>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border-default)] shadow-sm p-6 sm:p-8">
          {notice ? (
            <div className="mb-4 rounded-lg border border-[#6A9BCC]/30 bg-[#6A9BCC]/10 px-3 py-2 text-sm text-[var(--foreground)]">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleForm} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-heading font-medium text-[var(--foreground)] mb-1">
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]"
                placeholder="you@school.edu"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-sm font-heading font-medium text-[var(--foreground)] mb-1">
                Password
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]"
                placeholder="••••••••"
              />
              {mode === 'signup' ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">At least 6 characters.</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--accent)] text-white text-sm font-heading font-semibold py-3 shadow-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:pointer-events-none transition-colors"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[var(--border-default)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--surface)] px-3 text-[var(--text-muted)] font-heading uppercase tracking-wide">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void onGoogle()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] py-3 text-sm font-heading font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-60 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>

          {switchHref && switchLabel ? (
            <p className="mt-6 text-center text-sm text-[var(--text-subtle)]">
              <Link href={switchHref} className="font-heading font-medium text-[var(--accent)] hover:underline">
                {switchLabel}
              </Link>
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
          Encrypted connection. Your study plan syncs only to your Supabase project with row-level security — we never
          sell your data.
        </p>
      </div>
    </div>
  );
}
