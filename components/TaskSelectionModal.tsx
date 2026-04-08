'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Play, Clock, Calendar } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { MicroTask, Task } from '@/types';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { parseCalendarDate } from '@/lib/local-date';
import { getDayAgenda } from '@/lib/agenda';
import Link from 'next/link';

export type TaskSelectionScope = 'all' | 'today';

interface TaskSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `today` = only steps on your plan for today (matches Today page). `all` = any open step. */
  scheduleScope?: TaskSelectionScope;
}

export default function TaskSelectionModal({
  isOpen,
  onClose,
  scheduleScope = 'all',
}: TaskSelectionModalProps) {
  const { tasks, calendarEvents } = useStore();
  const router = useRouter();
  const [effectiveScope, setEffectiveScope] = useState<TaskSelectionScope>(scheduleScope);

  useEffect(() => {
    if (isOpen) setEffectiveScope(scheduleScope);
  }, [isOpen, scheduleScope]);

  const todaySteps = useMemo(() => {
    if (effectiveScope !== 'today') return null;
    return getDayAgenda({ day: new Date(), tasks, calendarEvents }).taskSteps;
  }, [effectiveScope, tasks, calendarEvents]);

  const tasksToShow = useMemo(() => {
    if (effectiveScope === 'today' && todaySteps) {
      const byTask = new Map<string, { task: Task; microTasks: MicroTask[] }>();
      for (const { task, microTask } of todaySteps) {
        const inc = byTask.get(task.id);
        if (inc) {
          inc.microTasks.push(microTask);
        } else {
          byTask.set(task.id, { task, microTasks: [microTask] });
        }
      }
      return [...byTask.values()].map(({ task, microTasks }) => ({
        ...task,
        dueDate: parseCalendarDate(task.dueDate),
        _todayMicros: microTasks,
      }));
    }

    return tasks
      .filter((t) => !t.completed)
      .map((task) => ({
        ...task,
        dueDate: parseCalendarDate(task.dueDate),
        _todayMicros: null as null,
      }))
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
  }, [effectiveScope, tasks, todaySteps]);

  if (!isOpen) return null;

  const handleSelectMicroTask = (taskId: string, microTaskId: string) => {
    router.push(`/focus?task=${taskId}&micro=${microTaskId}`);
    onClose();
  };

  const priorityColors = {
    high: 'bg-[#D97757]/10 text-[#D97757] border-[#D97757]/20',
    medium: 'bg-[#6A9BCC]/10 text-[#6A9BCC] border-[#6A9BCC]/20',
    low: 'bg-[#788C5D]/10 text-[#788C5D] border-[#788C5D]/20',
  };

  const title =
    effectiveScope === 'today' ? 'Change step — today' : 'Change step — all open';
  const subtitle =
    effectiveScope === 'today'
      ? 'Steps on your calendar for today (same as the Today page).'
      : 'Any incomplete step on your tasks — pick what you want to focus on.';

  const hasRows = tasksToShow.some((task) => {
    const micros =
      effectiveScope === 'today' && task._todayMicros
        ? task._todayMicros
        : task.microTasks.filter((mt) => !mt.completed);
    return micros.length > 0;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-xl text-[#141413]">{title}</h2>
            <p className="text-sm text-[#B0AEA5] mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!hasRows ? (
            <div className="text-center py-12 px-2">
              {effectiveScope === 'today' ? (
                <>
                  <p className="text-[#141413] font-heading font-medium mb-2">Nothing scheduled for today</p>
                  <p className="text-sm text-[#B0AEA5] mb-6 max-w-md mx-auto leading-relaxed">
                    If you still want to study, pick any open step from your backlog — or plan today on the Calendar.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEffectiveScope('all')}
                      className="px-6 py-3 bg-[#D97757] text-white rounded-lg font-heading font-semibold hover:bg-[#c96b4f] transition-colors text-center"
                    >
                      Show all open steps
                    </button>
                    <Link
                      href="/today"
                      onClick={onClose}
                      className="px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors text-center"
                    >
                      Go to Today
                    </Link>
                    <Link
                      href="/calendar"
                      onClick={onClose}
                      className="px-6 py-3 border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors text-center"
                    >
                      Calendar
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[#B0AEA5] mb-4">No active tasks available</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push('/dashboard');
                    }}
                    className="px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
                  >
                    Add task
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {tasksToShow.map((task) => {
                const incompleteMicroTasks =
                  effectiveScope === 'today' && task._todayMicros
                    ? task._todayMicros
                    : task.microTasks.filter((mt) => !mt.completed);

                if (incompleteMicroTasks.length === 0) return null;

                return (
                  <div
                    key={task.id}
                    className="border border-[#E8E6DC] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="bg-[#FAF9F5] px-5 py-4 border-b border-[#E8E6DC]">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-semibold text-lg text-[#141413] mb-2 truncate">
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span>{format(task.dueDate, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                              <Clock className="w-4 h-4 shrink-0" />
                              <span>{Math.round(task.estimatedTotalMinutes / 60)}h</span>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-heading font-medium border ${priorityColors[task.priority]}`}
                            >
                              {task.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      {incompleteMicroTasks
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((microTask) => {
                          const start = microTask.scheduledStart
                            ? new Date(microTask.scheduledStart as Date | string)
                            : null;
                          const end = microTask.scheduledEnd
                            ? new Date(microTask.scheduledEnd as Date | string)
                            : null;
                          const timeHint =
                            start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
                              ? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`
                              : null;

                          return (
                            <button
                              key={microTask.id}
                              type="button"
                              onClick={() => handleSelectMicroTask(task.id, microTask.id)}
                              className="w-full flex items-center justify-between p-4 bg-white border border-[#E8E6DC] rounded-lg hover:bg-[#FAF9F5] hover:border-[#6A9BCC] transition-all group text-left"
                            >
                              <div className="flex-1 text-left min-w-0">
                                <p className="font-body font-medium text-[#141413] mb-1 group-hover:text-[#6A9BCC] transition-colors">
                                  {microTask.title}
                                </p>
                                {microTask.description ? (
                                  <p className="text-sm text-[#B0AEA5] line-clamp-1">{microTask.description}</p>
                                ) : null}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs text-[#B0AEA5] font-heading">
                                    ~{microTask.estimatedMinutes} min
                                  </span>
                                  {timeHint ? (
                                    <span className="text-xs text-[#6A9BCC] font-heading">{timeHint}</span>
                                  ) : null}
                                </div>
                              </div>
                              <Play className="w-5 h-5 text-[#B0AEA5] group-hover:text-[#6A9BCC] transition-colors ml-4 shrink-0" />
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
