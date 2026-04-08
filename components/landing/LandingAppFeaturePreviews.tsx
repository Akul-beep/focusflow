"use client";

import type { MicroTask, Task } from "@/types";
import TreeForest from "@/components/TreeForest";
import {
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  Play,
  Plus,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as fmt,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

const ease = [0.22, 1, 0.36, 1] as const;

const priorityStyles = {
  high: "bg-[#D97757]/12 text-[#b8654a] border-[#D97757]/25",
  medium: "bg-[#6A9BCC]/12 text-[#4a7aad] border-[#6A9BCC]/25",
  low: "bg-[#788C5D]/12 text-[#5f6e49] border-[#788C5D]/25",
} as const;

const accentBar = {
  high: "bg-[#D97757]",
  medium: "bg-[#6A9BCC]",
  low: "bg-[#788C5D]",
} as const;

/** Demo task: mirrors real `TaskCard` layout (collapsed), no store. */
const DEMO_MICRO: MicroTask[] = [
  {
    id: "ld-mt-1",
    title: "Curate three objects + rationale",
    description: "Photos plus two or three sentences each",
    estimatedMinutes: 40,
    completed: true,
    parentTaskId: "landing-demo-task",
    order: 0,
  },
  {
    id: "ld-mt-2",
    title: "Draft commentary script",
    description: "",
    estimatedMinutes: 55,
    completed: false,
    parentTaskId: "landing-demo-task",
    order: 1,
    scheduledStart: new Date(2026, 3, 5, 16, 0),
    scheduledDate: new Date(2026, 3, 5),
  },
  {
    id: "ld-mt-3",
    title: "Dry run + timing",
    estimatedMinutes: 25,
    completed: false,
    parentTaskId: "landing-demo-task",
    order: 2,
  },
];

const DEMO_TASK: Task = {
  id: "landing-demo-task",
  title: "Research fair exhibit",
  description: "Curate objects and short explanations for the walkthrough.",
  dueDate: new Date(2026, 3, 14),
  priority: "high",
  subject: "Science",
  microTasks: DEMO_MICRO,
  completed: false,
  createdAt: new Date(2026, 2, 1),
  estimatedTotalMinutes: 180,
};

function scheduleLabelForTask(task: Task): string | null {
  const next = task.microTasks
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
    .sort((a, b) => a.when - b.when)[0];
  if (!next) return null;
  const d = next.start || next.day;
  if (!d) return null;
  const dayPart = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "MMM d");
  const timePart = next.start ? format(next.start, "h:mm a") : null;
  return timePart ? `${dayPart}, ${timePart}` : dayPart;
}

/**
 * Static clone of collapsed `TaskCard`. Same structure/classes as the app, no zustand.
 */
