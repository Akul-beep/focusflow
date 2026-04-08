'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  X,
} from 'lucide-react';
import { featureTourSeenStorageKey, getFocusflowStorageSuffix } from '@/lib/focusflow-storage-scope';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase/config';

type TourStep = {
  title: string;
  body: string;
  bullets?: string[];
  icon: typeof Sparkles;
  iconWrap: string;
};

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Flowly',
    body:
      'Student weeks rarely stay neat — this is the layer that turns “I should…” into real time on your calendar, without the spreadsheet energy.',
    bullets: ['Built for real slip: sick days, clubs, and surprise deadlines.'],
    icon: Sparkles,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-orange)_18%,transparent)] text-[var(--accent)]',
  },
  {
    title: 'AI scheduling that packs your week',
    body:
      'Describe a task in normal language. Flowly drafts small steps with time estimates, then places them into the work windows you allow — around school, buffers, and fixed events.',
    bullets: [
      'Natural language in → structured steps out.',
      'Respects the hours you set in Settings.',
    ],
    icon: Target,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-blue)_20%,transparent)] text-[var(--claude-blue)]',
  },
  {
    title: 'Rebalance when life happens',
    body:
      'Miss a block, take a lighter day, or rewrite the whole mood of the week? Rebalance reshuffles open work into what’s still possible instead of making you rebuild every plan by hand.',
    bullets: [
      'From Today, Calendar, or Settings — same engine.',
      'Try “only 1 hour today” to compress the rest of the week.',
    ],
    icon: RefreshCw,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-green)_22%,transparent)] text-[var(--claude-green)]',
  },
  {
    title: 'Today → Focus',
    body:
      'Today is your honest queue: what landed, what’s next, and quick recovery when you fall behind. When you’re ready to work, open Focus for timer, momentum, and fewer tabs.',
    bullets: ['Skip or finish blocks; rebalance picks up the slack.'],
    icon: Sun,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-orange)_16%,transparent)] text-[var(--accent)]',
  },
  {
    title: 'Exams & syllabus prep',
    body:
      'Add an exam, paste topics, and spread prep across the days before the test. It sits alongside homework so you’re not cramming in a separate app.',
    icon: GraduationCap,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-blue)_18%,transparent)] text-[var(--claude-blue)]',
  },
  {
    title: 'You’re ready',
    body:
      'Tune work hours, buffers, and the optional morning briefing in Settings. On your phone, the bottom nav keeps Today and tasks one tap away — sign in when you want sync across devices.',
    icon: Sparkles,
    iconWrap: 'bg-[color-mix(in_srgb,var(--claude-green)_20%,transparent)] text-[var(--claude-green)]',
  },
];

function tourExcludedPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/focus')
  );
}

function readTourSeenFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(featureTourSeenStorageKey()) === '1';
  } catch {
    return false;
  }
}

function FeatureTourSheet() {
  const titleId = useId();
  const descId = useId();
  const [step, setStep] = useState(0);
  const completeFeatureTour = useStore((s) => s.completeFeatureTour);

  const markSeen = useCallback(() => {
    completeFeatureTour();
  }, [completeFeatureTour]);

  const last = step >= STEPS.length - 1;
  const goNext = useCallback(() => {
    if (last) markSeen();
    else setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, [last, markSeen]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') markSeen();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [markSeen, goNext, goBack]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const current = STEPS[step];
  const Icon = current?.icon ?? Sparkles;

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="presentation"
    >
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)] backdrop-blur-[3px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[181] flex w-full max-h-[min(92dvh,720px)] flex-col overflow-hidden border border-[var(--border-default)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-[min(100%,440px)] sm:rounded-2xl rounded-t-3xl sm:rounded-b-2xl"
      >
        <div className="h-1 w-full bg-[var(--border-default)] shrink-0">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Quick tour · {step + 1} / {STEPS.length}
          </p>
          <button
            type="button"
            onClick={markSeen}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] cursor-pointer"
            aria-label="Skip tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
          <div key={step} className="animate-fade-in flex flex-1 flex-col">
            <div
              className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${current.iconWrap}`}
            >
              <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
            </div>

            <h2
              id={titleId}
              className="text-center font-heading text-xl font-bold leading-snug text-[var(--foreground)] sm:text-[1.35rem]"
            >
              {current.title}
            </h2>

            <div id={descId} className="mt-3 space-y-3">
              <p className="text-center text-sm leading-relaxed text-[var(--text-subtle)] font-body">
                {current.body}
              </p>
              {current.bullets?.length ? (
                <ul className="mx-auto max-w-sm space-y-2 pt-1 text-left text-sm text-[var(--text-subtle)] font-body">
                  {current.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full p-0 border-0 bg-transparent"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === step ? 'true' : undefined}
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                    i === step
                      ? 'w-7 bg-[var(--accent)]'
                      : 'w-2 bg-[var(--border-default)] hover:bg-[var(--text-muted)]'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-stretch gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="min-h-12 min-w-12 shrink-0 inline-flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:pointer-events-none disabled:opacity-35 cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={goNext}
              className="min-h-12 flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-4 font-heading text-sm font-semibold text-[var(--surface)] hover:opacity-90 cursor-pointer"
            >
              {last ? (
                "Let's go"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={markSeen}
            className="mt-3 w-full py-2 text-center text-xs font-heading font-medium text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeatureTourModal() {
  const pathname = usePathname();
  const { authLoading, user } = useAuth();
  const featureTourCompleted = useStore((s) => s.featureTourCompleted);
  const lastSync = useStore((s) => s.lastSync);
  const syncError = useStore((s) => s.syncError);
  const hasPlannerData = useStore((s) => s.tasks.length > 0 || s.exams.length > 0);

  const storageSuffix = getFocusflowStorageSuffix() ?? 'local';
  const localTourFlag = useMemo(
    () => readTourSeenFromStorage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads scoped localStorage
    [storageSuffix, user?.id],
  );

  const needsCloudGate = isSupabaseConfigured && Boolean(user?.id);
  const [cloudWaitTimedOut, setCloudWaitTimedOut] = useState(false);
  useEffect(() => {
    if (!needsCloudGate) {
      setCloudWaitTimedOut(false);
      return;
    }
    if (lastSync != null || syncError) {
      setCloudWaitTimedOut(false);
      return;
    }
    setCloudWaitTimedOut(false);
    const t = window.setTimeout(() => setCloudWaitTimedOut(true), 12000);
    return () => window.clearTimeout(t);
  }, [needsCloudGate, lastSync, syncError]);

  const cloudReady =
    !needsCloudGate || lastSync != null || Boolean(syncError) || cloudWaitTimedOut;
  const excluded = tourExcludedPath(pathname);
  const eligible = !excluded && !authLoading;

  const storedComplete =
    featureTourCompleted ||
    localTourFlag ||
    (needsCloudGate && cloudReady && hasPlannerData);

  const showTour = cloudReady && eligible && !storedComplete;

  if (!showTour) return null;

  return <FeatureTourSheet />;
}
