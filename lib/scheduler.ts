import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import type { CalendarEvent, MicroTask, SchedulePreferences, Task } from '@/types';
import { parseLocalDateKey } from '@/lib/local-date';
import { maxSchedulePrefsWindowMinutes, workWindowMinutesForLocalDay } from '@/lib/work-window';

const MIN_BLOCK_MINUTES = 10;
const MAX_BLOCK_MINUTES = 180;

/** Optional constraints when packing microtasks into clock times. */
export type SchedulePackOptions = {
  /**
   * Earliest minute-of-day (0–1439) for a block start; use when the user asked e.g. "after 5pm".
   * Effective start is max(workStart, this).
   */
  slotEarliestMinutes?: number;
  /** Local yyyy-MM-dd — do not place new blocks on these days (still respect due dates via other days). */
  blockedDateKeys?: Set<string>;
};

/** Merge slot hints with “no scheduling” days from preferences. */
export function mergeSchedulePackOptions(
  prefs: SchedulePreferences,
  base?: SchedulePackOptions
): SchedulePackOptions | undefined {
  const out: SchedulePackOptions = { ...(base ?? {}) };
  if (prefs.noTaskSchedulingDates?.length) {
    out.blockedDateKeys = new Set(prefs.noTaskSchedulingDates);
  }
  const hasSlot = out.slotEarliestMinutes != null && Number.isFinite(out.slotEarliestMinutes);
  const hasBlocked = !!out.blockedDateKeys?.size;
  if (!hasSlot && !hasBlocked) return undefined;
  return out;
}

/**
 * Coerce AI micro-task minutes so they sum to the student's total estimate (integer minutes).
 */
