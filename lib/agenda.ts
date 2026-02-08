import { isSameDay } from 'date-fns';
import type { CalendarEvent, MicroTask, Task } from '@/types';

function normalizeDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function asDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v as any);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export type DayAgenda = {
  day: Date;
  events: CalendarEvent[];
  taskSteps: Array<{ task: Task; microTask: MicroTask }>;
};

export function getDayAgenda(args: {
  day: Date;
  tasks: Task[];
  calendarEvents: CalendarEvent[];
}): DayAgenda {
  const day = normalizeDay(args.day);

  // Events: include one-offs and weekly repeats for this specific day
  const events: CalendarEvent[] = [];
  for (const base of args.calendarEvents) {
    const start = base.start instanceof Date ? base.start : new Date(base.start);
    const end = base.end instanceof Date ? base.end : new Date(base.end);

    if (isSameDay(start, day)) {
      events.push(base);
      continue;
    }

    // weekly repeats
    if (base.repeat?.frequency === 'weekly' && base.repeat.daysOfWeek?.length) {
      const baseDay = normalizeDay(start);
      if (day < baseDay) continue;
      if (base.repeat.endDate) {
        const repeatEnd = normalizeDay(base.repeat.endDate instanceof Date ? base.repeat.endDate : new Date(base.repeat.endDate));
        if (day > repeatEnd) continue;
      }
      if (!base.repeat.daysOfWeek.includes(day.getDay())) continue;

      const durationMs = end.getTime() - start.getTime();
      const occurrenceStart = new Date(day);
      occurrenceStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

      events.push({
        ...base,
        start: occurrenceStart,
        end: occurrenceEnd,
      });
    }
  }

  // Tasks: include timed micro-tasks (scheduledStart) and day-only planned ones (scheduledDate)
  const taskSteps: Array<{ task: Task; microTask: MicroTask }> = [];
  for (const task of args.tasks) {
    if (task.completed) continue;
    for (const mt of task.microTasks) {
      if (mt.completed) continue;

      // Be defensive: scheduledStart/scheduledEnd may come back as strings after persistence/AI.
      const scheduledStart = asDate((mt as any).scheduledStart);
      const scheduledEnd = asDate((mt as any).scheduledEnd);
      const scheduledDate = asDate((mt as any).scheduledDate);
      const hasTime = !!(scheduledStart && scheduledEnd);

      const normalizedMicroTask: MicroTask = {
        ...mt,
        scheduledStart,
        scheduledEnd,
        scheduledDate,
      };

      if (hasTime && isSameDay(scheduledStart!, day)) {
        taskSteps.push({ task, microTask: normalizedMicroTask });
        continue;
      }

      if (!hasTime && scheduledDate && isSameDay(scheduledDate, day)) {
        taskSteps.push({ task, microTask: normalizedMicroTask });
      }
    }
  }

  const timedFirst = (a: MicroTask, b: MicroTask) => {
    const as = asDate((a as any).scheduledStart);
    const bs = asDate((b as any).scheduledStart);
    const at = as ? as.getTime() : Number.MAX_SAFE_INTEGER;
    const bt = bs ? bs.getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  };

  return {
    day,
    events: events.sort((a, b) => (a.allDay === b.allDay ? (a.start.getTime() - b.start.getTime()) : a.allDay ? -1 : 1)),
    taskSteps: taskSteps.sort((a, b) => timedFirst(a.microTask, b.microTask)),
  };
}

