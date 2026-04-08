'use client';

import { Task } from '@/types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Play,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { generateMotivationalMessage } from './MotivationalMessages';
import EditTaskModal from './EditTaskModal';
import ConfettiBurst from './ConfettiBurst';
import { parseCalendarDate } from '@/lib/local-date';

interface TaskCardProps {
  task: Task;
}

const priorityStyles = {
  high: 'bg-[#D97757]/12 text-[#b8654a] border-[#D97757]/25',
  medium: 'bg-[#6A9BCC]/12 text-[#4a7aad] border-[#6A9BCC]/25',
  low: 'bg-[#788C5D]/12 text-[#5f6e49] border-[#788C5D]/25',
} as const;

const accentBar = {
  high: 'bg-[#D97757]',
  medium: 'bg-[#6A9BCC]',
  low: 'bg-[#788C5D]',
} as const;

export default function TaskCard({ task }: TaskCardProps) {
  const { toggleMicroTaskComplete, toggleTaskComplete, addMotivationalMessage, updateStats, stats, deleteTask } =
    useStore();
  const [expanded, setExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confettiKey, setConfettiKey] = useState<number>(0);

  const taskDueDate = parseCalendarDate(task.dueDate);
  const completedMicroTasks = task.microTasks.filter((mt) => mt.completed).length;
  const totalMicroTasks = task.microTasks.length;
  const progress = totalMicroTasks > 0 ? completedMicroTasks / totalMicroTasks : 0;

  const isOverdue = isPast(taskDueDate) && !isToday(taskDueDate) && !task.completed;
  const isDueToday = isToday(taskDueDate) && !task.completed;

  const handleMicroTaskToggle = (microTaskId: string) => {
    const mt = task.microTasks.find((m) => m.id === microTaskId);
    const wasDone = !!mt?.completed;
    toggleMicroTaskComplete(microTaskId);
    updateStats();

    const microTask = task.microTasks.find((m) => m.id === microTaskId);
    if (microTask && !wasDone) {
      addMotivationalMessage({
        message: `+5 FocusCoins • ${generateMotivationalMessage('progress', microTask.title, stats)}`,
        type: 'progress',
      });
      setConfettiKey((k) => k + 1);
    } else if (microTask && wasDone) {
      addMotivationalMessage({
        message: 'Undo • -5 FocusCoins',
        type: 'reminder',
      });
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      deleteTask(task.id);
      updateStats();
    }
  };

  const handleCompleteTask = () => {
    const wasDone = task.completed;
    toggleTaskComplete(task.id);
    updateStats();
    if (!wasDone) setConfettiKey((k) => k + 1);
    addMotivationalMessage({
      message: wasDone ? 'Undo • -20 FocusCoins' : '+20 FocusCoins • Task completed',
      type: wasDone ? 'reminder' : 'progress',
    });
  };

  const nextMicroTask = task.microTasks.find((mt) => !mt.completed);

  const nextScheduled =
    task.microTasks
      .filter((mt) => !mt.completed)
      .map((mt) => {
        const start = mt.scheduledStart
          ? mt.scheduledStart instanceof Date
            ? mt.scheduledStart
            : new Date(mt.scheduledStart)
          : null;
        const day = mt.scheduledDate
          ? mt.scheduledDate instanceof Date
            ? mt.scheduledDate
            : new Date(mt.scheduledDate)
          : null;
        return { mt, when: start ? start.getTime() : day ? day.getTime() : Number.MAX_SAFE_INTEGER, start, day };
      })
      .sort((a, b) => a.when - b.when)[0] || null;

  const scheduleLabel = (() => {
    if (!nextScheduled) return null;
    const d = nextScheduled.start || nextScheduled.day;
    if (!d) return null;
    const dayPart = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d');
    const timePart = nextScheduled.start ? format(nextScheduled.start, 'h:mm a') : null;
    return timePart ? `${dayPart}, ${timePart}` : dayPart;
  })();

  return (
    <>
      <div
        className={`relative flex rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
          task.completed
            ? 'border-[#E8E6DC] opacity-[0.72]'
            : isOverdue
              ? 'border-[#D97757]/45 ring-1 ring-[#D97757]/15'
              : 'border-[#E8E6DC]'
        } overflow-hidden`}
      >
        <div
          className={`w-1 shrink-0 ${task.completed ? 'bg-[#E8E6DC]' : accentBar[task.priority]}`}
          aria-hidden
        />
        <div className="flex-1 min-w-0 p-4 sm:p-5">
          {confettiKey > 0 && <ConfettiBurst key={confettiKey} />}

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`mt-0.5 p-1.5 rounded-lg transition-colors ${
                expanded
                  ? 'bg-[#FAF9F5] text-[#6A9BCC]'
                  : 'text-[#B0AEA5] hover:bg-[#FAF9F5] hover:text-[#6A9BCC]'
              }`}
              title={expanded ? 'Hide steps' : 'Show steps'}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <h3
                      className={`font-heading font-semibold text-base sm:text-[17px] text-[#141413] leading-snug ${
                        task.completed ? 'line-through text-[#B0AEA5]' : ''
                      }`}
                    >
                      {task.title}
                    </h3>
                    {!task.completed && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-heading font-semibold uppercase tracking-wide border ${priorityStyles[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-[#6f6d66] mt-1.5 leading-relaxed font-body">{task.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0">
                  <button
                    type="button"
                    onClick={handleCompleteTask}
                    className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-colors ${
                      task.completed
                        ? 'border border-[#E8E6DC] text-[#141413] hover:bg-[#FAF9F5]'
                        : 'bg-[#788C5D] text-white hover:bg-[#6d8054]'
                    }`}
                  >
                    {task.completed ? 'Undo' : 'Mark done'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="p-2 text-[#B0AEA5] hover:text-[#6A9BCC] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 text-[#B0AEA5] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span
                  className={`inline-flex items-center gap-1.5 font-heading ${
                    isOverdue ? 'text-[#D97757] font-semibold' : isDueToday ? 'text-[#6A9BCC] font-semibold' : 'text-[#B0AEA5]'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0 opacity-80" />
                  {format(taskDueDate, 'MMM d, yyyy')}
                  {isOverdue && <span className="text-xs font-medium">· running late</span>}
                  {isDueToday && !isOverdue && <span className="text-xs font-medium">· due today</span>}
                </span>
                {scheduleLabel && !task.completed && (
                  <span className="inline-flex items-center gap-1.5 text-[#B0AEA5] font-heading">
                    <Clock className="w-4 h-4 shrink-0 opacity-80" />
                    {scheduleLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-[#B0AEA5] font-heading">
                  <Clock className="w-4 h-4 shrink-0 opacity-80" />
                  ~{Math.round(task.estimatedTotalMinutes / 60)}h total
                </span>
                {task.subject && (
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FAF9F5] border border-[#E8E6DC] text-xs font-heading font-medium text-[#141413]">
                    {task.subject}
                  </span>
                )}
              </div>

              {totalMicroTasks > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-heading font-medium text-[#141413]">
                      {completedMicroTasks} of {totalMicroTasks} steps
                    </span>
                    <span className="text-sm font-heading font-bold text-[#6A9BCC] tabular-nums">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#E8E6DC] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        task.completed ? 'bg-[#788C5D]' : 'bg-[#D97757]'
                      }`}
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {expanded && (
                <div className="pt-3 border-t border-[#E8E6DC]/90">
                  {task.microTasks.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-heading font-semibold text-[#B0AEA5] uppercase tracking-wide mb-1">
                        Your steps
                      </p>
                      <ul className="space-y-2">
                        {task.microTasks
                          .sort((a, b) => a.order - b.order)
                          .map((microTask, idx) => (
                            <li
                              key={microTask.id}
                              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                microTask.completed
                                  ? 'bg-[#FAF9F5]/80 border-[#E8E6DC]'
                                  : 'bg-white border-[#E8E6DC] hover:border-[#B0AEA5]/80'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleMicroTaskToggle(microTask.id)}
                                className={`shrink-0 mt-0.5 transition-transform hover:scale-105 ${
                                  microTask.completed ? 'text-[#788C5D]' : 'text-[#B0AEA5] hover:text-[#6A9BCC]'
                                }`}
                              >
                                {microTask.completed ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm leading-snug font-medium ${
                                    microTask.completed ? 'text-[#B0AEA5] line-through' : 'text-[#141413]'
                                  }`}
                                >
                                  <span className="text-[#B0AEA5] font-heading font-normal tabular-nums mr-1.5">
                                    {idx + 1}.
                                  </span>
                                  {microTask.title}
                                </p>
                                {microTask.description && (
                                  <p className="text-xs text-[#B0AEA5] mt-1 leading-relaxed font-body">
                                    {microTask.description}
                                  </p>
                                )}
                                <p className="text-[11px] text-[#B0AEA5] font-heading mt-1">{microTask.estimatedMinutes} min</p>
                              </div>
                              {!microTask.completed && (
                                <Link
                                  href={`/focus?task=${task.id}&micro=${microTask.id}`}
                                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141413] text-white text-xs font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Start
                                </Link>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-[#B0AEA5] py-3 text-center rounded-lg bg-[#FAF9F5] border border-dashed border-[#E8E6DC]">
                      No steps yet — open edit to break this down.
                    </p>
                  )}

                  {nextMicroTask && !task.completed && (
                    <div className="mt-4 pt-3 border-t border-[#E8E6DC]/80 flex justify-center sm:justify-start">
                      <Link
                        href={`/focus?task=${task.id}&micro=${nextMicroTask.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#141413] text-white text-sm font-heading font-semibold hover:bg-[#2a2a28] transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        Jump into next step
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEditModal && <EditTaskModal task={task} isOpen={showEditModal} onClose={() => setShowEditModal(false)} />}
    </>
  );
}