export function LandingTaskCardPreview() {
  const task = DEMO_TASK;
  const taskDueDate = task.dueDate;
  const completedMicroTasks = task.microTasks.filter((mt) => mt.completed).length;
  const totalMicroTasks = task.microTasks.length;
  const progress = totalMicroTasks > 0 ? completedMicroTasks / totalMicroTasks : 0;
  const isOverdue = false;
  const isDueToday = isToday(taskDueDate) && !task.completed;
  const scheduleLabel = scheduleLabelForTask(task);

  return (
    <div
      className={`relative flex rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        task.completed
          ? "border-[#E8E6DC] opacity-[0.72]"
          : isOverdue
            ? "border-[#D97757]/45 ring-1 ring-[#D97757]/15"
            : "border-[#E8E6DC]"
      } overflow-hidden`}
    >
      <div
        className={`w-1 shrink-0 ${task.completed ? "bg-[#E8E6DC]" : accentBar[task.priority]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 rounded-lg p-1.5 text-[#B0AEA5]"
            aria-hidden
            title="Show steps"
          >
            <ChevronDown className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h3
                    className={`font-heading text-base font-semibold leading-snug text-[#141413] sm:text-[17px] ${
                      task.completed ? "text-[#B0AEA5] line-through" : ""
                    }`}
                  >
                    {task.title}
                  </h3>
                  {!task.completed && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-heading text-[11px] font-semibold uppercase tracking-wide ${priorityStyles[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-[#6f6d66]">{task.description}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                <span className="rounded-lg border border-[#E8E6DC] px-3 py-1.5 font-heading text-xs font-semibold text-[#141413]">
                  Mark done
                </span>
                <span className="rounded-lg p-2 text-[#B0AEA5]" aria-hidden title="Edit">
                  <Edit2 className="h-4 w-4" />
                </span>
                <span className="rounded-lg p-2 text-[#B0AEA5]" aria-hidden title="Delete">
                  <Trash2 className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 font-heading ${
                  isOverdue
                    ? "font-semibold text-[#D97757]"
                    : isDueToday
                      ? "font-semibold text-[#6A9BCC]"
                      : "text-[#B0AEA5]"
                }`}
              >
                <Calendar className="h-4 w-4 shrink-0 opacity-80" />
                {format(taskDueDate, "MMM d, yyyy")}
                {isDueToday && !isOverdue && <span className="text-xs font-medium">· due today</span>}
              </span>
              {scheduleLabel && !task.completed && (
                <span className="inline-flex items-center gap-1.5 font-heading text-[#B0AEA5]">
                  <Clock className="h-4 w-4 shrink-0 opacity-80" />
                  {scheduleLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-heading text-[#B0AEA5]">
                <Clock className="h-4 w-4 shrink-0 opacity-80" />~{Math.round(task.estimatedTotalMinutes / 60)}h total
              </span>
              {task.subject && (
                <span className="rounded-md border border-[#E8E6DC] bg-[#FAF9F5] px-2.5 py-0.5 font-heading text-xs font-medium text-[#141413]">
                  {task.subject}
                </span>
              )}
            </div>

            {totalMicroTasks > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-heading text-xs font-medium text-[#141413]">
                    {completedMicroTasks} of {totalMicroTasks} steps
                  </span>
                  <span className="font-heading text-sm font-bold tabular-nums text-[#6A9BCC]">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E6DC]">
                  <div
                    className={`h-full rounded-full ${task.completed ? "bg-[#788C5D]" : "bg-[#D97757]"}`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const EXAM_ROWS = [
  {
    badge: "12d left",
    badgeClass: "border border-[#E8E6DC] bg-[#FAF9F5] text-[#141413]",
    subject: "Science",
    name: "Physics unit test",
    date: "Wednesday, Apr 17, 2026",
  },
  {
    badge: "Today",
    badgeClass: "bg-[#D97757]/15 text-[#b35a40]",
    subject: "English",
    name: "Recorded oral",
    date: "Saturday, Apr 5, 2026",
  },
] as const;

/** Same exam row chrome as `ExamsListPage` / `ExamsListScreenMock`. */
export function LandingExamListPreview() {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] p-4 shadow-[0_24px_80px_rgba(20,20,19,0.08)]">
      <div className="mb-3 px-1">
        <p className="font-heading text-sm font-semibold text-[#141413]">Exams</p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-[#6f6d66]">
          Open one for syllabus topics, coverage, and repack. Bulk planner lives under Add task on the dashboard so prep feels planned, not last minute.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3">
        {EXAM_ROWS.map((exam) => (
          <li key={exam.name}>
            <div className="group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-white shadow-sm">
              <div className="w-1.5 shrink-0 bg-gradient-to-b from-[#D97757] to-[#6A9BCC]" aria-hidden />
              <div className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] transition-colors group-hover:bg-white">
                  <CalendarDays className="h-6 w-6 text-[#D97757]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 gap-y-1">
                    <span
                      className={`rounded-md px-2 py-0.5 font-heading text-[11px] font-semibold uppercase tracking-wide ${exam.badgeClass}`}
                    >
                      {exam.badge}
                    </span>
                    <span className="truncate font-heading text-xs text-[#B0AEA5]">{exam.subject}</span>
                  </div>
                  <p className="truncate font-heading text-lg font-bold leading-tight text-[#141413] transition-colors group-hover:text-[#D97757]">
                    {exam.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[#B0AEA5]">
                    <span className="tabular-nums">{exam.date}</span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#B0AEA5] transition-colors group-hover:text-[#D97757]" aria-hidden />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TODAY_STEPS = [
  {
    subject: "Physics",
    task: "Practice test · Section A",
    step: "Timed attempt, 45m",
    minutes: 45,
    done: false,
    time: "4:30 PM",
  },
  {
    subject: "English",
    task: "Oral prep",
    step: "Main idea bullets",
    minutes: 25,
    done: false,
    time: "6:00 PM",
  },
  {
    subject: "Math",
    task: "Review set",
    step: "Mixed questions 1 to 8",
    minutes: 35,
    done: true,
    time: "Done",
  },
] as const;

/** Matches `TodayPage` step rows: scheduled blocks for the current day. */
export function LandingTodayAgendaPreview() {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] p-4 shadow-[0_24px_80px_rgba(20,20,19,0.08)]">
      <div className="mb-4 flex flex-col gap-3 border-b border-[#E8E6DC] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#141413]">Today</h3>
          <p className="mt-0.5 font-body text-xs leading-relaxed text-[#6f6d66] sm:text-sm">
            After adaptive scheduling or a rebalance, this is what to run now. Tap Focus on the next block.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E8E6DC] bg-white px-3 font-heading text-xs font-medium text-[#141413]">
            <Sparkles className="h-3.5 w-3.5 text-[#D97757]" aria-hidden />
            Replan week
          </span>
          <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#D97757] px-3 font-heading text-xs font-semibold text-white">
            <Timer className="h-3.5 w-3.5" aria-hidden />
            Start next step
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {TODAY_STEPS.map((s) => (
          <div
            key={s.step}
            className={`flex flex-col gap-3 rounded-2xl border border-[#E8E6DC] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
              s.done ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[#E8E6DC] bg-[#FAF9F5] px-2 py-0.5 font-heading text-[11px] font-medium text-[#141413]">
                  {s.subject}
                </span>
                <span className="font-heading text-xs text-[#B0AEA5]">{s.task}</span>
              </div>
              <p className="font-heading text-base font-semibold text-[#141413]">{s.step}</p>
              <p className="mt-1 flex items-center gap-1.5 font-heading text-xs text-[#B0AEA5]">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {s.minutes} min block
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-2 font-heading text-sm font-semibold tabular-nums text-[#141413]">
                {s.time}
              </span>
              {s.done ? (
                <span className="font-heading text-xs font-semibold text-[#788C5D]">Complete</span>
              ) : (
                <span className="rounded-lg bg-[#141413] px-4 py-2 font-heading text-xs font-semibold text-white">
                  Focus
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIPELINE_MICRO = [
  { title: "Read rubric and pull criteria", min: 25 },
  { title: "Bullet main talking points", min: 35 },
  { title: "Timed dry run plus timing notes", min: 40 },
] as const;

/**
 * `AddTaskModal` task flow plus compact AI review. Matches the real pipeline:
 * AI breakdown → adaptive scheduling into the calendar (work window, buffers, rebalance).
 */
export function LandingAiSchedulingPipelinePreview() {
  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="overflow-hidden rounded-lg border border-[#E8E6DC] bg-white shadow-[0_24px_80px_rgba(20,20,19,0.1)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#E8E6DC] p-5 sm:p-6">
          <div>
            <h2 className="mb-1 font-heading text-xl font-bold text-[#141413] sm:text-2xl">Add task</h2>
            <p className="text-sm leading-snug text-[#57544d]">
              AI drafts steps. Adaptive scheduling drops them on your calendar. Rebalance any time the week slips.
            </p>
          </div>
          <span className="shrink-0 rounded-lg p-2 text-[#B0AEA5]" aria-hidden>
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <span className="mb-2 block font-heading text-sm font-medium text-[#141413]">Task Title *</span>
            <div className="w-full rounded-lg border border-[#E8E6DC] px-4 py-3 font-body text-sm text-[#141413]">
              History unit exam prep (chapters 10 to 12)
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="mb-2 block font-heading text-sm font-medium text-[#141413]">Due Date *</span>
              <div className="w-full rounded-lg border border-[#E8E6DC] px-4 py-3 font-body text-sm text-[#141413]">
                2026-04-22
              </div>
            </div>
            <div>
              <span className="mb-2 block font-heading text-sm font-medium text-[#141413]">How long? *</span>
              <div className="w-full rounded-lg border border-[#E8E6DC] px-4 py-3 font-body text-sm text-[#141413]">
                4 hours
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-[#6A9BCC]/35 bg-[#6A9BCC]/[0.06] p-3">
            <p className="font-heading text-xs font-semibold text-[#141413]">Adaptive scheduling</p>
            <p className="mt-1 font-body text-xs leading-relaxed text-[#6f6d66]">
              Per-step estimates, then packing around school and buffers. Fall behind? Rebalance refits the open work so
              no single day has to carry the whole course.
            </p>
          </div>
          <div className="flex gap-3 border-t border-[#E8E6DC] pt-5">
            <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#141413] px-4 py-3 font-heading text-sm font-medium text-white">
              <Plus className="h-4 w-4" aria-hidden />
              Create task
            </span>
            <span className="rounded-lg border border-[#E8E6DC] px-4 py-3 font-heading text-sm font-medium text-[#141413]">
              Cancel
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E8E6DC] bg-white shadow-[0_16px_48px_rgba(20,20,19,0.06)]">
        <div className="flex items-center gap-3 border-b border-[#E8E6DC] px-4 py-3 sm:px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6A9BCC]/20 to-[#788C5D]/20">
            <Check className="h-4 w-4 text-[#6A9BCC]" aria-hidden />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-[#141413] sm:text-base">AI Task Preview</h3>
            <p className="text-[11px] text-[#B0AEA5]">Review before creating</p>
          </div>
        </div>
        <ul className="space-y-2 p-4 sm:p-5">
          {PIPELINE_MICRO.map((m, idx) => (
            <li key={m.title} className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-sm font-medium text-[#141413]">
                  {idx + 1}. {m.title}
                </p>
                <span className="shrink-0 font-heading text-xs text-[#B0AEA5]">{m.min} min</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const RADIUS = 120;
const CIRC = 2 * Math.PI * RADIUS;

/** Timer + forest strip matching `FocusPage` session card (static). */
export function LandingFocusSessionPreview() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-[#E8E6DC] bg-white p-6 shadow-[0_24px_80px_rgba(20,20,19,0.08)] sm:p-8">
      <div className="flex flex-col items-center">
        <div className="relative mb-6 h-56 w-56 sm:mb-8 sm:h-64 sm:w-64">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 256 256" aria-hidden>
            <circle cx="128" cy="128" r={RADIUS} fill="none" stroke="#E8E6DC" strokeWidth="10" />
            <motion.circle
              cx="128"
              cy="128"
              r={RADIUS}
              fill="none"
              stroke="#141413"
              strokeWidth="10"
              strokeDasharray={CIRC}
              strokeLinecap="round"
              initial={{ strokeDashoffset: CIRC }}
              whileInView={{ strokeDashoffset: CIRC * 0.38 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 1.05, ease }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mb-1 font-heading text-5xl font-bold tabular-nums text-[#141413] sm:text-6xl">18:24</span>
            <span className="font-heading text-xs text-[#B0AEA5]">Focus session</span>
          </div>
        </div>

        <p className="mb-4 max-w-sm text-center font-body text-xs leading-relaxed text-[#6f6d66]">
          Timer on the step you picked, forest growth for streaks, light motivation so the block feels doable.
        </p>

        <div className="mb-6 w-full max-w-xl text-center">
          <p className="mb-2 font-heading text-xs uppercase tracking-wide text-[#B0AEA5]">Current step</p>
          <p className="mb-2 font-heading text-lg font-semibold text-[#141413]">Draft commentary script</p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-1.5">
            <Clock className="h-4 w-4 text-[#D97757]" />
            <span className="font-heading text-xs text-[#141413]">~55 minutes</span>
          </div>
        </div>

        <div className="mb-6 w-full max-w-sm">
          <TreeForest
            variant="compact"
            showFocusHint={false}
            previewGrowth={{ totalFocusMinutes: 72, microTasksCompleted: 4 }}
            extraGrowthMinutes={18}
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-2 rounded-lg bg-[#141413] px-8 py-3 font-heading font-medium text-white">
            <Play className="h-5 w-5" aria-hidden />
            Start focus
          </span>
        </div>
      </div>
    </div>
  );
}

const CAL_ANCHOR = new Date(2026, 3, 5);
const WEEK_OPTS = { weekStartsOn: 0 as const };

/** Month grid shell matching `ScheduleCalendar` month view (static chips). */
export function LandingScheduleMonthPreview() {
  const ms = startOfMonth(CAL_ANCHOR);
  const me = endOfMonth(CAL_ANCHOR);
  const gridStart = startOfWeek(ms, WEEK_OPTS);
  const gridEnd = endOfWeek(me, WEEK_OPTS);
  const monthGridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const chipsByDay = new Map<string, { time?: string; title: string; color: string }[]>();
  const addChip = (d: Date, chip: { time?: string; title: string; color: string }) => {
    const key = fmt(d, "yyyy-MM-dd");
    const prev = chipsByDay.get(key) ?? [];
    prev.push(chip);
    chipsByDay.set(key, prev);
  };
  addChip(new Date(2026, 3, 7), { time: "9:00 AM", title: "Chemistry test review", color: "#6A9BCC" });
  addChip(new Date(2026, 3, 8), { title: "Research fair work block", color: "#8884B5" });
  addChip(new Date(2026, 3, 9), { time: "3:30 PM", title: "Math study group", color: "#788C5D" });
  addChip(CAL_ANCHOR, { time: "4:00 PM", title: "English oral dry run", color: "#D97757" });

  return (
    <div className="schedule-view-card w-full max-w-xl min-w-0 rounded-xl border border-[#E8E6DC] bg-white p-4 shadow-[0_24px_80px_rgba(20,20,19,0.08)] sm:p-5">
      <h2 className="mb-3 font-heading text-lg font-semibold text-[#141413] sm:text-xl">Schedule</h2>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 font-heading text-sm font-medium text-[#141413]">
            ←
          </span>
          <span className="rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 font-heading text-sm font-medium text-[#141413]">
            Today
          </span>
          <span className="rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 font-heading text-sm font-medium text-[#141413]">
            →
          </span>
        </div>
        <h3 className="min-w-[10rem] text-center font-heading text-base font-semibold text-[#141413] sm:text-left">
          April 2026
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-[#E8E6DC]">
          <span className="bg-[#D97757] px-3 py-2 font-heading text-sm font-medium capitalize text-white sm:px-4">month</span>
          <span className="bg-white px-3 py-2 font-heading text-sm font-medium capitalize text-[#B0AEA5] sm:px-4">week</span>
          <span className="bg-white px-3 py-2 font-heading text-sm font-medium capitalize text-[#B0AEA5] sm:px-4">day</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]/40">
        <div className="grid grid-cols-7 border-b border-[#E8E6DC] bg-white">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center font-heading text-xs font-semibold text-[#B0AEA5]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid auto-rows-fr grid-cols-7 bg-white">
          {monthGridDays.map((day) => {
            const key = fmt(day, "yyyy-MM-dd");
            const visible = chipsByDay.get(key) ?? [];
            const isPreviewToday = isSameDay(day, CAL_ANCHOR);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex min-h-[4.5rem] flex-col border-b border-r border-[#E8E6DC] p-1 sm:min-h-[5.5rem]",
                  !isSameMonth(day, CAL_ANCHOR) ? "bg-[#FAF9F5]/80" : ""
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-heading text-xs font-semibold",
                    isPreviewToday
                      ? "bg-[#D97757] text-white"
                      : isSameMonth(day, CAL_ANCHOR)
                        ? "text-[#141413]"
                        : "text-[#B0AEA5]"
                  )}
                >
                  {fmt(day, "d")}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                  {visible.map((it, i) => (
                    <div
                      key={`${key}-${i}`}
                      className="truncate rounded border border-black/10 px-1 py-0.5 text-left text-[10px] leading-tight shadow-sm sm:text-[11px]"
                      style={{
                        backgroundColor: it.color,
                        borderLeftWidth: 3,
                        borderLeftColor: it.color,
                        color: "#141413",
                      }}
                    >
                      {it.time ? `${it.time} ` : ""}
                      {it.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const AI_PREVIEW_MICRO: MicroTask[] = [
  {
    id: "ai-1",
    title: "Read rubric + extract criteria",
    description: "Highlight command terms and weightings.",
    estimatedMinutes: 25,
    completed: false,
    parentTaskId: "ai-task",
    order: 0,
  },
  {
    id: "ai-2",
    title: "Bullet main talking points",
    estimatedMinutes: 35,
    completed: false,
    parentTaskId: "ai-task",
    order: 1,
  },
  {
    id: "ai-3",
    title: "Time a full dry run (record if helpful)",
    estimatedMinutes: 40,
    completed: false,
    parentTaskId: "ai-task",
    order: 2,
  },
];

/** In-app AI task preview body (from `TaskPreviewModal`), as a static card. */
export function LandingAiTaskPreview() {
  const due = new Date(2026, 3, 18);
  const priorityColors = {
    high: "border-[#D97757]/20 bg-[#D97757]/10 text-[#D97757]",
    medium: "border-[#6A9BCC]/20 bg-[#6A9BCC]/10 text-[#6A9BCC]",
    low: "border-[#788C5D]/20 bg-[#788C5D]/10 text-[#788C5D]",
  } as const;
  const estHours = (100 / 60).toFixed(1);

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#E8E6DC] bg-white shadow-[0_24px_80px_rgba(20,20,19,0.08)]">
      <div className="flex items-center justify-between border-b border-[#E8E6DC] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#6A9BCC]/20 to-[#788C5D]/20">
            <Check className="h-5 w-5 text-[#6A9BCC]" aria-hidden />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-[#141413] sm:text-xl">AI Task Preview</h2>
            <p className="text-xs text-[#B0AEA5]">Review before creating</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="mb-2 font-heading text-lg font-bold text-[#141413]">English oral, final prep</h3>
          <p className="mb-4 font-body text-sm leading-relaxed text-[#B0AEA5]">
            Draft feels huge. Split it without losing the through-line.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
              <Calendar className="h-4 w-4" aria-hidden />
              <span>Due: {format(due, "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
              <Clock className="h-4 w-4" aria-hidden />
              <span>{estHours} hours</span>
            </div>
            <span
              className={`rounded-lg border px-3 py-1 font-heading text-xs font-medium ${priorityColors.high}`}
            >
              HIGH
            </span>
            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
              <Tag className="h-4 w-4" aria-hidden />
              <span>English A</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-heading text-base font-semibold text-[#141413]">
              Micro-Tasks ({AI_PREVIEW_MICRO.length})
            </h4>
            <span className="font-heading text-xs font-medium text-[#6A9BCC]">Collapse</span>
          </div>
          <div className="space-y-2">
            {AI_PREVIEW_MICRO.map((microTask, idx) => (
              <div key={microTask.id} className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="mb-1 font-heading text-sm font-medium text-[#141413]">
                      {idx + 1}. {microTask.title}
                    </p>
                    {microTask.description && (
                      <p className="font-body text-xs text-[#B0AEA5]">{microTask.description}</p>
                    )}
                  </div>
                  <span className="ml-3 font-heading text-xs text-[#B0AEA5]">{microTask.estimatedMinutes} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E8E6DC] pt-4">
          <span className="rounded-lg border border-[#E8E6DC] px-6 py-3 font-heading font-medium text-[#141413]">Edit</span>
          <span className="rounded-lg bg-[#141413] px-6 py-3 font-heading font-medium text-white">Create Task</span>
        </div>
      </div>
    </div>
  );
}