export function normalizeMicroTaskMinutesToTotal<T extends { estimatedMinutes?: unknown }>(
  microTasks: T[],
  targetTotalMinutes: number
): T[] {
  const n = microTasks.length;
  if (n === 0) return [];

  let target = Math.round(Number(targetTotalMinutes));
  if (!Number.isFinite(target)) target = 60;
  target = Math.max(n, target);

  const weights = microTasks.map((mt) => {
    const v = Math.round(Number(mt.estimatedMinutes));
    if (!Number.isFinite(v) || v < 1) return 1;
    return Math.min(MAX_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, v));
  });

  const wsum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((wi) => (target * wi) / wsum);
  const floors = exact.map((x) => Math.floor(x));
  const remainder = target - floors.reduce((a, b) => a + b, 0);
  const fr = exact.map((x, i) => ({ i, f: x - floors[i] }));
  fr.sort((a, b) => b.f - a.f);
  const ints = [...floors];
  for (let k = 0; k < remainder; k++) ints[fr[k % n].i]++;

  for (let g = 0; g < 5000; g++) {
    let delta = target - ints.reduce((a, b) => a + b, 0);
    if (delta === 0) break;
    const order = [...ints.keys()].sort((i, j) =>
      delta > 0
        ? weights[j] - weights[i] || ints[j] - ints[i]
        : ints[i] - ints[j] || weights[j] - weights[i]
    );
    let progressed = false;
    for (const i of order) {
      if (delta === 0) break;
      if (delta > 0 && ints[i] < MAX_BLOCK_MINUTES) {
        ints[i]++;
        delta--;
        progressed = true;
      } else if (delta < 0 && ints[i] > MIN_BLOCK_MINUTES) {
        ints[i]--;
        delta++;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return microTasks.map((mt, i) => ({ ...mt, estimatedMinutes: ints[i] }));
}

/**
 * Assign each step to a calendar date so total estimated minutes is spread across the window
 * (least-loaded day first). Used by the API and mirrors the client packer.
 */
export function applyBalancedScheduleDates<T extends { estimatedMinutes?: unknown; order?: unknown }>(
  microTasks: T[],
  startDay: Date,
  lastScheduleDay: Date
): Array<T & { scheduledDate: string }> {
  const start0 = normalizeDay(startDay);
  const last0 = normalizeDay(lastScheduleDay);
  const validDays: string[] = [];
  for (let d = new Date(start0); d.getTime() <= last0.getTime(); d = addDays(d, 1)) {
    validDays.push(format(d, 'yyyy-MM-dd'));
  }
  if (validDays.length === 0) {
    const fallback = format(start0, 'yyyy-MM-dd');
    return microTasks.map((mt) => ({ ...mt, scheduledDate: fallback }));
  }

  const indexed = microTasks.map((mt, idx) => ({
    mt,
    idx,
    ord: Number.isFinite(Number(mt.order)) ? Number(mt.order) : idx + 1,
  }));
  indexed.sort((a, b) => a.ord - b.ord || a.idx - b.idx);

  const load = new Map<string, number>();
  for (const k of validDays) load.set(k, 0);

  const chosen = new Map<number, string>();
  /** Among days tied for least load, rotate picks so steps spread across the window (not always the earliest day). */
  let spreadCursor = 0;

  for (const { mt, idx } of indexed) {
    const raw = Math.round(Number(mt.estimatedMinutes));
    const duration = Number.isFinite(raw)
      ? Math.min(MAX_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, raw))
      : MIN_BLOCK_MINUTES;

    let minL = Infinity;
    for (const k of validDays) {
      const L = load.get(k)!;
      if (L < minL) minL = L;
    }
    const pool = validDays.filter((k) => load.get(k)! === minL);
    pool.sort((a, b) => a.localeCompare(b));
    const bestK = pool[spreadCursor % pool.length]!;
    spreadCursor++;
    load.set(bestK, minL + duration);
    chosen.set(idx, bestK);
  }

  return microTasks.map((mt, idx) => ({
    ...mt,
    scheduledDate: chosen.get(idx) ?? validDays[0],
  }));
}

/**
 * Pull a monotonic sequence index from a step title (Paper 3, Part 2, Step 4, "1) …", etc.).
 * Returns null when no reliable index is present.
 */
function extractSequentialIndexFromTitle(title: string): number | null {
  const t = String(title || '').trim();
  if (!t) return null;
  const m =
    t.match(/\b(?:paper|papers|part|parts|step|steps|question|questions|q|exercise|exercises|ex|item|items|session|sessions)\s*[#№]?\s*(\d+)\b/i) ||
    t.match(/\bP\s*(\d+)\b/i) ||
    t.match(/^(\d+)\s*[\).:]\s+/);
  if (m) return parseInt(m[1]!, 10);
  const hash = t.match(/^#(\d+)\b/);
  if (hash) return parseInt(hash[1]!, 10);
  return null;
}

/**
 * True when micro-tasks look like a **fixed ordered series** (numbered papers/parts or explicit `order` on every row).
 * Used to avoid least-load balancing that can schedule “Paper 6” before “Paper 1”.
 */
export function microTasksAppearSequenced<T extends { title?: unknown; order?: unknown }>(
  microTasks: T[]
): boolean {
  if (!microTasks || microTasks.length < 2) return false;
  const orders = microTasks.map((m) => Number(m.order));
  if (orders.every((o) => Number.isFinite(o) && o > 0)) {
    let strictInc = true;
    for (let i = 1; i < orders.length; i++) {
      if (orders[i]! <= orders[i - 1]!) {
        strictInc = false;
        break;
      }
    }
    if (strictInc) return true;
  }

  const indices: number[] = [];
  for (const m of microTasks) {
    const idx = extractSequentialIndexFromTitle(String(m.title ?? ''));
    if (idx == null) return false;
    indices.push(idx);
  }
  for (let i = 1; i < indices.length; i++) {
    if (indices[i]! <= indices[i - 1]!) return false;
  }
  return true;
}

/**
 * Assign dates in **list order**: first step gets the earliest day, each next step the next day,
 * remaining steps pile on the last day if the window is shorter than the list.
 */
export function applySequentialScheduleDates<T extends { estimatedMinutes?: unknown; order?: unknown }>(
  microTasks: T[],
  startDay: Date,
  lastScheduleDay: Date
): Array<T & { scheduledDate: string }> {
  const start0 = normalizeDay(startDay);
  const last0 = normalizeDay(lastScheduleDay);
  const validDays: string[] = [];
  for (let d = new Date(start0); d.getTime() <= last0.getTime(); d = addDays(d, 1)) {
    validDays.push(format(d, 'yyyy-MM-dd'));
  }
  if (validDays.length === 0) {
    const fallback = format(start0, 'yyyy-MM-dd');
    return microTasks.map((mt) => ({ ...mt, scheduledDate: fallback }));
  }

  const indexed = microTasks.map((mt, idx) => ({
    mt,
    idx,
    ord: Number.isFinite(Number(mt.order)) ? Number(mt.order) : idx + 1,
  }));
  indexed.sort((a, b) => a.ord - b.ord || a.idx - b.idx);

  const chosen = new Map<number, string>();
  indexed.forEach((row, i) => {
    const dayKey = i < validDays.length ? validDays[i]! : validDays[validDays.length - 1]!;
    chosen.set(row.idx, dayKey);
  });

  return microTasks.map((mt, idx) => ({
    ...mt,
    scheduledDate: chosen.get(idx) ?? validDays[0]!,
  }));
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || '0:0')
    .split(':')
    .map((v) => parseInt(v, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minutesToHHMMFromTotal(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

function buildDayBusyIntervals(args: {
  day: Date;
  wallNow: Date;
  prefs: SchedulePreferences;
  calendarEvents: CalendarEvent[];
  existingTasks: Task[];
  samePackScheduled: Array<{ scheduledStart?: Date; scheduledEnd?: Date }>;
}): Array<{ start: Date; end: Date }> {
  const { day, prefs, calendarEvents, existingTasks, samePackScheduled } = args;
  const day0 = normalizeDay(day);
  const { startMin: workStartMin, endMin: workEndMin } = workWindowMinutesForLocalDay(prefs, day0);
  const recoveryMin = prefs.breakMinutes + prefs.bufferMinutes;
  const intervals: Array<{ start: Date; end: Date }> = [];

  for (const ev of calendarEvents) {
    const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
    const e = ev.end instanceof Date ? ev.end : new Date(ev.end);
    const s0 = normalizeDay(s);

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

    if (ev.repeat.frequency === 'weekly' && ev.repeat.daysOfWeek?.length) {
      if (day0 < s0) continue;
      if (ev.repeat.endDate) {
        const end0 = normalizeDay(ev.repeat.endDate instanceof Date ? ev.repeat.endDate : new Date(ev.repeat.endDate));
        if (day0 > end0) continue;
      }
      if (!ev.repeat.daysOfWeek.includes(day0.getDay())) continue;
      const interval = Math.max(1, Number(ev.repeat.interval) || 1);
      if (interval > 1) {
        const deltaDays = Math.floor((day0.getTime() - s0.getTime()) / (24 * 60 * 60 * 1000));
        const weekBucket = Math.floor(deltaDays / 7);
        if (weekBucket % interval !== 0) continue;
      }

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
      const ss = coerceToDate(mt.scheduledStart);
      const se = coerceToDate(mt.scheduledEnd);
      if (ss && se && isSameDay(ss, day)) {
        intervals.push({ start: ss, end: se });
        intervals.push({
          start: se,
          end: new Date(se.getTime() + recoveryMin * 60_000),
        });
      }
    }
  }

  for (const s of samePackScheduled) {
    const ss = coerceToDate(s.scheduledStart);
    const se = coerceToDate(s.scheduledEnd);
    if (ss && se && isSameDay(ss, day)) {
      intervals.push({ start: ss, end: se });
      intervals.push({
        start: se,
        end: new Date(se.getTime() + recoveryMin * 60_000),
      });
    }
  }

  return intervals;
}

function findFirstGapInBusy(args: {
  day: Date;
  duration: number;
  workStartMin: number;
  workEndMin: number;
  wallNow: Date;
  busy: Array<{ start: Date; end: Date }>;
  bufferMinutes: number;
}): { start: Date; end: Date } | null {
  const { day, duration, workStartMin, workEndMin, wallNow, busy, bufferMinutes } = args;
  let cursorMin = workStartMin;
  if (isSameDay(day, wallNow)) {
    const minsNow = wallNow.getHours() * 60 + wallNow.getMinutes();
    const ceil5 = Math.ceil(minsNow / 5) * 5;
    cursorMin = Math.max(workStartMin, ceil5 + bufferMinutes);
  }
  while (cursorMin + duration <= workEndMin) {
    const slotStart = setTime(day, cursorMin);
    const slotEnd = setTime(day, cursorMin + duration);
    if (!busy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end))) {
      return { start: slotStart, end: slotEnd };
    }
    cursorMin += 5;
  }
  return null;
}

function normalizeDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Drop blocked (no-study) days from the packer’s candidate list.
 * If every day in the original window is blocked, scan forward so “mark day off” can move work
 * to later dates instead of silently keeping blocked days (previous bug).
 */
function applyBlockedDayFilter(days: Date[], blocked: Set<string> | undefined): Date[] {
  if (!blocked?.size) return days;
  const dayKey = (d: Date) => format(normalizeDay(d), 'yyyy-MM-dd');
  const filtered = days.filter((d) => !blocked.has(dayKey(d)));
  if (filtered.length > 0) return filtered;
  const start = normalizeDay(days[0]!);
  const targetCount = Math.max(1, days.length);
  const out: Date[] = [];
  let d = new Date(start);
  for (let guard = 0; guard < 120 && out.length < targetCount; guard++) {
    if (!blocked.has(dayKey(d))) out.push(new Date(d));
    d = addDays(d, 1);
  }
  return out.length > 0 ? out : days;
}

/** Micro-task schedule fields may be ISO strings after persist / sync merge / JSON. */
function coerceToDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export type ScheduledMicroTask = MicroTask & { scheduledStart: Date; scheduledEnd: Date };

function taskHasExamPrepContent(t: Task): boolean {
  return t.microTasks.some(
    (mt) =>
      mt.source === 'exam-planner' ||
      (typeof mt.examId === 'string' && mt.examId.trim() !== '')
  );
}

function isFixedOpenMicroTask(mt: MicroTask): boolean {
  if (!mt.fixedSlot || mt.completed) return false;
  const ss = coerceToDate(mt.scheduledStart);
  const se = coerceToDate(mt.scheduledEnd);
  return !!ss && !!se;
}

function taskHasOpenFixedMicrotask(t: Task): boolean {
  if (t.completed) return false;
  return t.microTasks.some(isFixedOpenMicroTask);
}

/** Open fixed slots from tasks not yet merged into `scheduledSoFar` — avoids double-counting busy intervals. */
function buildPackExistingTasks(
  scheduledSoFar: Task[],
  allFixedOpen: MicroTask[],
  anchorDue: Date
): Task[] {
  const fixedIdsInScheduled = new Set<string>();
  for (const t of scheduledSoFar) {
    for (const mt of t.microTasks) {
      if (isFixedOpenMicroTask(mt)) fixedIdsInScheduled.add(mt.id);
    }
  }
  const remainingFixed = allFixedOpen.filter((mt) => !fixedIdsInScheduled.has(mt.id));
  if (remainingFixed.length === 0) return [...scheduledSoFar];
  const shadow: Task = {
    id: '__global-fixed-shadow__',
    title: '',
    description: undefined,
    dueDate: anchorDue,
    priority: 'medium',
    subject: undefined,
    microTasks: remainingFixed,
    completed: false,
    createdAt: anchorDue,
    estimatedTotalMinutes: 0,
  };
  return [shadow, ...scheduledSoFar];
}

export function rebalanceAllTaskSchedules(args: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  prefs: SchedulePreferences;
  from: Date;
}): Task[] {
  const { tasks, calendarEvents, prefs, from } = args;

  const allFixedOpen: MicroTask[] = [];
  for (const t of tasks) {
    if (t.completed) continue;
    for (const mt of t.microTasks) {
      if (isFixedOpenMicroTask(mt)) allFixedOpen.push(mt);
    }
  }

  const blockedKeys = new Set<string>(args.prefs.noTaskSchedulingDates ?? []);
  const packOptions: SchedulePackOptions | undefined =
    blockedKeys.size > 0 ? { blockedDateKeys: blockedKeys } : undefined;

  const now0 = normalizeDay(from);
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const fa = taskHasOpenFixedMicrotask(a);
    const fb = taskHasOpenFixedMicrotask(b);
    if (fa !== fb) return fa ? -1 : 1;
    // Urgency score: higher = must be scheduled sooner
    const urgencyOf = (t: Task): number => {
      const dd = coerceToDate(t.dueDate);
      const daysLeft = dd ? Math.max(0, differenceInCalendarDays(normalizeDay(dd), now0)) : 30;
      const pw = t.priority === 'high' ? 3 : t.priority === 'low' ? 1 : 2;
      const eb = taskHasExamPrepContent(t) ? 1.5 : 1;
      return (pw * eb) / Math.max(1, daysLeft);
    };
    return urgencyOf(b) - urgencyOf(a);
  });

  const scheduledSoFar: Task[] = [];

  const updated = sortedTasks.map((task) => {
    if (task.completed) return task;
    const preserveDayHints = taskHasExamPrepContent(task);

    const cleared = {
      ...task,
      microTasks: task.microTasks.map((mt) => {
        if (mt.completed) return mt;
        if (isFixedOpenMicroTask(mt)) return { ...mt };
        return {
          ...mt,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          // Keep day hints only for exam-generated prep; normal tasks should be free to move days.
          ...(preserveDayHints ? {} : { scheduledDate: undefined }),
        };
      }),
    };

    const toSchedule = cleared.microTasks.filter((mt) => !mt.completed && !isFixedOpenMicroTask(mt));

    const pack =
      toSchedule.length === 0
        ? { scheduled: [] as ScheduledMicroTask[], unscheduled: [] as MicroTask[], expanded: false }
        : scheduleMicroTasksIntoTimesAdaptive({
          microTasks: toSchedule,
          startDay: from,
          dueDay: task.dueDate,
          prefs,
          calendarEvents,
          existingTasks: buildPackExistingTasks(scheduledSoFar, allFixedOpen, task.dueDate),
          options: packOptions,
        });

    const mergedMicroTasks = cleared.microTasks.map((mt) => {
      if (mt.completed) return mt;
      if (isFixedOpenMicroTask(mt)) {
        const ss = coerceToDate(mt.scheduledStart)!;
        const se = coerceToDate(mt.scheduledEnd)!;
        return {
          ...mt,
          scheduledDate: normalizeDay(ss),
          scheduledStart: ss,
          scheduledEnd: se,
        };
      }
      const found =
        pack.scheduled.find((s) => s.id === mt.id) ||
        pack.unscheduled.find((u) => u.id === mt.id) ||
        null;
      if (!found) return mt;
      const scheduledFound = found as Partial<ScheduledMicroTask> & MicroTask;
      const mergedStart = coerceToDate(scheduledFound.scheduledStart);
      const mergedEnd = coerceToDate(scheduledFound.scheduledEnd);
      const rawSd = scheduledFound.scheduledDate;
      let mergedDate: Date | undefined;
      if (rawSd instanceof Date && !Number.isNaN(rawSd.getTime())) {
        mergedDate = normalizeDay(rawSd);
      } else if (rawSd != null) {
        const s = String(rawSd).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) mergedDate = normalizeDay(parseLocalDateKey(s));
        else {
          const d = coerceToDate(rawSd);
          if (d) mergedDate = normalizeDay(d);
        }
      }
      if (!mergedDate && mergedStart) mergedDate = normalizeDay(mergedStart);
      return {
        ...mt,
        scheduledStart: mergedStart,
        scheduledEnd: mergedEnd,
        scheduledDate: mergedDate,
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
  options?: SchedulePackOptions;
}): { scheduled: ScheduledMicroTask[]; unscheduled: MicroTask[] } {
  const { microTasks, startDay, dueDay, prefs, calendarEvents, existingTasks, options } = args;
  const wallNow = new Date();

  const slotFloor = options?.slotEarliestMinutes;

  const sorted = [...microTasks].sort((a, b) => {
    const oa = Number.isFinite(a.order) ? a.order : 0;
    const ob = Number.isFinite(b.order) ? b.order : 0;
    if (oa !== ob) return oa - ob;
    return a.title.localeCompare(b.title);
  });
  const scheduled: ScheduledMicroTask[] = [];
  const unscheduled: MicroTask[] = [];

  const start = normalizeDay(startDay);
  const due = normalizeDay(dueDay);
  // If the deadline already passed, keep scheduling in a short grace window instead of collapsing
  // everything to one day; this supports "late catch-up" rebalance behavior.
  const effectiveDue = due.getTime() < start.getTime() ? addDays(start, 3) : due;

  const spanDays = Math.max(1, Math.ceil((effectiveDue.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const lastScheduleDay = spanDays >= 3 ? addDays(effectiveDue, -1) : effectiveDue;
  const last0 = normalizeDay(lastScheduleDay);

  let validDayDates: Date[] = [];
  for (let d = new Date(start); d.getTime() <= last0.getTime(); d = addDays(d, 1)) {
    validDayDates.push(new Date(d));
  }
  if (validDayDates.length === 0) {
    validDayDates.push(new Date(start));
  }

  const dayKey = (d: Date) => format(normalizeDay(d), 'yyyy-MM-dd');
  const dayIndexByKey = new Map<string, number>();
  const blocked = options?.blockedDateKeys;
  validDayDates = applyBlockedDayFilter(validDayDates, blocked);
  for (let i = 0; i < validDayDates.length; i++) {
    dayIndexByKey.set(dayKey(validDayDates[i]!), i);
  }
  const plannedLoad = new Map<string, number>();
  for (const d of validDayDates) plannedLoad.set(dayKey(d), 0);

  const workWindowMin = maxSchedulePrefsWindowMinutes(prefs);
  const recoveryMin = prefs.breakMinutes + prefs.bufferMinutes;
  const capFactor =
    prefs.studyPace === 'light'
      ? 0.72
      : prefs.studyPace === 'intensive'
        ? 0.9
        : 0.82;
  const softDailyCap = Math.max(
    MIN_BLOCK_MINUTES + recoveryMin,
    Math.round(workWindowMin * capFactor)
  );

  /** If microtask has scheduledDate in range, try that calendar day first (e.g. AI exam plan). */
  const preferredDayForMicrotask = (mt: MicroTask): Date | null => {
    const raw = mt.scheduledDate;
    if (raw === undefined || raw === null) return null;
    let pd: Date;
    if (raw instanceof Date) {
      pd = normalizeDay(raw);
    } else {
      const s = String(raw).trim();
      pd = /^\d{4}-\d{2}-\d{2}$/.test(s) ? normalizeDay(parseLocalDateKey(s)) : normalizeDay(new Date(s));
    }
    if (pd.getTime() < start.getTime() || pd.getTime() > last0.getTime()) return null;
    if (blocked?.size && blocked.has(dayKey(pd))) return null;
    const inWindow = validDayDates.some((vd) => normalizeDay(vd).getTime() === pd.getTime());
    return inWindow ? pd : null;
  };

  const orderDaysWithPreferredFirst = (preferred: Date | null, duration: number): Date[] => {
    const pool = pickPreferredDayOrder(duration);
    if (!preferred) return pool;
    const pt = preferred.getTime();
    const rest = pool.filter((d) => normalizeDay(d).getTime() !== pt);
    return [preferred, ...rest];
  };

  const tryPlaceOnDay = (
    mt: MicroTask,
    day: Date,
    duration: number,
    opts?: { allowExtendedSameDay?: boolean }
  ): boolean => {
    const dayWin = workWindowMinutesForLocalDay(prefs, day);
    const workStartMin = dayWin.startMin;
    const workEndMin = dayWin.endMin;
    const effectiveWorkStartMin =
      slotFloor != null && Number.isFinite(slotFloor)
        ? Math.max(workStartMin, Math.min(23 * 60 + 59, Math.round(slotFloor)))
        : workStartMin;
    const busy = buildDayBusyIntervals({
      day,
      wallNow,
      prefs,
      calendarEvents,
      existingTasks,
      samePackScheduled: scheduled,
    });
    const gap = findFirstGapInBusy({
      day,
      duration,
      workStartMin: effectiveWorkStartMin,
      workEndMin,
      wallNow,
      busy,
      bufferMinutes: prefs.bufferMinutes,
    });
    if (gap) {
      scheduled.push({
        ...mt,
        scheduledDate: day,
        scheduledStart: gap.start,
        scheduledEnd: gap.end,
      });
      return true;
    }
    if (opts?.allowExtendedSameDay) {
      const extendedGap = findFirstGapInBusy({
        day,
        duration,
        workStartMin: Math.max(6 * 60, effectiveWorkStartMin - 30),
        workEndMin: Math.min(22 * 60 + 30, workEndMin + 60),
        wallNow,
        busy,
        bufferMinutes: prefs.bufferMinutes,
      });
      if (extendedGap) {
        scheduled.push({
          ...mt,
          scheduledDate: day,
          scheduledStart: extendedGap.start,
          scheduledEnd: extendedGap.end,
        });
        return true;
      }
    }
    return false;
  };

  const pickPreferredDayOrder = (duration: number): Date[] => {
    const underCap = validDayDates.filter((d) => {
      const k = dayKey(d);
      return (plannedLoad.get(k) ?? 0) + duration <= softDailyCap;
    });
    const pool = underCap.length > 0 ? underCap : validDayDates;
    const sortedPool = [...pool].sort((a, b) => {
      const ka = dayKey(a);
      const kb = dayKey(b);
      const la = plannedLoad.get(ka) ?? 0;
      const lb = plannedLoad.get(kb) ?? 0;
      if (la !== lb) return la - lb;
      return a.getTime() - b.getTime();
    });
    return sortedPool;
  };

  /**
   * When the AI gave date hints for several sessions (e.g. every weekday), at most one *distinct* microtask
   * may claim a calendar day in this pack. Split parts of the same microtask may share a day.
   * Prevents two different steps piling onto one weekday while others stay empty.
   */
  const strictOneMicrotaskPerHintedDay =
    sorted.filter((mt) => preferredDayForMicrotask(mt) != null).length >= 2;
  const hintedWeekdaySet = new Set<number>();
  for (const mt of sorted) {
    const pd = preferredDayForMicrotask(mt);
    if (pd) hintedWeekdaySet.add(pd.getDay());
  }
  const dayAllowedByHintedWeekdays = (day: Date): boolean => {
    if (!strictOneMicrotaskPerHintedDay) return true;
    if (hintedWeekdaySet.size === 0) return true;
    return hintedWeekdaySet.has(day.getDay());
  };
  const dayPrimaryMicroId = new Map<string, string>();
  const dayAllowsForMicrotask = (day: Date, microId: string): boolean => {
    if (!strictOneMicrotaskPerHintedDay) return true;
    const k = dayKey(day);
    const owner = dayPrimaryMicroId.get(k);
    return owner == null || owner === microId;
  };
  const registerDayOwner = (day: Date, microId: string) => {
    if (!strictOneMicrotaskPerHintedDay) return;
    const k = dayKey(day);
    if (!dayPrimaryMicroId.has(k)) dayPrimaryMicroId.set(k, microId);
  };

  let minAllowedDayIndex = 0;
  for (const mt of sorted) {
    const rawDuration = Math.max(1, Math.round(Number(mt.estimatedMinutes) || MIN_BLOCK_MINUTES));
    let remaining = rawDuration;
    let part = 1;

    while (remaining > 0) {
      const duration = Math.min(MAX_BLOCK_MINUTES, remaining);
      const pieceTitle =
        rawDuration > MAX_BLOCK_MINUTES
          ? `${mt.title} (Part ${part})`
          : mt.title;
      const piece: MicroTask = rawDuration > MAX_BLOCK_MINUTES
        ? { ...mt, title: pieceTitle, estimatedMinutes: duration }
        : { ...mt, estimatedMinutes: duration };
      let placed = false;
      const preferred = preferredDayForMicrotask(mt);
      const tryDays = orderDaysWithPreferredFirst(preferred, duration).filter((d) => {
        const i = dayIndexByKey.get(dayKey(d));
        return (
          (i ?? 0) >= minAllowedDayIndex &&
          dayAllowedByHintedWeekdays(d) &&
          dayAllowsForMicrotask(d, mt.id)
        );
      });

      for (const day of tryDays) {
        const dayIsPreferred =
          preferred != null && normalizeDay(day).getTime() === normalizeDay(preferred).getTime();
        if (tryPlaceOnDay(piece, day, duration, { allowExtendedSameDay: dayIsPreferred })) {
          const k = dayKey(day);
          plannedLoad.set(k, (plannedLoad.get(k) ?? 0) + duration);
          registerDayOwner(day, mt.id);
          const idx = dayIndexByKey.get(k);
          if (idx != null) {
            minAllowedDayIndex = Math.max(minAllowedDayIndex, idx);
          }
          placed = true;
          break;
        }
      }

      if (!placed) {
        for (const day of validDayDates) {
          if (tryDays.some((d) => d.getTime() === day.getTime())) continue;
          const idx = dayIndexByKey.get(dayKey(day));
          if ((idx ?? 0) < minAllowedDayIndex) continue;
          if (!dayAllowedByHintedWeekdays(day)) continue;
          if (!dayAllowsForMicrotask(day, mt.id)) continue;
          if (tryPlaceOnDay(piece, day, duration)) {
            const k = dayKey(day);
            plannedLoad.set(k, (plannedLoad.get(k) ?? 0) + duration);
            registerDayOwner(day, mt.id);
            if (idx != null) {
              minAllowedDayIndex = Math.max(minAllowedDayIndex, idx);
            }
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        unscheduled.push(piece);
      }
      remaining -= duration;
      part += 1;
    }
  }

  return { scheduled, unscheduled };
}

/**
 * Like {@link scheduleMicroTasksIntoTimes}, then widens the work window and finally
 * force-places any leftovers so nothing is dropped — while respecting calendar events
 * and already-packed tasks in existingTasks.
 */
export function scheduleMicroTasksIntoTimesAdaptive(args: {
  microTasks: MicroTask[];
  startDay: Date;
  dueDay: Date;
  prefs: SchedulePreferences;
  calendarEvents: CalendarEvent[];
  existingTasks: Task[];
  options?: SchedulePackOptions;
}): { scheduled: ScheduledMicroTask[]; unscheduled: MicroTask[]; expanded: boolean } {
  const { microTasks, startDay, dueDay, prefs, calendarEvents, existingTasks, options } = args;

  let best = scheduleMicroTasksIntoTimes({
    microTasks,
    startDay,
    dueDay,
    prefs,
    calendarEvents,
    existingTasks,
    options,
  });
  if (best.unscheduled.length === 0) return { ...best, expanded: false };

  let ws = parseTimeToMinutes(prefs.workStart || '16:00');
  let we = parseTimeToMinutes(prefs.workEnd || '20:30');
  const start0 = startOfDay(startDay);
  const due0 = startOfDay(dueDay);
  const effectiveDue0 = due0.getTime() < start0.getTime() ? addDays(start0, 3) : due0;
  const spanDays = Math.max(1, differenceInCalendarDays(effectiveDue0, start0) + 1);
  let expanded = false;

  for (let i = 0; i < 4; i++) {
    const needed = best.unscheduled.reduce(
      (sum, mt) => sum + Math.max(MIN_BLOCK_MINUTES, Math.round(Number(mt.estimatedMinutes) || MIN_BLOCK_MINUTES)),
      0
    );
    if (needed <= 0) break;
    const perDayExtra = Math.max(15, Math.min(90, Math.round(needed / spanDays / 5) * 5 + 10));
    const nextEnd = Math.min(23 * 60, we + perDayExtra);
    // Never shift earlier than the user's work start; overload should extend later instead.
    const nextStart = ws;
    if (nextEnd === we && nextStart === ws) break;
    ws = nextStart;
    we = nextEnd;
    expanded = true;

    const nextPrefs: SchedulePreferences = {
      ...prefs,
      workStart: minutesToHHMMFromTotal(ws),
      workEnd: minutesToHHMMFromTotal(we),
    };
    const attempt = scheduleMicroTasksIntoTimes({
      microTasks,
      startDay,
      dueDay: effectiveDue0,
      prefs: nextPrefs,
      calendarEvents,
      existingTasks,
      options,
    });
    if (attempt.unscheduled.length < best.unscheduled.length) best = attempt;
    if (best.unscheduled.length === 0) break;
  }

  if (best.unscheduled.length === 0) return { ...best, expanded };

  const wallNow = new Date();
  const ws0 = parseTimeToMinutes(prefs.workStart || '16:00');
  const we0 = parseTimeToMinutes(prefs.workEnd || '20:30');
  const slotFloor = options?.slotEarliestMinutes;
  const baseEarliest =
    slotFloor != null && Number.isFinite(slotFloor)
      ? Math.max(ws0, Math.min(23 * 60 + 59, Math.round(slotFloor)))
      : ws0;

  const spanForced = Math.max(1, differenceInCalendarDays(effectiveDue0, start0) + 1);
  const lastDay = spanForced >= 3 ? addDays(effectiveDue0, -1) : effectiveDue0;
  let dayList: Date[] = [];
  for (let d = new Date(start0); d.getTime() <= lastDay.getTime(); d = addDays(d, 1)) {
    dayList.push(new Date(d));
  }
  if (dayList.length === 0) dayList.push(new Date(start0));
  dayList = applyBlockedDayFilter(dayList, options?.blockedDateKeys);

  const tierSet = new Set<string>();
  const tiers: Array<{ ws: number; we: number }> = [];
  const pushTier = (a: number, b: number) => {
    const wsT = Math.max(ws0, Math.min(23 * 60, a));
    const weT = Math.min(23 * 60 + 30, Math.max(wsT + 30, b));
    const k = `${wsT}-${weT}`;
    if (tierSet.has(k)) return;
    tierSet.add(k);
    tiers.push({ ws: wsT, we: weT });
  };
  for (let e = 0; e <= 180; e += 30) {
    pushTier(ws0, we0 + e);
  }

  const forced: ScheduledMicroTask[] = [];
  const stillUnscheduled: MicroTask[] = [];

  for (const mt of best.unscheduled) {
    const duration = Math.max(
      MIN_BLOCK_MINUTES,
      Math.min(MAX_BLOCK_MINUTES, Math.round(Number(mt.estimatedMinutes) || MIN_BLOCK_MINUTES))
    );
    let placed = false;
    tierLoop: for (const { ws: tws, we: twe } of tiers) {
      const es = Math.max(tws, baseEarliest);
      if (es + duration > twe) continue;
      for (const day of dayList) {
        const dayWin = workWindowMinutesForLocalDay(prefs, day);
        const esDay = Math.max(es, dayWin.startMin);
        const tweLocal = Math.min(twe, dayWin.endMin);
        if (esDay + duration > tweLocal) continue;
        const busy = buildDayBusyIntervals({
          day,
          wallNow,
          prefs,
          calendarEvents,
          existingTasks,
          samePackScheduled: [...best.scheduled, ...forced],
        });
        const gap = findFirstGapInBusy({
          day,
          duration,
          workStartMin: esDay,
          workEndMin: tweLocal,
          wallNow,
          busy,
          bufferMinutes: prefs.bufferMinutes,
        });
        if (gap) {
          forced.push({
            ...mt,
            scheduledDate: day,
            scheduledStart: gap.start,
            scheduledEnd: gap.end,
          });
          placed = true;
          break tierLoop;
        }
      }
    }
    if (!placed) stillUnscheduled.push(mt);
  }

  expanded = expanded || forced.length > 0;
  return {
    scheduled: [...best.scheduled, ...forced],
    unscheduled: stillUnscheduled,
    expanded,
  };
}

