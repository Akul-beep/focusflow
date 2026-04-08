'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Play, Plus, ChevronLeft, ChevronRight, Coins, List, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import TaskCard from '@/components/TaskCard';
import ExamSyllabusTaskGroup from '@/components/ExamSyllabusTaskGroup';
import { partitionExamSyllabusTasks } from '@/lib/exam-syllabus-tasks';
import AddTaskModal from '@/components/AddTaskModal';
import TaskSelectionModal from '@/components/TaskSelectionModal';
import TreeForest from '@/components/TreeForest';
import Sidebar from '@/components/Sidebar';
import DailyMotivation from '@/components/DailyMotivation';
import { generateMotivationalMessage } from '@/components/MotivationalMessages';
import { isToday, isPast } from 'date-fns';
import { CheckCircle2, AlertCircle, CalendarClock } from 'lucide-react';
import { getRecoveryBannerSignals } from '@/lib/recovery-signals';
import { getSkippedMicroTaskIdsToday } from '@/lib/skip-sessions';
import { parseCalendarDate } from '@/lib/local-date';
import { getNextFocusMicroTask, focusHrefFor } from '@/lib/focus-next-step';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import GettingStartedChecklist from '@/components/GettingStartedChecklist';

export default function DashboardPage() {
  const { tasks, addMotivationalMessage, updateStats, motivationalMessages, stats } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'completed'>('all');
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);

  useEffect(() => {
    updateStats();

    if (motivationalMessages.length === 0) {
      addMotivationalMessage({
        message: generateMotivationalMessage('encouragement', undefined, useStore.getState().stats),
        type: 'encouragement',
      });
    }
  }, [addMotivationalMessage, updateStats, motivationalMessages.length]);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'completed') return task.completed;
    if (filter === 'active') return !task.completed;
    if (filter === 'overdue') {
      const d = parseCalendarDate(task.dueDate);
      return !task.completed && isPast(d) && !isToday(d);
    }
    return true;
  });

  const sortedTasks = [...filteredTasks]
    .map((task) => ({
      ...task,
      dueDate: parseCalendarDate(task.dueDate),
    }))
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  const activeTasks = tasks.filter((t) => !t.completed).length;
  const overdueTasks = tasks.filter((t) => {
    if (t.completed) return false;
    const d = parseCalendarDate(t.dueDate);
    return isPast(d) && !isToday(d);
  }).length;

  const nextFocus = getNextFocusMicroTask(tasks);
  const hasFocusableStep = tasks.some(
    (t) => !t.completed && t.microTasks.some((mt) => !mt.completed)
  );

  const recoverySignals = useMemo(() => {
    const skipped = getSkippedMicroTaskIdsToday();
    return getRecoveryBannerSignals(tasks, skipped);
  }, [tasks]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const { exam: examSyllabusTasks, other: nonExamTasks } = partitionExamSyllabusTasks(sortedTasks);

  const dashboardSubtitle =
    activeTasks > 0
      ? `You’ve got ${activeTasks} thing${activeTasks !== 1 ? 's' : ''} in motion — pick one and chip away.`
      : total === 0
        ? 'Start with a single task; small wins stack faster than you think.'
        : 'Nice — nothing left open. Add more when you’re ready.';

  const statsChip = (
    <div className="flex items-center gap-2.5 h-10 shrink-0 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-default)] px-2.5">
      <div className="w-32">
        <div className="flex items-center justify-between text-[10px] font-heading leading-none">
          <span className="text-[var(--text-muted)]">Done</span>
          <span className="text-[var(--foreground)] font-semibold tabular-nums">
            {done}/{total || 0}
          </span>
        </div>
        <div className="mt-1 h-1 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D97757] rounded-full transition-all duration-500"
            style={{ width: `${total ? completionPct : 0}%` }}
          />
        </div>
      </div>
      <span className="hidden xl:block w-px h-6 bg-[var(--border-default)] shrink-0" aria-hidden />
      <div className="hidden xl:flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#D97757]/10 flex items-center justify-center">
          <Coins className="w-3.5 h-3.5 text-[#D97757]" />
        </div>
        <div className="text-xs font-heading font-semibold text-[var(--foreground)] tabular-nums leading-tight pr-0.5">
          {stats.focusCoins}
          <span className="text-[var(--text-muted)] font-medium"> · L{stats.level}</span>
          <span className="text-[var(--text-muted)] font-normal"> · +{stats.focusCoinsToday}</span>
        </div>
      </div>
    </div>
  );

  const addTaskBtn = (
    <button
      type="button"
      onClick={() => setShowAddModal(true)}
      className="w-full lg:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] text-[var(--foreground)] font-heading font-medium text-sm hover:bg-[var(--surface-muted)] transition-colors"
    >
      <Plus className="w-4 h-4" />
      Add task
    </button>
  );

  const pickStepBtn = hasFocusableStep ? (
    <button
      type="button"
      onClick={() => setShowFocusPicker(true)}
      className="w-full lg:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] text-[var(--foreground)] font-heading font-medium text-sm hover:bg-[var(--surface-muted)] transition-colors"
      title="Choose any open step to focus on"
    >
      <List className="w-4 h-4" />
      Pick step
    </button>
  ) : null;

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 w-full min-w-0 md:ml-60 pb-20 md:pb-0">
        <PageHeader
          className="shadow-[0_1px_0_rgba(20,20,19,0.04)]"
          title="Dashboard"
          subtitle={
            <span>
              <span className="text-[var(--text-subtle)]">{dashboardSubtitle}</span>
              <span className="mt-2 block text-xs text-[var(--text-muted)] leading-relaxed">
                <span className="font-heading font-medium text-[var(--foreground)]">Today</span> is your daily plan;{' '}
                <span className="font-heading font-medium text-[var(--foreground)]">Calendar</span> shows the full timeline; this
                page is your full task board.{' '}
                <Link href="/today" className="text-[#D97757] font-medium hover:underline">
                  Open Today
                </Link>
              </span>
            </span>
          }
          actions={
            <>
              <div className="hidden lg:flex items-center gap-2">{statsChip}</div>

              {nextFocus ? (
                <Link
                  href={focusHrefFor(nextFocus.task.id, nextFocus.microTask.id)}
                  className="h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-[#D97757] text-white font-heading font-semibold text-sm hover:bg-[#c96b4f] transition-colors shadow-sm shrink-0"
                  title="Opens the focus timer for this step"
                >
                  <Play className="w-4 h-4" />
                  Start focus timer
                </Link>
              ) : hasFocusableStep ? (
                <button
                  type="button"
                  onClick={() => setShowFocusPicker(true)}
                  className="h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-[#D97757] text-white font-heading font-semibold text-sm hover:bg-[#c96b4f] transition-colors shadow-sm shrink-0"
                >
                  <Play className="w-4 h-4" />
                  Pick step
                </button>
              ) : null}

              <details className="relative lg:hidden group/more">
                <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] [&::-webkit-details-marker]:hidden">
                  <MoreHorizontal className="w-5 h-5" aria-hidden />
                  <span className="sr-only">More actions</span>
                </summary>
                <div className="absolute right-0 top-full z-50 mt-1 flex w-52 flex-col gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] p-2 shadow-lg">
                  {addTaskBtn}
                  {pickStepBtn}
                </div>
              </details>

              <div className="hidden lg:flex flex-wrap items-center justify-end gap-2">
                {addTaskBtn}
                {pickStepBtn}
              </div>
            </>
          }
        />

        <main className={PAGE_MAIN_CLASSES}>
          <GettingStartedChecklist />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-[18px] h-[18px] text-[#6A9BCC]" />
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold text-[#141413] tabular-nums leading-none">{activeTasks}</div>
                  <div className="text-xs text-[#B0AEA5] font-heading mt-1">Active</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                  <AlertCircle className="w-[18px] h-[18px] text-[#D97757]" />
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold text-[#141413] tabular-nums leading-none">{overdueTasks}</div>
                  <div className="text-xs text-[#B0AEA5] font-heading mt-1">Overdue</div>
                </div>
              </div>
            </div>
          </div>

          {recoverySignals.showBanner ? (
            <Link
              href="/today?recovery=1"
              className="flex items-start gap-4 mb-6 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-[#fff9f0] p-4 hover:from-amber-50 hover:to-amber-100/50 transition-colors shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5 text-amber-900" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-[#141413]">Schedule slipped? Let&apos;s replan</p>
                <p className="text-sm text-[#6f6d66] mt-1 leading-relaxed">
                  {recoverySignals.overdueIncompleteCount > 0
                    ? `${recoverySignals.overdueIncompleteCount} open session(s) from earlier days. `
                    : null}
                  {recoverySignals.skippedTodayCount > 0
                    ? `${recoverySignals.skippedTodayCount} skipped today. `
                    : null}
                  Open Today to preview new times before you commit.
                </p>
              </div>
            </Link>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
            <div className="lg:col-span-9 space-y-5 min-w-0">
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)]">
                {(['all', 'active', 'overdue', 'completed'] as const).map((f) => {
                  const count =
                    f === 'all'
                      ? tasks.length
                      : f === 'active'
                        ? tasks.filter((t) => !t.completed).length
                        : f === 'completed'
                          ? tasks.filter((t) => t.completed).length
                          : tasks.filter((t) => {
                              if (t.completed) return false;
                              const d = parseCalendarDate(t.dueDate);
                              return isPast(d) && !isToday(d);
                            }).length;
                  const label = f === 'all' ? 'All tasks' : f === 'active' ? 'Active' : f === 'overdue' ? 'Overdue' : 'Done';
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-3.5 py-2 rounded-lg font-heading text-sm font-medium transition-all ${
                        filter === f
                          ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm border border-[var(--border-default)]'
                          : 'text-[var(--text-subtle)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`ml-1.5 tabular-nums text-xs ${
                          filter === f ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {sortedTasks.length === 0 ? (
                  <div className="bg-[var(--surface)] rounded-2xl p-10 sm:p-14 text-center border border-[var(--border-default)] shadow-sm">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-[#D97757]/15 to-[#788C5D]/15 flex items-center justify-center">
                      <Sparkles className="w-9 h-9 text-[#D97757]" />
                    </div>
                    <h3 className="font-heading font-bold text-xl text-[var(--foreground)] mb-2">
                      {filter === 'completed'
                        ? 'No completed tasks yet'
                        : filter === 'overdue'
                          ? "Nothing overdue — you're clear"
                          : 'Room for something new'}
                    </h3>
                    <p className="text-sm text-[var(--text-subtle)] mb-8 max-w-md mx-auto leading-relaxed font-body">
                      {filter === 'all' || filter === 'active'
                        ? 'Use the AI box in the sidebar or tap Add task — one honest task beats a perfect plan you never start.'
                        : 'Try switching filters, or celebrate the empty state.'}
                    </p>
                    {(filter === 'all' || filter === 'active') && (
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {examSyllabusTasks.length > 0 ? (
                      <ExamSyllabusTaskGroup tasks={examSyllabusTasks} />
                    ) : null}
                    {nonExamTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 relative min-w-0 max-w-full">
              <button
                type="button"
                onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
                className="lg:absolute lg:-left-2.5 lg:top-0 z-10 w-8 h-8 bg-white border border-[#E8E6DC] rounded-full flex items-center justify-center hover:bg-[#FAF9F5] text-[#B0AEA5] hover:text-[#141413] shadow-sm mb-3 lg:mb-0"
                aria-label={rightSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {rightSidebarCollapsed ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {!rightSidebarCollapsed && (
                <div className="space-y-4 pt-1">
                  <div className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E8E6DC] text-sm">
                    <Coins className="w-4 h-4 text-[#D97757]" />
                    <span className="font-heading font-semibold text-[#141413] tabular-nums">{stats.focusCoins}</span>
                    <span className="text-[#B0AEA5]">·</span>
                    <span className="text-[#B0AEA5] font-heading text-xs">Lv.{stats.level}</span>
                  </div>
                  <TreeForest variant="compact" showFocusHint />
                  <DailyMotivation variant="compact" />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <AddTaskModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} initialMode="task" />
      <TaskSelectionModal isOpen={showFocusPicker} onClose={() => setShowFocusPicker(false)} />
    </div>
  );
}
