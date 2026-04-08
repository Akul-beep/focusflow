'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { flushSyncPushToCloud, useStore } from '@/lib/store';
import { addDays, format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Clock, ChevronDown, ChevronUp, X, Timer, Sparkles } from 'lucide-react';
import { getDayAgenda } from '@/lib/agenda';
import TreeForest from '@/components/TreeForest';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import GettingStartedChecklist from '@/components/GettingStartedChecklist';
import { getSkippedMicroTaskIdsToday, recordMicroTaskSkipped } from '@/lib/skip-sessions';
import { getRecoveryBannerSignals } from '@/lib/recovery-signals';
import { localDateKey, parseCalendarDate } from '@/lib/local-date';
import { orderCandidatesForRecommendNow, resolveStudyNowFocusHref } from '@/lib/study-now-resolve';
import { focusHrefFor } from '@/lib/focus-next-step';
type StudyNowRecommendation = {
  subject: string;
  task: string;
  microTaskId?: string | null;
  durationMinutes: number;
  reason: string;
};

export default function TodayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    tasks,
    calendarEvents,
    pomodoroSessions,
    stats,
    schedulePreferences,
    rebalanceSchedule,
    skipWorkDaysAndRebalance,
    replaceTasks,
    recordGettingStartedVisitedToday,
  } = useStore();
  const [showTomorrowPlan, setShowTomorrowPlan] = useState(false);
  const [studyNow, setStudyNow] = useState<StudyNowRecommendation | null>(null);
  const [isGettingRecommendation, setIsGettingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [showRecoveryDrawer, setShowRecoveryDrawer] = useState(false);
  const [dismissRecoveryBanner, setDismissRecoveryBanner] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceNote, setRebalanceNote] = useState<{
    unscheduledOpenSteps: number;
    previousTasks: typeof tasks;
  } | null>(null);
  const [skipTick, setSkipTick] = useState(0);

  const skippedTodayIds = useMemo(() => getSkippedMicroTaskIdsToday(), [skipTick]);

  const recoverySignals = useMemo(
    () => getRecoveryBannerSignals(tasks, skippedTodayIds),
    [tasks, skippedTodayIds]
  );

  useEffect(() => {
    if (searchParams.get('recovery') !== '1') return;
    setShowRecoveryDrawer(true);
    router.replace('/today', { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    recordGettingStartedVisitedToday();
  }, [recordGettingStartedVisitedToday]);

  const todaysItems = useMemo(() => {
    const agenda = getDayAgenda({ day: new Date(), tasks, calendarEvents });
    return agenda.taskSteps.map(({ task, microTask }) => ({
      taskId: task.id,
      taskTitle: task.title,
      subject: task.subject || 'General',
      microTaskId: microTask.id,
      microTaskTitle: microTask.title,
      estimatedMinutes: microTask.estimatedMinutes,
      completed: microTask.completed,
      priority: task.priority,
      scheduledDate: microTask.scheduledStart || microTask.scheduledDate || null,
    }));
  }, [tasks, calendarEvents]);

  const tomorrowItems = useMemo(() => {
    const agenda = getDayAgenda({ day: addDays(new Date(), 1), tasks, calendarEvents });
    return agenda.taskSteps.map(({ task, microTask }) => ({
      taskId: task.id,
      taskTitle: task.title,
      microTaskId: microTask.id,
      microTaskTitle: microTask.title,
      estimatedMinutes: microTask.estimatedMinutes,
    }));
  }, [tasks, calendarEvents]);

  const tomorrowMinutes = tomorrowItems.reduce((a, i) => a + i.estimatedMinutes, 0);

  const todayComplete = todaysItems.length > 0 && todaysItems.every((s) => s.completed);
  const remainingToday = useMemo(() => todaysItems.filter((item) => !item.completed), [todaysItems]);

  const todayDateKey = localDateKey(new Date());
  const isNoStudyDay = Boolean(schedulePreferences.noTaskSchedulingDates?.includes(todayDateKey));

  const recommendCandidates = useMemo(
    () => orderCandidatesForRecommendNow(tasks, remainingToday.map((r) => r.microTaskId)),
    [tasks, remainingToday]
  );

  /** Skipped today + open steps scheduled before today (same signals as recovery banner). */
  const missedTasksPayload = useMemo(() => {
    const skipSet = new Set(skippedTodayIds);
    const today0 = startOfDay(new Date());
    const seen = new Set<string>();
    const rows: Array<{
      microTaskId: string;
      title: string;
      estimatedMinutes: number;
      subject: string;
      oldDate?: string;
    }> = [];

    for (const task of tasks) {
      if (task.completed) continue;
      for (const mt of task.microTasks) {
        if (mt.completed || seen.has(mt.id)) continue;
        const skippedToday = skipSet.has(mt.id);
        const anchor = mt.scheduledStart
          ? new Date(mt.scheduledStart)
          : mt.scheduledDate
            ? parseCalendarDate(mt.scheduledDate as Date | string)
            : null;
        const overdue =
          anchor &&
          !Number.isNaN(anchor.getTime()) &&
          isBefore(startOfDay(anchor), today0);

        if (skippedToday || overdue) {
          seen.add(mt.id);
          rows.push({
            microTaskId: mt.id,
            title: mt.title,
            estimatedMinutes: mt.estimatedMinutes,
            subject: task.subject || 'General',
            ...(anchor && !Number.isNaN(anchor.getTime())
              ? { oldDate: localDateKey(startOfDay(anchor)) }
              : {}),
          });
        }
      }
    }
    return rows;
  }, [tasks, skippedTodayIds]);

  const shouldShowRecovery = recoverySignals.showBanner && !dismissRecoveryBanner;

  const completedFocusMinutesToday = pomodoroSessions
    .filter(
      (session) =>
        session.completed &&
        session.endTime &&
        isSameDay(new Date(session.endTime), new Date()) &&
        (!session.type || session.type === 'focus')
    )
    .reduce((acc, session) => acc + session.duration, 0);

  const getEnergyPreference = () => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) return 'morning';
    if (currentHour < 18) return 'afternoon';
    return 'evening';
  };

  const getStudyNowRecommendation = async () => {
    if (isNoStudyDay) {
      setRecommendationError('Today is a no-study day in Settings — rest is the plan. Turn that off if you meant to work.');
      return;
    }
    if (recommendCandidates.length === 0) {
      setRecommendationError('No open steps to pick from. Add a task or uncomplete a step first.');
      return;
    }

    setIsGettingRecommendation(true);
    setRecommendationError(null);
    setStudyNow(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 55_000);

    try {
      const deadlines = tasks
        .filter((task) => !task.completed)
        .map((task) => ({
          title: task.title,
          subject: task.subject || 'General',
          dueDate: localDateKey(parseCalendarDate(task.dueDate as Date | string)),
          estimatedHours: Number((task.estimatedTotalMinutes / 60).toFixed(1)),
          sessionsCompleted: task.microTasks.filter((mt) => mt.completed).length,
        }));

      const remainingTasksToday = remainingToday.map((item) => ({
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        microTaskId: item.microTaskId,
        microTaskTitle: item.microTaskTitle,
        estimatedMinutes: item.estimatedMinutes,
        priority: item.priority,
        scheduledDate: item.scheduledDate
          ? new Date(item.scheduledDate as Date | string).toISOString()
          : null,
      }));

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommendNow',
          currentTime: new Date().toISOString(),
          dayOfWeek: format(new Date(), 'EEEE'),
          deadlines,
          remainingTasks: remainingTasksToday,
          energyPreference: getEnergyPreference(),
          candidateMicroTasks: recommendCandidates,
          noStudyDay: isNoStudyDay,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (errBody.error === 'no_open_steps') {
          throw new Error(
            typeof errBody.message === 'string' ? errBody.message : 'No open steps to recommend.'
          );
        }
        const msg =
          (typeof errBody.message === 'string' && errBody.message) ||
          (typeof errBody.error === 'string' && errBody.error) ||
          "Couldn't generate — try again";
        throw new Error(msg);
      }

      const data = (await response.json()) as { recommendation?: StudyNowRecommendation };
      if (!data?.recommendation) {
        throw new Error("Couldn't generate — try again");
      }
      setStudyNow(data.recommendation);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.name === 'AbortError') {
        setRecommendationError('Request timed out — check your connection and try again.');
      } else {
        setRecommendationError(
          error instanceof Error ? error.message : "Couldn't generate — try again"
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsGettingRecommendation(false);
    }
  };

  const studyFocusHref = useMemo(() => {
    if (!studyNow) return null;
    const href = resolveStudyNowFocusHref(studyNow, recommendCandidates);
    if (href) return href;
    if (studyNow.microTaskId) {
      for (const task of tasks) {
        const mt = task.microTasks.find((m) => m.id === studyNow.microTaskId && !m.completed);
        if (mt) return focusHrefFor(task.id, mt.id);
      }
    }
    return null;
  }, [studyNow, recommendCandidates, tasks]);

  /** Same behavior as Calendar → “Rebalance schedule now” (local packer, whole planner). */
  const handleRebalanceSameAsCalendar = async () => {
    setRebalancing(true);
    try {
      const previousTasks = tasks.map((t) => ({
        ...t,
        microTasks: t.microTasks.map((mt) => ({ ...mt })),
      }));
      rebalanceSchedule();
      const after = useStore.getState().tasks;
      const unscheduledOpenSteps = after.reduce(
        (sum, task) =>
          sum +
          task.microTasks.filter((mt) => !mt.completed && (!mt.scheduledStart || !mt.scheduledEnd)).length,
        0
      );
      setRebalanceNote({ unscheduledOpenSteps, previousTasks });
      setShowRecoveryDrawer(false);
      void flushSyncPushToCloud().catch(() => {});
    } finally {
      setRebalancing(false);
    }
  };

  const handleSkip = (microTaskId: string) => {
    recordMicroTaskSkipped(microTaskId);
    setDismissRecoveryBanner(false);
    setSkipTick((n) => n + 1);
  };

  const handleMarkTodayOff = () => {
    if (
      !confirm(
        'Mark today as a no-study day? Open steps scheduled today will be moved to other days before their deadlines.'
      )
    ) {
      return;
    }
    setRebalancing(true);
    try {
      const previousTasks = tasks.map((t) => ({
        ...t,
        microTasks: t.microTasks.map((mt) => ({ ...mt })),
      }));
      skipWorkDaysAndRebalance([new Date()]);
      const after = useStore.getState().tasks;
      const unscheduledOpenSteps = after.reduce(
        (sum, task) =>
          sum +
          task.microTasks.filter((mt) => !mt.completed && (!mt.scheduledStart || !mt.scheduledEnd)).length,
        0
      );
      setRebalanceNote({ unscheduledOpenSteps, previousTasks });
      setShowRecoveryDrawer(false);
      void flushSyncPushToCloud().catch(() => {});
    } finally {
      setRebalancing(false);
    }
  };

  const missedSubjects = [...new Set(missedTasksPayload.map((m) => m.subject))];

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          title="Today"
          subtitle={
            <span>
              <span className="text-[var(--text-muted)]">{format(new Date(), 'EEEE, MMM d')}</span>
              <span className="mt-2 block text-xs text-[var(--text-muted)] leading-relaxed">
                Your <span className="font-heading font-medium text-[var(--foreground)]">scheduled steps for today</span> — use{' '}
                <Link href="/dashboard" className="text-[#D97757] font-medium hover:underline">
                  Dashboard
                </Link>{' '}
                for the full task list and{' '}
                <Link href="/calendar" className="text-[#D97757] font-medium hover:underline">
                  Calendar
                </Link>{' '}
                for month and week views.
              </span>
            </span>
          }
          actions={
            <button
              type="button"
              onClick={() => setShowRecoveryDrawer(true)}
              className="px-3.5 py-2 rounded-lg font-heading font-medium text-sm border border-[var(--border-default)] text-[var(--foreground)] bg-[var(--surface-muted)] hover:bg-[var(--surface)] transition-colors"
            >
              Rebalance week
            </button>
          }
        />

        <main className={PAGE_MAIN_CLASSES}>
          <GettingStartedChecklist />
          <div className="mb-4 rounded-xl border border-[#E8E6DC] bg-white p-3 sm:p-4 shadow-sm">
            <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-[#B0AEA5] mb-2">
              Recovery actions
            </p>
            <p className="text-xs text-[#57544d] mb-3 leading-relaxed">
              Rebalance reshuffles open task steps across your available windows while respecting fixed events and due dates.
              Mark today off clears today as a study day, then repacks remaining steps before deadlines.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => void handleRebalanceSameAsCalendar()}
                disabled={rebalancing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28] disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {rebalancing ? 'Rebalancing...' : 'Rebalance week'}
              </button>
              <button
                type="button"
                onClick={handleMarkTodayOff}
                disabled={rebalancing}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] text-[#141413] font-heading font-semibold text-sm hover:bg-white disabled:opacity-55 disabled:cursor-not-allowed"
              >
                Mark today off
              </button>
            </div>
          </div>
          {rebalanceNote ? (
            <div className="mb-4 rounded-xl border border-[#E8E6DC] bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#141413]">
                  {rebalanceNote.unscheduledOpenSteps > 0
                    ? `${rebalanceNote.unscheduledOpenSteps} step${
                        rebalanceNote.unscheduledOpenSteps === 1 ? '' : 's'
                      } still could not fit inside your current windows.`
                    : 'Rebalance complete. Everything fit in your current schedule windows.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    replaceTasks(rebalanceNote.previousTasks);
                    setRebalanceNote(null);
                    void flushSyncPushToCloud().catch(() => {});
                  }}
                  className="self-start sm:self-auto rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-1.5 text-xs font-heading font-semibold text-[#141413] hover:bg-white"
                >
                  Undo rebalance
                </button>
              </div>
              {rebalanceNote.unscheduledOpenSteps > 0 ? (
                <p className="mt-1 text-xs text-[#B0AEA5]">
                  Try extending work hours in Settings or mark lower-priority days off less often, then rebalance again.
                </p>
              ) : null}
            </div>
          ) : null}
          {shouldShowRecovery && (
            <div className="bg-[var(--surface-muted)] border border-[var(--border-default)] rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowRecoveryDrawer(true)}
                className="text-left text-sm font-heading font-medium text-[var(--foreground)]"
              >
                Your plan slipped — open recovery to reshuffle the rest of the week.
              </button>
              <button
                type="button"
                onClick={() => setDismissRecoveryBanner(true)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {remainingToday.length > 0 ? (
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#E8E6DC] shadow-sm mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-[#B0AEA5] mb-1">
                    Next up today
                  </p>
                  <p className="font-heading font-semibold text-[#141413] leading-snug">{remainingToday[0].microTaskTitle}</p>
                  <p className="text-xs text-[#B0AEA5] mt-1 truncate">
                    {remainingToday[0].taskTitle} · ~{remainingToday[0].estimatedMinutes} min
                  </p>
                </div>
                <Link
                  href={`/focus?task=${remainingToday[0].taskId}&micro=${remainingToday[0].microTaskId}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D97757] text-white font-heading font-semibold text-sm hover:bg-[#c96b4f] transition-colors shadow-sm shrink-0 w-full sm:w-auto"
                >
                  <Timer className="w-4 h-4" />
                  Start focus timer
                </Link>
              </div>
              <p className="text-[10px] text-[#B0AEA5] mt-3 font-body leading-snug">
                Opens Focus mode (Pomodoro). Completed sessions grow your forest and count for your daily streak.
              </p>

              <details className="mt-4 pt-3 border-t border-[#E8E6DC]/90 group/suggest">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-heading font-semibold text-[#6A9BCC] hover:text-[#4a7aad]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Not sure? Get an AI suggestion
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open/suggest:rotate-180" />
                </summary>
                <p className="text-[10px] text-[#B0AEA5] leading-snug pt-2">
                  Optional: one AI request per tap. It only picks from real steps in your backlog — same step you&apos;ll get in
                  Focus. Skip if you already know what to open.
                </p>
                <div className="pt-3 space-y-3">
                  {isNoStudyDay ? (
                    <p className="text-xs text-[#B0AEA5] leading-relaxed">
                      Today is a <span className="font-heading font-medium text-[#141413]">no-study day</span> in Settings, so
                      we don&apos;t run the coach here. Use <span className="font-heading font-medium">Start focus timer</span>{' '}
                      above if you still want to work.
                    </p>
                  ) : recommendCandidates.length === 0 ? (
                    <p className="text-xs text-[#B0AEA5]">No open steps in your backlog — add a task first.</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={getStudyNowRecommendation}
                        disabled={isGettingRecommendation}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-[#E8E6DC] bg-white text-[#141413] font-heading font-semibold text-sm hover:bg-[#FAF9F5] hover:border-[#B0AEA5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isGettingRecommendation ? (
                          <>
                            <span className="w-4 h-4 border-2 border-[#141413] border-t-transparent rounded-full animate-spin" />
                            Thinking...
                          </>
                        ) : (
                          <>Suggest what to study</>
                        )}
                      </button>
                      {recommendationError ? <p className="text-sm text-[#D97757]">{recommendationError}</p> : null}
                      {studyNow ? (
                        <div className="p-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] relative">
                          <button
                            type="button"
                            aria-label="Dismiss"
                            onClick={() => setStudyNow(null)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-[#B0AEA5] hover:text-[#141413] hover:bg-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <p className="text-base font-heading font-bold text-[#141413] pr-8">{studyNow.subject}</p>
                          <p className="font-heading font-semibold text-[#141413] mt-1 text-sm">{studyNow.task}</p>
                          <p className="text-xs text-[#B0AEA5] mt-2">
                            ~{studyNow.durationMinutes} min · {studyNow.reason}
                          </p>
                          {studyFocusHref ? (
                            <Link
                              href={studyFocusHref}
                              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[#D97757] text-white rounded-lg font-heading font-semibold text-sm hover:bg-[#c96b4f] transition-colors"
                            >
                              <Timer className="w-4 h-4" />
                              Start focus for this step
                            </Link>
                          ) : (
                            <Link
                              href="/focus"
                              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold text-sm hover:bg-[#FAF9F5] transition-colors"
                            >
                              <Timer className="w-4 h-4" />
                              Open Focus to pick a step
                            </Link>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </details>
            </div>
          ) : isNoStudyDay ? (
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#E8E6DC] shadow-sm mb-4">
              <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-[#B0AEA5] mb-1">
                No-study day
              </p>
              <p className="text-sm text-[#141413] leading-relaxed">
                You marked today as a rest day in Settings. Nothing is pushed from the AI coach; use Focus from the dashboard
                if you still want a session.
              </p>
              <Link
                href="/focus"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] font-heading font-semibold text-sm text-[#141413] hover:bg-white transition-colors"
              >
                <Timer className="w-4 h-4" />
                Open Focus
              </Link>
            </div>
          ) : (
            <details className="bg-white rounded-xl p-4 border border-[#E8E6DC] mb-4 group/suggest2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-heading text-sm font-semibold text-[#6A9BCC]">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Nothing on today&apos;s calendar? AI can pick a real step
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open/suggest2:rotate-180" />
              </summary>
              <p className="text-[10px] text-[#B0AEA5] leading-snug pt-2">
                One request per tap. The model only chooses from open steps you already have — the Focus button will match that
                step (not a random one).
              </p>
              <div className="pt-3 space-y-3">
                {recommendCandidates.length === 0 ? (
                  <p className="text-xs text-[#B0AEA5]">Add a task with open steps to get a suggestion.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={getStudyNowRecommendation}
                      disabled={isGettingRecommendation}
                      className="w-full px-4 py-2.5 rounded-lg border-2 border-[#E8E6DC] bg-[#FAF9F5] text-[#141413] font-heading font-semibold text-sm hover:bg-white hover:border-[#B0AEA5] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isGettingRecommendation ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#141413] border-t-transparent rounded-full animate-spin" />
                          Thinking...
                        </>
                      ) : (
                        <>Suggest what to study</>
                      )}
                    </button>
                    {recommendationError ? <p className="text-sm text-[#D97757]">{recommendationError}</p> : null}
                    {studyNow ? (
                      <div className="p-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] relative">
                        <button
                          type="button"
                          aria-label="Dismiss"
                          onClick={() => setStudyNow(null)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-[#B0AEA5] hover:text-[#141413] hover:bg-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-base font-heading font-bold text-[#141413] pr-8">{studyNow.subject}</p>
                        <p className="font-heading font-semibold text-[#141413] mt-1 text-sm">{studyNow.task}</p>
                        <p className="text-xs text-[#B0AEA5] mt-2">
                          ~{studyNow.durationMinutes} min · {studyNow.reason}
                        </p>
                        {studyFocusHref ? (
                          <Link
                            href={studyFocusHref}
                            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[#D97757] text-white rounded-lg font-heading font-semibold text-sm hover:bg-[#c96b4f] transition-colors"
                          >
                            <Timer className="w-4 h-4" />
                            Start focus for this step
                          </Link>
                        ) : (
                          <Link
                            href="/focus"
                            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold text-sm hover:bg-[#FAF9F5] transition-colors"
                          >
                            <Timer className="w-4 h-4" />
                            Open Focus to pick a step
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </details>
          )}

          <div className="bg-white rounded-xl p-6 border border-[#E8E6DC]">
            {todayComplete ? (
              <div className="space-y-5">
                <div className="text-center py-6">
                  <div className="flex justify-center mb-4">
                    <TreeForest variant="compact" showFocusHint />
                  </div>
                  <p className="font-heading font-semibold text-[#141413] mb-2">
                    You&apos;ve hit your goal for today. Rest is earned.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#B0AEA5]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4 text-[#D97757]" />
                      {(completedFocusMinutesToday / 60).toFixed(1)}h focus today
                    </span>
                    <span>
                      Focus streak: {stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTomorrowPlan((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] font-heading text-sm text-[#141413]"
                >
                  <span>
                    Tomorrow: {tomorrowItems.length} session{tomorrowItems.length === 1 ? '' : 's'} ·{' '}
                    {(tomorrowMinutes / 60).toFixed(1)}h
                  </span>
                  {showTomorrowPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTomorrowPlan && (
                  <div className="border-t border-[#E8E6DC] pt-4">
                    <p className="text-xs text-[#B0AEA5] mb-3">{format(addDays(new Date(), 1), 'EEEE, MMM d')}</p>
                    {tomorrowItems.length === 0 ? (
                      <p className="text-sm text-[#B0AEA5]">No sessions scheduled for tomorrow yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {tomorrowItems.map((item) => (
                          <div key={item.microTaskId} className="p-3 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]">
                            <p className="font-heading font-semibold text-sm text-[#141413]">{item.microTaskTitle}</p>
                            <p className="text-xs text-[#B0AEA5]">
                              {item.taskTitle} • ~{item.estimatedMinutes} min
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : todaysItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#B0AEA5] mb-2">Nothing scheduled for today yet.</p>
                <p className="text-xs text-[#B0AEA5]">
                  Add a task with the AI creator; it will spread steps across days before the due date.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysItems.map((item) => (
                  <div
                    key={item.microTaskId}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]"
                  >
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-sm text-[#141413] truncate">{item.microTaskTitle}</p>
                      <p className="text-xs text-[#B0AEA5] truncate">
                        {item.taskTitle} • ~{item.estimatedMinutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.completed ? (
                        <span className="px-3 py-1.5 rounded-lg bg-[#788C5D]/10 text-[#788C5D] text-xs font-heading font-semibold">
                          Done
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSkip(item.microTaskId)}
                            className="px-3 py-2 text-xs font-heading text-[#B0AEA5] border border-[#E8E6DC] rounded-lg hover:bg-white"
                          >
                            Skip
                          </button>
                          <Link
                            href={`/focus?task=${item.taskId}&micro=${item.microTaskId}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
                            title="Open Pomodoro focus timer for this step"
                          >
                            <Timer className="w-4 h-4" />
                            Focus
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showRecoveryDrawer && (
            <div className="fixed inset-0 z-[11000] bg-[#141413]/25 flex items-end">
              <div className="relative z-[11001] w-full bg-white rounded-t-2xl border-t border-[#E8E6DC] p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-semibold text-lg text-[#141413]">Recovery</h3>
                    <button
                      type="button"
                      onClick={() => setShowRecoveryDrawer(false)}
                      className="text-sm text-[#B0AEA5] hover:text-[#141413]"
                    >
                      Close
                    </button>
                  </div>
                  {missedTasksPayload.length > 0 ? (
                    <p className="text-sm text-[#141413] mb-1">
                      {missedTasksPayload.length} skipped session{missedTasksPayload.length === 1 ? '' : 's'} today
                      {missedSubjects.length ? ` · ${missedSubjects.join(', ')}` : ''}.
                    </p>
                  ) : (
                    <p className="text-sm text-[#141413] mb-1">
                      Open steps are repacked into your work windows before each deadline — same as{' '}
                      <Link href="/calendar" className="text-[#D97757] font-heading font-semibold hover:underline">
                        Calendar
                      </Link>{' '}
                      → Rebalance schedule now.
                    </p>
                  )}
                  <p className="text-sm text-[#B0AEA5] mb-4">
                    This runs the full local rebalance for your whole planner (not a separate AI pass).
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRebalanceSameAsCalendar()}
                    disabled={rebalancing}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg font-heading font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {rebalancing ? 'Rebalancing...' : 'Rebalance schedule now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryDrawer(false)}
                    className="block mt-3 text-sm text-[#D97757] font-heading"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
