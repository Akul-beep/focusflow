'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useRedirectIfSignedIn } from '@/lib/use-redirect-if-signed-in';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { applyThemePreference, type ThemePreference } from '@/lib/theme';
import { STUDENT_GRADE_CUSTOM, STUDENT_GRADE_OPTION_VALUES } from '@/lib/grade-options';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/default-signed-in-path';

type StudyPace = 'light' | 'balanced' | 'intensive';
type OnboardingDraft = {
  fullName: string;
  isStudent: boolean;
  programLabel: string;
  weekdayStart: string;
  weekdayEnd: string;
  weekendStart: string;
  weekendEnd: string;
  studyPace: StudyPace;
  personalGoal: string;
  dailyBriefingEnabled: boolean;
  themePreference: ThemePreference;
};

const TOTAL_STEPS = 4;

function SignupInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState<OnboardingDraft>({
    fullName: '',
    isStudent: true,
    programLabel: 'IB MYP 5',
    weekdayStart: '16:00',
    weekdayEnd: '21:30',
    weekendStart: '10:00',
    weekendEnd: '18:00',
    studyPace: 'balanced',
    personalGoal: '',
    dailyBriefingEnabled: false,
    themePreference: 'light',
  });
  const updateSchedulePreferences = useStore((s) => s.updateSchedulePreferences);
  const updateMotivationPreferences = useStore((s) => s.updateMotivationPreferences);
  const currentSchedulePreferences = useStore((s) => s.schedulePreferences);
  const currentMotivationPreferences = useStore((s) => s.motivationPreferences);

  const nextRaw = searchParams.get('next') || DEFAULT_SIGNED_IN_PATH;
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : DEFAULT_SIGNED_IN_PATH;
  const urlError = searchParams.get('error');

  useEffect(() => {
    if (urlError === 'auth_failed') {
      setError('Sign-in failed. Try again or use another method.');
    } else if (urlError === 'config') {
      setError('This server is missing Supabase configuration.');
    }
  }, [urlError]);

  useRedirectIfSignedIn(next);

  useEffect(() => {
    applyThemePreference(draft.themePreference);
  }, [draft.themePreference]);

  const canContinue = useMemo(() => {
    if (step === 1) {
      const nameOk = draft.fullName.trim().length >= 2;
      const programOk = !draft.isStudent || draft.programLabel.trim().length >= 1;
      return nameOk && programOk;
    }
    if (step === 2) return !!draft.weekdayStart && !!draft.weekdayEnd && !!draft.weekendStart && !!draft.weekendEnd;
    if (step === 3) return true;
    return email.trim().length > 4 && password.length >= 6;
  }, [draft, email, password, step]);

  const persistOnboardingRows = async (userId: string, safeEmail: string) => {
    const supabase = getSupabaseBrowser();
    const nowIso = new Date().toISOString();
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: userId,
        email: safeEmail,
        full_name: draft.fullName.trim(),
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (profileError) throw profileError;

    const { error: prefsError } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        schedule_work_start: draft.weekdayStart,
        schedule_work_end: draft.weekdayEnd,
        schedule_weekend_start: draft.weekendStart,
        schedule_weekend_end: draft.weekendEnd,
        schedule_study_pace: draft.studyPace,
        schedule_grade_level: draft.programLabel.trim() || null,
        motivation_personal_goal: draft.personalGoal.trim() || null,
        motivation_daily_briefing: draft.dailyBriefingEnabled,
        theme_preference: draft.themePreference,
        onboarding_is_student: draft.isStudent,
        onboarding_completed_at: nowIso,
        updated_at: nowIso,
        synced_at: nowIso,
      },
      { onConflict: 'user_id' }
    );
    if (prefsError) throw prefsError;

    const { error: onboardingError } = await supabase.from('user_onboarding_profiles').upsert(
      {
        user_id: userId,
        role_label: draft.isStudent ? 'student' : 'professional',
        program_label: draft.programLabel.trim() || null,
        weekday_start: draft.weekdayStart,
        weekday_end: draft.weekdayEnd,
        weekend_start: draft.weekendStart,
        weekend_end: draft.weekendEnd,
        study_pace: draft.studyPace,
        prefers_dark_mode: draft.themePreference === 'dark',
        theme_preference: draft.themePreference,
        daily_briefing_enabled: draft.dailyBriefingEnabled,
        personal_goal: draft.personalGoal.trim() || null,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    );
    if (onboardingError) throw onboardingError;
  };

  const handleEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured on this deployment.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', next);
      const { data, error: signErr } = await getSupabaseBrowser().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            full_name: draft.fullName.trim(),
            onboarding_is_student: draft.isStudent,
            onboarding_program: draft.programLabel.trim() || null,
            onboarding_weekday_start: draft.weekdayStart,
            onboarding_weekday_end: draft.weekdayEnd,
            onboarding_weekend_start: draft.weekendStart,
            onboarding_weekend_end: draft.weekendEnd,
            onboarding_study_pace: draft.studyPace,
            onboarding_personal_goal: draft.personalGoal.trim() || null,
            onboarding_daily_briefing: draft.dailyBriefingEnabled,
            theme_preference: draft.themePreference,
          },
        },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      if (data.session) {
        const safeEmail = email.trim().toLowerCase();
        await persistOnboardingRows(data.session.user.id, safeEmail);
        updateSchedulePreferences({
          ...currentSchedulePreferences,
          workStart: draft.weekdayStart,
          workEnd: draft.weekdayEnd,
          weekendWorkStart: draft.weekendStart,
          weekendWorkEnd: draft.weekendEnd,
          studyPace: draft.studyPace,
          gradeLevel: draft.programLabel.trim(),
        });
        updateMotivationPreferences({
          ...currentMotivationPreferences,
          personalGoal: draft.personalGoal.trim(),
          dailyBriefingEnabled: draft.dailyBriefingEnabled,
        });
        applyThemePreference(draft.themePreference);
        window.location.assign(next);
        return;
      }
      setNotice(
        'Check your email for a confirmation link. Your onboarding answers were saved to your account metadata and will apply once you confirm.'
      );
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
    setNotice(null);
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
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--surface-page)] px-4 py-12">
        <Link
          href="/"
          className="absolute top-6 left-4 sm:left-8 text-sm font-heading font-medium text-[var(--accent)] hover:underline"
        >
          ← Flowly home
        </Link>
        <p className="max-w-md text-center text-sm text-[var(--text-subtle)]">
          Cloud sign-in is disabled — add{' '}
          <code className="rounded bg-[var(--surface-muted)] px-1 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-[var(--surface-muted)] px-1 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use accounts
          and sync.
        </p>
        <Link href={DEFAULT_SIGNED_IN_PATH} className="mt-4 text-sm font-heading font-medium text-[var(--accent)] hover:underline">
          Continue without cloud (local only)
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--surface-page)] px-4 py-10">
      <Link
        href="/"
        className="absolute top-6 left-4 sm:left-8 text-sm font-heading font-medium text-[var(--accent)] hover:underline z-10"
      >
        ← Flowly home
      </Link>
      <div className="mx-auto w-full max-w-3xl pt-6">
        <div className="mb-6 text-center">
          <p className="text-xs font-heading font-semibold tracking-wide text-[var(--accent)] uppercase mb-2">Flowly</p>
          <h1 className="text-3xl font-heading font-bold text-[var(--foreground)]">Build your perfect study system</h1>
          <p className="mt-2 text-sm text-[var(--text-subtle)]">Step {step} of {TOTAL_STEPS} - personalized onboarding that makes scheduling feel made for you.</p>
        </div>

        <div className="mb-6 h-2 rounded-full bg-[var(--surface-muted)]">
          <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
          {notice ? <div className="mb-4 rounded-lg border border-[#6A9BCC]/30 bg-[#6A9BCC]/10 px-3 py-2 text-sm text-[var(--foreground)]">{notice}</div> : null}
          {error ? <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">Who are you?</h2>
              <div>
                <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">Your name</label>
                <input value={draft.fullName} onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]" placeholder="John Doe" />
              </div>
              <div>
                <p className="mb-2 text-sm font-heading font-medium text-[var(--foreground)]">Are you a student?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, isStudent: true }))} className={`rounded-xl border px-4 py-3 text-sm font-heading ${draft.isStudent ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]' : 'border-[var(--border-default)] text-[var(--text-subtle)]'}`}>Yes, student</button>
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, isStudent: false }))} className={`rounded-xl border px-4 py-3 text-sm font-heading ${!draft.isStudent ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]' : 'border-[var(--border-default)] text-[var(--text-subtle)]'}`}>No, professional</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">{draft.isStudent ? 'Grade / program' : 'Role or context'}</label>
                {draft.isStudent ? (
                  <div className="space-y-2">
                    <select
                      value={
                        STUDENT_GRADE_OPTION_VALUES.includes(draft.programLabel.trim())
                          ? draft.programLabel.trim()
                          : STUDENT_GRADE_CUSTOM
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          programLabel: v === STUDENT_GRADE_CUSTOM ? '' : v,
                        }));
                      }}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]"
                    >
                      {STUDENT_GRADE_OPTION_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                      <option value={STUDENT_GRADE_CUSTOM}>Other (type below)</option>
                    </select>
                    {!STUDENT_GRADE_OPTION_VALUES.includes(draft.programLabel.trim()) ? (
                      <input
                        value={draft.programLabel}
                        onChange={(e) => setDraft((d) => ({ ...d, programLabel: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]"
                        placeholder="e.g. Cambridge A-Level, homeschool Year 11"
                      />
                    ) : null}
                  </div>
                ) : (
                  <input
                    value={draft.programLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, programLabel: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]"
                    placeholder="Founder, PM, Software Engineer"
                  />
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">When can we schedule for you?</h2>
              <p className="text-sm text-[var(--text-subtle)]">Set separate windows so weekdays and weekends feel natural.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-heading font-semibold text-[var(--foreground)]">Weekdays</p>
                  <div className="flex items-center gap-2">
                    <input type="time" value={draft.weekdayStart} onChange={(e) => setDraft((d) => ({ ...d, weekdayStart: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                    <span className="text-[var(--text-muted)]">to</span>
                    <input type="time" value={draft.weekdayEnd} onChange={(e) => setDraft((d) => ({ ...d, weekdayEnd: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-3 text-sm font-heading font-semibold text-[var(--foreground)]">Weekends</p>
                  <div className="flex items-center gap-2">
                    <input type="time" value={draft.weekendStart} onChange={(e) => setDraft((d) => ({ ...d, weekendStart: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                    <span className="text-[var(--text-muted)]">to</span>
                    <input type="time" value={draft.weekendEnd} onChange={(e) => setDraft((d) => ({ ...d, weekendEnd: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">Pacing preference</label>
                <select value={draft.studyPace} onChange={(e) => setDraft((d) => ({ ...d, studyPace: e.target.value as StudyPace }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                  <option value="light">Light</option>
                  <option value="balanced">Balanced</option>
                  <option value="intensive">Intensive</option>
                </select>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">What keeps you invested?</h2>
              <div>
                <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">Your personal goal (optional)</label>
                <input value={draft.personalGoal} onChange={(e) => setDraft((d) => ({ ...d, personalGoal: e.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]" placeholder="Get into my top university / hit a promotion / ship a side project" />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] p-4">
                <input type="checkbox" checked={draft.dailyBriefingEnabled} onChange={(e) => setDraft((d) => ({ ...d, dailyBriefingEnabled: e.target.checked }))} className="mt-1" />
                <span>
                  <span className="block text-sm font-heading font-medium text-[var(--foreground)]">Enable morning briefing</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-1">Quick daily plan + motivation snapshot when you open the app.</span>
                </span>
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">Choose your vibe + create account</h2>
              <div>
                <p className="mb-2 text-sm font-heading font-medium text-[var(--foreground)]">Theme preference</p>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((choice) => (
                    <button key={choice} type="button" onClick={() => setDraft((d) => ({ ...d, themePreference: choice }))} className={`rounded-xl border px-3 py-3 text-sm font-heading capitalize ${draft.themePreference === choice ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]' : 'border-[var(--border-default)] text-[var(--text-subtle)]'}`}>
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]" placeholder="you@school.edu" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-heading font-medium text-[var(--foreground)]">Password</label>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={6} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)]" placeholder="At least 6 characters" />
                </div>
              </div>
              <button type="button" disabled={loading} onClick={() => void handleGoogle()} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] py-3 text-sm font-heading font-medium text-[var(--foreground)] hover:opacity-90 disabled:opacity-60">
                Continue with Google instead
              </button>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || loading} className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-heading text-[var(--text-subtle)] disabled:opacity-50">Back</button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))} disabled={!canContinue || loading} className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-heading font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">Continue</button>
            ) : (
              <button type="button" onClick={() => void handleEmail(email.trim(), password)} disabled={!canContinue || loading} className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-heading font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
                {loading ? 'Creating account...' : 'Create personalized account'}
              </button>
            )}
          </div>
          <p className="mt-5 text-center text-sm text-[var(--text-subtle)]">
            <Link href="/login" className="font-heading font-medium text-[var(--accent)] hover:underline">
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] text-sm text-[var(--text-muted)]">
          Loading…
        </div>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
