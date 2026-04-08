'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { flushSyncPushToCloud } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import DailyMotivation from '@/components/DailyMotivation';
import CalendarEventModal from '@/components/CalendarEventModal';
import CalendarItemDetailSheet from '@/components/CalendarItemDetailSheet';
import { Plus } from 'lucide-react';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import { CalendarEvent } from '@/types';
import { format } from 'date-fns';
import Link from 'next/link';
import { getDayAgenda } from '@/lib/agenda';
import {
  buildClusterBlockTitle,
  calendarPrimaryLabelForTimedCluster,
  microTaskStepLabel,
} from '@/lib/schedule-calendar-events';

const ScheduleCalendar = dynamic(() => import('@/components/ScheduleCalendar'), {
  ssr: false,
  loading: () => (
    <div className="schedule-view-card rounded-xl p-4 sm:p-6 shadow-sm border border-[#E8E6DC] w-full min-h-[480px] animate-pulse bg-[#FAF9F5]" />
  ),
});

export default function CalendarPage() {
  const {
    deleteCalendarEvent,
    tasks,
    calendarEvents,
    skipWorkDaysAndRebalance,
    rebalanceSchedule,
    replaceTasks,
    toggleMicroTaskComplete,
    exams,
    schedulePreferences,
  } = useStore();
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>();
  const [taskDetail, setTaskDetail] = useState<{
    taskId: string;
    microTaskId: string;
    clusterMicroTaskIds?: string[];
  } | null>(null);
  const [rebalanceNote, setRebalanceNote] = useState<{
    unscheduledOpenSteps: number;
    previousTasks: typeof tasks;
  } | null>(null);

  /** Selecting a day cell updates the sidebar agenda only (does not open the event editor). */
  const handleSelectDayForSidebar = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
    setTaskDetail(null);
  };

  const openNewEventForSelectedDay = () => {
    setSelectedEvent(undefined);
    setTaskDetail(null);
    setShowEventModal(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setTaskDetail(null);
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleTaskClick = (taskId: string, microTaskId: string, clusterMicroTaskIds?: string[]) => {
    setSelectedEvent(undefined);
    setShowEventModal(false);
    setTaskDetail({ taskId, microTaskId, clusterMicroTaskIds });
  };

  const handleDelete = () => {
    if (selectedEvent && confirm('Are you sure you want to delete this event?')) {
      deleteCalendarEvent(selectedEvent.id);
      setShowEventModal(false);
      setSelectedEvent(undefined);
    }
  };

  const day = selectedDate;

  const handleSkipDay = () => {
    if (
      !confirm(
        `Mark ${format(day, 'EEE, MMM d')} as a no-study day? Open steps scheduled that day will be cleared and moved to other days before their deadlines (exam blocks with several topics may split into separate steps).`
      )
    ) {
      return;
    }
    skipWorkDaysAndRebalance([day]);
  };
  const [rebalancing, setRebalancing] = useState(false);
  const handleRebalanceNow = async () => {
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
      void flushSyncPushToCloud().catch(() => {});
    } finally {
      setRebalancing(false);
    }
  };
  const dayAgenda = useMemo(() => {
    return getDayAgenda({ day, tasks, calendarEvents });
  }, [day, tasks, calendarEvents]);

  const taskBlocks = useMemo(() => {
    const gapMin = Math.max(5, (schedulePreferences.bufferMinutes || 5) + 5);
    const steps = [...dayAgenda.taskSteps].sort((a, b) => {
      const at = a.microTask.scheduledStart ? new Date(a.microTask.scheduledStart).getTime() : Number.MAX_SAFE_INTEGER;
      const bt = b.microTask.scheduledStart ? new Date(b.microTask.scheduledStart).getTime() : Number.MAX_SAFE_INTEGER;
      return at - bt;
    });
    const out: Array<{ start?: Date; end?: Date; items: typeof dayAgenda.taskSteps }> = [];
    for (const step of steps) {
      const ss = step.microTask.scheduledStart ? new Date(step.microTask.scheduledStart) : undefined;
      const se = step.microTask.scheduledEnd ? new Date(step.microTask.scheduledEnd) : undefined;
      const last = out[out.length - 1];
      if (!last || !ss || !se || !last.start || !last.end) {
        out.push({ start: ss, end: se, items: [step] });
        continue;
      }
      const gapMs = ss.getTime() - last.end.getTime();
      const sameTask = last.items[0]?.task.id === step.task.id;
      if (sameTask && gapMs <= gapMin * 60_000) {
        last.items.push(step);
        if (se > last.end) last.end = se;
      } else {
        out.push({ start: ss, end: se, items: [step] });
      }
    }
    return out;
  }, [dayAgenda.taskSteps, schedulePreferences.bufferMinutes]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          sticky="blur"
          title="Calendar"
          subtitle={
            <span>
              <span>Week · month · day — study blocks sit next to school events.</span>
              <span className="mt-2 block text-xs text-[var(--text-muted)] leading-relaxed">
                For <span className="font-heading font-medium text-[var(--foreground)]">what to do right now</span>, use{' '}
                <Link href="/today" className="text-[#D97757] font-medium hover:underline">
                  Today
                </Link>
                ; for every task, open{' '}
                <Link href="/dashboard" className="text-[#D97757] font-medium hover:underline">
                  Dashboard
                </Link>
                .
              </span>
            </span>
          }
          actions={
            <button
              type="button"
              onClick={() => {
                setSelectedDate(new Date());
                setSelectedEvent(undefined);
                setTaskDetail(null);
                setShowEventModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-heading font-semibold hover:bg-[#c96b4f] shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5" />
              New event
            </button>
          }
        />

        <main className={PAGE_MAIN_CLASSES}>
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            <div className="lg:col-span-3 min-w-0 overflow-visible">
              <ScheduleCalendar
                onDateClick={handleSelectDayForSidebar}
                onEventClick={handleEventClick}
                onTaskClick={handleTaskClick}
              />
            </div>

            <aside className="lg:col-span-1 space-y-4 min-w-0">
              <DailyMotivation />

              <div className="bg-[var(--surface)] rounded-xl p-5 border border-[var(--border-default)] shadow-sm card-shadow lg:sticky lg:top-24 max-h-[min(70vh,32rem)] lg:max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 mb-2 shrink-0">
                  <h3 className="text-sm font-heading font-semibold text-[var(--foreground)]">{format(day, 'EEE, MMM d')}</h3>
                </div>
                <p className="mb-2 text-[11px] leading-relaxed text-[var(--text-muted)] shrink-0">
                  Tap any day on the calendar (not only the number) to load this list. Rebalance applies to your whole
                  planner; the checklist is for the day you selected.
                </p>
                <button
                  type="button"
                  onClick={openNewEventForSelectedDay}
                  className="mb-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] shrink-0"
                >
                  Add event on this day
                </button>
                <button
                  type="button"
                  onClick={() => void handleRebalanceNow()}
                  disabled={rebalancing}
                  className="mb-2 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-heading font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-55 disabled:cursor-not-allowed shrink-0"
                >
                  {rebalancing ? 'Rebalancing...' : 'Rebalance schedule now'}
                </button>
                <button
                  type="button"
                  onClick={handleSkipDay}
                  className="mb-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-heading font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] shrink-0"
                >
                  Mark day off
                </button>
                <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-muted)] shrink-0">
                  This clears today as a study day and moves open steps to other days before each deadline.
                </p>
                <div className="space-y-2 overflow-y-auto min-h-0 pr-1 -mr-1">
                  {dayAgenda.taskSteps.length === 0 && dayAgenda.events.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No scheduled tasks or events.</p>
                  ) : (
                    <>
                      {taskBlocks.map((block, i) => {
                        const firstTask = block.items[0]?.task;
                        const clusterEntries =
                          firstTask != null
                            ? block.items.map(({ task, microTask }) => ({
                                mt: microTask,
                                idx: Math.max(0, task.microTasks.findIndex((m) => m.id === microTask.id)),
                              }))
                            : [];
                        const mergedBlockTitle =
                          firstTask && clusterEntries.length > 1
                            ? calendarPrimaryLabelForTimedCluster(firstTask, clusterEntries)
                            : null;
                        const mergedBlockSubtitles =
                          firstTask && clusterEntries.length > 1
                            ? buildClusterBlockTitle(firstTask, clusterEntries).split('\n').slice(1)
                            : [];
                        return (
                          <div key={`block-${i}`} className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)]">
                            <p className="text-xs text-[var(--text-muted)] font-heading mb-2">
                              {block.start && block.end
                                ? `${format(block.start, 'h:mm a')} - ${format(block.end, 'h:mm a')}`
                                : 'Planned block'}
                            </p>
                            {mergedBlockTitle ? (
                              <p className="text-sm font-heading font-semibold text-[var(--foreground)] leading-snug mb-2">
                                {mergedBlockTitle}
                              </p>
                            ) : null}
                            {mergedBlockSubtitles.length > 0 ? (
                              <ul className="mb-3 space-y-0.5 border-l-2 border-[var(--border-default)] pl-2 text-xs text-[var(--text-subtle)]">
                                {mergedBlockSubtitles.map((line, j) => (
                                  <li key={`block-${i}-cl-${j}`} className="leading-snug">
                                    {line.replace(/^\u2610\s*/, '')}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="space-y-3">
                              {block.items.map(({ task, microTask }) => {
                                const exam = microTask.examId
                                  ? exams.find((ex) => ex.id === microTask.examId)
                                  : undefined;
                                const idx = Math.max(0, task.microTasks.findIndex((m) => m.id === microTask.id));
                                const stepLabel = microTaskStepLabel(microTask, idx);
                                const rowHeadline =
                                  block.items.length > 1
                                    ? stepLabel
                                    : calendarPrimaryLabelForTimedCluster(task, [{ mt: microTask, idx }]);
                                const subtopicLines =
                                  Array.isArray(microTask.subtopics) && microTask.subtopics.length > 0
                                    ? microTask.subtopics
                                    : [];
                                const ariaStep = subtopicLines[0] ?? stepLabel;
                                return (
                                  <div
                                    key={microTask.id}
                                    className="flex gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] p-2"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={microTask.completed}
                                      onChange={() => toggleMicroTaskComplete(microTask.id)}
                                      aria-label={`Mark done: ${ariaStep}`}
                                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-default)] text-[#788C5D] focus:ring-2 focus:ring-[#D97757]/40"
                                    />
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="text-sm font-heading font-medium text-[var(--foreground)] leading-snug">
                                          {rowHeadline}
                                        </p>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {exam ? (
                                            <Link
                                              href={`/exams/${encodeURIComponent(exam.id)}`}
                                              className="px-2 py-1.5 text-[11px] font-heading font-semibold text-[#D97757] border border-[var(--border-default)] rounded-lg hover:bg-[var(--surface-muted)]"
                                            >
                                              Exam
                                            </Link>
                                          ) : null}
                                          <Link
                                            href={`/focus?task=${task.id}&micro=${microTask.id}`}
                                            className="px-2.5 py-1.5 text-[11px] font-heading font-semibold bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28]"
                                          >
                                            Focus
                                          </Link>
                                        </div>
                                      </div>
                                      {subtopicLines.length > 0 && block.items.length === 1 ? (
                                        <ul className="space-y-0.5 border-l-2 border-[var(--border-default)] pl-2 text-xs text-[var(--text-subtle)]">
                                          {subtopicLines.map((line, j) => (
                                            <li key={`${microTask.id}-sub-${j}`} className="leading-snug">
                                              {line}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : null}
                                      {block.items.length > 1 ? (
                                        <p className="text-[10px] text-[var(--text-muted)] truncate">{task.title}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {dayAgenda.events.map((e) => (
                        <div key={e.id} className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface)]">
                          <p className="text-xs text-[var(--text-muted)] font-heading">
                            {e.allDay ? 'All day' : `${format(e.start, 'h:mm a')} - ${format(e.end, 'h:mm a')}`}
                          </p>
                          <p className="text-sm font-heading font-semibold text-[var(--foreground)]">{e.title}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <details className="mt-8 max-w-2xl rounded-xl border border-[#E8E6DC] bg-white p-4 shadow-sm group/calhelp">
            <summary className="cursor-pointer list-none text-sm font-heading font-semibold text-[#D97757] [&::-webkit-details-marker]:hidden flex items-center gap-2">
              <span className="opacity-70 transition-transform group-open/calhelp:rotate-90">›</span>
              How tasks and events work together
            </summary>
            <p className="mt-3 text-xs text-[#B0AEA5] leading-relaxed pl-4 border-l-2 border-[#E8E6DC]">
              Events block time. Tasks fill the space around them inside your work hours. Exam revision from the planner
              keeps its target days when possible; if a day is full, blocks may shift earlier in the week but stay before
              each task’s due date. Use the AI Task Creator for quick adds—or add tasks and events manually.
            </p>
          </details>
        </main>
      </div>

      <CalendarItemDetailSheet
        open={!!taskDetail}
        onClose={() => setTaskDetail(null)}
        taskId={taskDetail?.taskId ?? null}
        microTaskId={taskDetail?.microTaskId ?? null}
        clusterMicroTaskIds={taskDetail?.clusterMicroTaskIds}
      />

      {showEventModal && (
        <CalendarEventModal
          key={`${selectedEvent?.id || 'new'}-${selectedDate?.toISOString() || 'none'}`}
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(undefined);
          }}
          selectedDate={selectedDate}
          event={selectedEvent}
          onDelete={selectedEvent ? () => handleDelete() : undefined}
        />
      )}
    </div>
  );
}

