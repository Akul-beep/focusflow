'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useStore } from '@/lib/store';

function StepRow({
  done,
  label,
  hint,
  children,
}: {
  done: boolean;
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 py-2 border-b border-[var(--border-default)] last:border-0">
      <div className="shrink-0 pt-0.5">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-[#6A9BCC]" aria-hidden />
        ) : (
          <Circle className="w-5 h-5 text-[var(--text-muted)]" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-heading text-sm font-medium ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--foreground)]'}`}>
          {label}
        </p>
        {hint ? <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{hint}</p> : null}
        {children ? <div className="mt-2 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </li>
  );
}

/**
 * Dismissible first-run hints on Dashboard / Today until the user has opened Today and added a task or exam.
 */
export default function GettingStartedChecklist() {
  const taskCount = useStore((s) => s.tasks.length);
  const examCount = useStore((s) => s.exams.length);
  const visitedToday = useStore((s) => s.gettingStartedVisitedToday);
  const visitedSettings = useStore((s) => s.gettingStartedVisitedSettings);
  const dismissed = useStore((s) => s.gettingStartedChecklistDismissed);
  const featureTourCompleted = useStore((s) => s.featureTourCompleted);
  const dismiss = useStore((s) => s.dismissGettingStartedChecklist);
  const completeFeatureTour = useStore((s) => s.completeFeatureTour);

  const [manual, setManual] = useState<{ today: boolean; plan: boolean; settings: boolean }>({
    today: false,
    plan: false,
    settings: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('focusflow-getting-started-manual');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{ today: boolean; plan: boolean; settings: boolean }>;
      setManual({
        today: !!parsed.today,
        plan: !!parsed.plan,
        settings: !!parsed.settings,
      });
    } catch {
      // ignore
    }
  }, []);

  const setManualStep = (k: 'today' | 'plan' | 'settings') => {
    setManual((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('focusflow-getting-started-manual', JSON.stringify(next));
      }
      return next;
    });
  };

  const doneToday = visitedToday || manual.today;
  const donePlan = taskCount > 0 || examCount > 0 || manual.plan;
  const doneSettings = visitedSettings || manual.settings;
  const allDone = doneToday && donePlan && doneSettings;

  useEffect(() => {
    if (allDone && !dismissed) {
      dismiss();
      completeFeatureTour();
    }
  }, [allDone, dismissed, dismiss, completeFeatureTour]);

  if (dismissed || featureTourCompleted) return null;

  return (
    <div className="mb-4 rounded-xl border border-[var(--border-default)] bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-[var(--border-default)] bg-[var(--surface-muted)]">
        <div>
          <h2 className="font-heading font-semibold text-[var(--foreground)] text-sm">Get started</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Two quick steps, then you&apos;re rolling.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismiss();
            completeFeatureTour();
          }}
          className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white hover:text-[var(--foreground)]"
          aria-label="Dismiss checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="px-4 py-1">
        <StepRow
          done={doneToday}
          label="Open Today"
          hint="Your sessions for the day and recovery tools live here."
        >
          {!doneToday ? (
            <Link
              href="/today"
              className="inline-flex items-center rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-heading font-semibold text-white hover:bg-[#c96b4f] transition-colors"
            >
              Go to Today
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setManualStep('today')}
            className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {doneToday ? 'Uncheck' : 'Mark done'}
          </button>
        </StepRow>
        <StepRow
          done={donePlan}
          label="Add a task or an exam plan"
          hint="Tasks get AI steps on your calendar; exams hold syllabus prep."
        >
          {!donePlan ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Add task
              </Link>
              <Link
                href="/exams"
                className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Exam plan
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setManualStep('plan')}
            className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {donePlan ? 'Uncheck' : 'Mark done'}
          </button>
        </StepRow>
        <StepRow
          done={doneSettings}
          label="Optional: work hours & daily briefing"
          hint="Tune when Flowly can schedule blocks, and turn on the morning summary if you like."
        >
          {!doneSettings ? (
            <Link
              href="/settings"
              className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3 py-1.5 text-xs font-heading font-medium text-[var(--text-muted)] hover:text-[#D97757] transition-colors"
            >
              Open Settings
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setManualStep('settings')}
            className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-1.5 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {doneSettings ? 'Uncheck' : 'Mark done'}
          </button>
        </StepRow>
      </ul>
    </div>
  );
}
