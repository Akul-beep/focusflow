import { addDays, isSameDay } from 'date-fns';
import type { CalendarEvent, MicroTask, SchedulePreferences, Task } from '@/types';

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

function setTime(base: Date, minutesFromMidnight: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesFromMidnight);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type ScheduledMicroTask = MicroTask & { scheduledStart: Date; scheduledEnd: Date };

export function rebalanceAllTaskSchedules(args: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  prefs: SchedulePreferences;
  from: Date;
}): Task[] {
  const { tasks, calendarEvents, prefs, from } = args;
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 } as const;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  const scheduledSoFar: Task[] = [];

  const updated = sortedTasks.map((task) => {
    if (task.completed) return task;

    const cleared = {
      ...task,
      microTasks: task.microTasks.map((mt) =>
        mt.completed
          ? mt
          : {
              ...mt,
              scheduledStart: undefined,
              scheduledEnd: undefined,
              scheduledDate: undefined,
            }
      ),
    };

    const toSchedule = cleared.microTasks.filter((mt) => !mt.completed);
    const scheduled = scheduleMicroTasksIntoTimes({
      microTasks: toSchedule,
      startDay: from,
      dueDay: task.dueDate,
      prefs,
      calendarEvents,
      existingTasks: scheduledSoFar,
    });

    const mergedMicroTasks = cleared.microTasks.map((mt) => {
      if (mt.completed) return mt;
      const found =
        scheduled.scheduled.find((s) => s.id === mt.id) ||
        scheduled.unscheduled.find((u) => u.id === mt.id) ||
        null;
      if (!found) return mt;
      return {
        ...mt,
        scheduledStart: (found as any).scheduledStart,
        scheduledEnd: (found as any).scheduledEnd,
        scheduledDate:
          (found as any).scheduledDate ||
          ((found as any).scheduledStart ? new Date((found as any).scheduledStart) : undefined),
      };
    });

    const updatedTask = { ...task, microTasks: mergedMicroTasks };
    scheduledSoFar.push(updatedTask);
    return updatedTask;
  });

  // preserve original task order in UI
  const byId = new Map(updated.map((t) => [t.id, t]));
  return tasks.map((t) => byId.get(t.id) || t);
}

export function scheduleMicroTasksIntoTimes(args: {
  microTasks: MicroTask[];
  startDay: Date;
  dueDay: Date;
  prefs: SchedulePreferences;
  calendarEvents: CalendarEvent[];
  existingTasks: Task[];
}): { scheduled: ScheduledMicroTask[]; unscheduled: MicroTask[] } {
  const { microTasks, startDay, dueDay, prefs, calendarEvents, existingTasks } = args;
  const now = new Date(startDay);

  const workStartMin = parseTimeToMinutes(prefs.workStart);
  const workEndMin = parseTimeToMinutes(prefs.workEnd);

  const busyIntervalsForDay = (day: Date) => {
    const intervals: Array<{ start: Date; end: Date }> = [];
    const day0 = normalizeDay(day);

    for (const ev of calendarEvents) {
      const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const e = ev.end instanceof Date ? ev.end : new Date(ev.end);
      const s0 = normalizeDay(s);

      // One-off timed events
      if (!ev.repeat) {
        if (ev.allDay) {
          if (isSameDay(s, day0)) {
            intervals.push({ start: setTime(day0, workStartMin), end: setTime(day0, workEndMin) });
          }
          continue;
        }
        if (isSameDay(s, day0)) intervals.push({ start: s, end: e });
        continue;
      }

      // Weekly repeats block time on matching weekdays
      if (ev.repeat.frequency === 'weekly' && ev.repeat.daysOfWeek?.length) {
        if (day0 < s0) continue;
        if (ev.repeat.endDate) {
          const end0 = normalizeDay(ev.repeat.endDate instanceof Date ? ev.repeat.endDate : new Date(ev.repeat.endDate));
          if (day0 > end0) continue;
        }
        if (!ev.repeat.daysOfWeek.includes(day0.getDay())) continue;

        if (ev.allDay) {
          intervals.push({ start: setTime(day0, workStartMin), end: setTime(day0, workEndMin) });
        } else {
          const durationMs = e.getTime() - s.getTime();
          const occStart = new Date(day0);
          occStart.setHours(s.getHours(), s.getMinutes(), 0, 0);
          const occEnd = new Date(occStart.getTime() + durationMs);
          intervals.push({ start: occStart, end: occEnd });
        }
      }
    }

    for (const t of existingTasks) {
      if (t.completed) continue;
      for (const mt of t.microTasks) {
        if (mt.completed) continue;
        if (mt.scheduledStart && mt.scheduledEnd && isSameDay(mt.scheduledStart, day)) {
          intervals.push({ start: mt.scheduledStart, end: mt.scheduledEnd });
        }
      }
    }

    return intervals;
  };

  const sorted = [...microTasks].sort((a, b) => a.order - b.order);
  const scheduled: ScheduledMicroTask[] = [];
  const unscheduled: MicroTask[] = [];

  // Day-by-day packing. Leave a buffer day only when there is enough runway.
  const start = new Date(startDay);
  start.setHours(0, 0, 0, 0);
  const due = new Date(dueDay);
  due.setHours(0, 0, 0, 0);

  const totalDays = Math.max(1, Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const lastScheduleDay = totalDays >= 3 ? addDays(due, -1) : due;

  let dayCursor = new Date(start);
  for (const mt of sorted) {
    let placed = false;
    const duration = Math.max(10, Math.min(180, mt.estimatedMinutes));

    for (let guard = 0; guard < totalDays * 2 && dayCursor <= lastScheduleDay; guard++) {
      const day = new Date(dayCursor);

      // if due day itself and we reserved buffer, don't schedule on due day
      if (day > lastScheduleDay) break;

      const scheduledToday = scheduled.filter((s) => isSameDay(s.scheduledStart, day));
      const busy = busyIntervalsForDay(day).concat(
        scheduledToday.map((s) => ({ start: s.scheduledStart, end: s.scheduledEnd }))
      );
      // Reserve break+buffer after each scheduled focus block to avoid overwhelm + overlap
      const recoveryBlocks = scheduledToday.map((s) => {
        const recoverEnd = new Date(s.scheduledEnd.getTime() + (prefs.breakMinutes + prefs.bufferMinutes) * 60_000);
        return { start: s.scheduledEnd, end: recoverEnd };
      });
      busy.push(...recoveryBlocks);

      let cursorMin = workStartMin;
      // On "today", never schedule in the past.
      if (isSameDay(day, now)) {
        const minsNow = now.getHours() * 60 + now.getMinutes();
        const ceil5 = Math.ceil(minsNow / 5) * 5;
        cursorMin = Math.max(workStartMin, ceil5 + prefs.bufferMinutes);
      }
      while (cursorMin + duration <= workEndMin) {
        const slotStart = setTime(day, cursorMin);
        const slotEnd = setTime(day, cursorMin + duration);

        const collides = busy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
        if (!collides) {
          scheduled.push({
            ...mt,
            scheduledDate: day,
            scheduledStart: slotStart,
            scheduledEnd: slotEnd,
          });
          placed = true;
          break;
        }
        cursorMin += 5; // step search
      }

      if (placed) break;

      // move to next day and retry
      dayCursor = addDays(dayCursor, 1);
    }

    if (!placed) {
      unscheduled.push(mt);
    }
  }

  return { scheduled, unscheduled };
}

