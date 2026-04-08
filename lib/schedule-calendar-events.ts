import { addDays, format } from 'date-fns';
import type { CalendarEvent, MicroTask, Task } from '@/types';

export type ScheduleCalendarItemKind = 'calendar' | 'task';

/** Normalized item for rendering. Intervals are half-open [start, end) where possible; timed events use real end instants (still work with intersection tests below). */
export interface ScheduleCalendarItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  kind: ScheduleCalendarItemKind;
  calendarEvent?: CalendarEvent;
  taskId?: string;
  microTaskId?: string;
  clusterMicroTaskIds?: string[];
  estimatedMinutes?: number;
  dayPlan?: boolean;
}

function normalizeDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function coerceScheduledDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    const sec = (v as { seconds: unknown }).seconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function taskCalendarColor(task: Task, calendarOverride?: string): string {
  const o = calendarOverride?.trim();
  if (o) return o;
  return task.priority === 'high' ? '#D97757' : task.priority === 'medium' ? '#6A9BCC' : '#788C5D';
}

/** Fallback when an event has no custom `color` (Settings default → event type). */
export function defaultColorForEventType(t: CalendarEvent['eventType']): string {
  switch (t) {
    case 'class':
      return '#6A9BCC';
    case 'meeting':
    case 'study':
      return '#788C5D';
    case 'task':
      return '#8884B5';
    case 'event':
      return '#C4A574';
    case 'other':
    default:
      return '#B0AEA5';
  }
}

function resolveCalendarEventColor(ev: CalendarEvent, settingsDefaultHex?: string): string {
  const custom = ev.color?.trim();
  if (custom) return custom;
  const fromSettings = settingsDefaultHex?.trim();
  if (fromSettings) return fromSettings;
  return defaultColorForEventType(ev.eventType);
}

function expandCalendarEvent(
  ev: CalendarEvent,
  rangeStart: Date,
  rangeEndExclusive: Date,
  settingsCalendarEventColor?: string
): ScheduleCalendarItem[] {
  const out: ScheduleCalendarItem[] = [];
  const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
  const end = ev.end instanceof Date ? ev.end : new Date(ev.end);
  const color = resolveCalendarEventColor(ev, settingsCalendarEventColor);

  if (!ev.repeat || ev.repeat.frequency !== 'weekly' || !ev.repeat.daysOfWeek?.length) {
    if (end <= rangeStart || start >= rangeEndExclusive) return out;
    if (ev.allDay) {
      const d0 = normalizeDay(start);
      const d1 = addDays(normalizeDay(end), 1);
      out.push({
        id: ev.id,
        title: ev.title,
        start: d0,
        end: d1,
        allDay: true,
        color,
        kind: 'calendar',
        calendarEvent: ev,
      });
    } else {
      out.push({
        id: ev.id,
        title: ev.title,
        start,
        end,
        allDay: false,
        color,
        kind: 'calendar',
        calendarEvent: ev,
      });
    }
    return out;
  }

  const baseDay = normalizeDay(start);
  const repeatInterval = Math.max(1, Number(ev.repeat.interval) || 1);
  let day = normalizeDay(rangeStart);
  const rangeEnd0 = normalizeDay(addDays(rangeEndExclusive, -1));
  const repeatEnd = ev.repeat.endDate
    ? normalizeDay(ev.repeat.endDate instanceof Date ? ev.repeat.endDate : new Date(ev.repeat.endDate))
    : null;

  while (day <= rangeEnd0) {
    if (day < baseDay) {
      day = addDays(day, 1);
      continue;
    }
    if (repeatEnd && day > repeatEnd) break;
    if (!ev.repeat.daysOfWeek.includes(day.getDay())) {
      day = addDays(day, 1);
      continue;
    }
    if (repeatInterval > 1) {
      const deltaDays = Math.floor((day.getTime() - baseDay.getTime()) / (24 * 60 * 60 * 1000));
      const weekBucket = Math.floor(deltaDays / 7);
      if (weekBucket % repeatInterval !== 0) {
        day = addDays(day, 1);
        continue;
      }
    }

    const durationMs = end.getTime() - start.getTime();

    if (ev.allDay) {
      const ds = normalizeDay(day);
      const de = addDays(ds, 1);
      out.push({
        id: `${ev.id}-${format(day, 'yyyy-MM-dd')}`,
        title: ev.title,
        start: ds,
        end: de,
        allDay: true,
        color,
        kind: 'calendar',
        calendarEvent: ev,
      });
    } else {
      const occStart = new Date(day);
      occStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (occEnd > rangeStart && occStart < rangeEndExclusive) {
        out.push({
          id: `${ev.id}-${format(day, 'yyyy-MM-dd')}`,
          title: ev.title,
          start: occStart,
          end: occEnd,
          allDay: false,
          color,
          kind: 'calendar',
          calendarEvent: ev,
        });
      }
    }
    day = addDays(day, 1);
  }

  return out;
}

export function firstLineTitle(title: string): string {
  return title.split('\n')[0]?.trim() || title;
}

export function microTaskStepLabel(microTask: MicroTask, idx: number): string {
  return (microTask.title || '').trim() || `Step ${idx + 1}`;
}

/** One timed cluster → same multi-line title string used on calendar chips. */
export type TimedClusterEntry = { mt: MicroTask; idx: number };

export function buildClusterBlockTitle(task: Task, cluster: TimedClusterEntry[]): string {
  const checklist = cluster
    .flatMap((x) => {
      const subs = Array.isArray(x.mt.subtopics) ? x.mt.subtopics.filter(Boolean) : [];
      if (subs.length > 0) return subs.map((s) => `☐ ${s}`);
      return [`☐ ${microTaskStepLabel(x.mt, x.idx)}`];
    })
    .slice(0, 5);
  const more = cluster.length > 5 ? `\n+ ${cluster.length - 5} more` : '';
  return checklist.length > 1
    ? `${task.title}\n${checklist.join('\n')}${more}`
    : `${task.title}: ${checklist[0]?.replace(/^☐\s*/, '') || 'Study block'}`;
}

/** First line of the calendar label for a timed block (single step or merged cluster). */
export function calendarPrimaryLabelForTimedCluster(task: Task, cluster: TimedClusterEntry[]): string {
  if (cluster.length === 0) return task.title;
  if (cluster.length === 1) {
    const c = cluster[0]!;
    return firstLineTitle(`${task.title}: ${microTaskStepLabel(c.mt, c.idx)}`);
  }
  return firstLineTitle(buildClusterBlockTitle(task, cluster));
}

function taskMicroToItem(args: {
  task: Task;
  microTask: MicroTask;
  idx: number;
  calendarTaskColor?: string;
}): ScheduleCalendarItem | null {
  const { task, microTask, idx, calendarTaskColor } = args;
  const mtTitle = microTaskStepLabel(microTask, idx);
  const title = `${task.title}: ${mtTitle}`;
  const color = taskCalendarColor(task, calendarTaskColor);

  const ss = coerceScheduledDate(microTask.scheduledStart as unknown);
  const se = coerceScheduledDate(microTask.scheduledEnd as unknown);

  if (ss && se) {
    return {
      id: microTask.id,
      title,
      start: ss,
      end: se,
      allDay: false,
      color,
      kind: 'task',
      taskId: task.id,
      microTaskId: microTask.id,
      estimatedMinutes: microTask.estimatedMinutes,
    };
  }

  const sd = coerceScheduledDate(microTask.scheduledDate as unknown);
  if (sd) {
    const ds = normalizeDay(sd);
    const de = addDays(ds, 1);
    return {
      id: `${microTask.id}-day`,
      title,
      start: ds,
      end: de,
      allDay: true,
      color,
      kind: 'task',
      taskId: task.id,
      microTaskId: microTask.id,
      estimatedMinutes: microTask.estimatedMinutes,
      dayPlan: true,
    };
  }

  return null;
}

function buildTaskItems(
  tasks: Task[],
  gapMin: number,
  calendarTaskColor: string | undefined,
  rangeStart: Date,
  rangeEndExclusive: Date
): ScheduleCalendarItem[] {
  const events: ScheduleCalendarItem[] = [];
  for (const task of tasks) {
    const color = taskCalendarColor(task, calendarTaskColor);
    const timed = task.microTasks
      .map((mt, idx) => ({
        mt,
        idx,
        ss: coerceScheduledDate(mt.scheduledStart as unknown),
        se: coerceScheduledDate(mt.scheduledEnd as unknown),
      }))
      .filter((x) => x.ss && x.se)
      .sort((a, b) => a.ss!.getTime() - b.ss!.getTime());

    const groupedIds = new Set<string>();
    let cluster: typeof timed = [];
    const flush = () => {
      if (!cluster.length) return;
      const first = cluster[0];
      const last = cluster[cluster.length - 1];
      const blockTitle = buildClusterBlockTitle(
        task,
        cluster.map((x) => ({ mt: x.mt, idx: x.idx }))
      );
      events.push({
        id: `${task.id}-${first.mt.id}-block`,
        title: blockTitle,
        start: first.ss!,
        end: last.se!,
        allDay: false,
        color,
        kind: 'task',
        taskId: task.id,
        microTaskId: first.mt.id,
        clusterMicroTaskIds: cluster.map((x) => x.mt.id),
        estimatedMinutes: cluster.reduce((a, x) => a + (Number(x.mt.estimatedMinutes) || 0), 0),
      });
      cluster.forEach((x) => groupedIds.add(x.mt.id));
      cluster = [];
    };

    for (const x of timed) {
      if (!cluster.length) {
        cluster = [x];
        continue;
      }
      const prev = cluster[cluster.length - 1];
      const gap = x.ss!.getTime() - prev.se!.getTime();
      if (gap <= Math.max(5, gapMin) * 60_000) {
        cluster.push(x);
      } else {
        flush();
        cluster = [x];
      }
    }
    flush();

    task.microTasks
      .filter((mt) => !groupedIds.has(mt.id))
      .forEach((mt, idx) => {
        const ev = taskMicroToItem({ task, microTask: mt, idx, calendarTaskColor });
        if (ev) events.push(ev);
      });
  }

  return events.filter((e) => e.end > rangeStart && e.start < rangeEndExclusive);
}

export function buildScheduleCalendarItems(args: {
  rangeStart: Date;
  rangeEndExclusive: Date;
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  bufferMinutes: number;
  calendarTaskColor?: string;
  /** Settings “calendar event” pill color — used when an event has no per-event color. */
  calendarEventColor?: string;
}): ScheduleCalendarItem[] {
  const {
    rangeStart,
    rangeEndExclusive,
    tasks,
    calendarEvents,
    bufferMinutes,
    calendarTaskColor,
    calendarEventColor,
  } = args;
  const gapMin = (bufferMinutes || 5) + 5;
  const cal = calendarEvents.flatMap((ev) =>
    expandCalendarEvent(ev, rangeStart, rangeEndExclusive, calendarEventColor)
  );
  const taskItems = buildTaskItems(tasks, gapMin, calendarTaskColor, rangeStart, rangeEndExclusive);
  return [...cal, ...taskItems].filter((e) => e.end > rangeStart && e.start < rangeEndExclusive);
}

export function itemIntersectsDay(item: ScheduleCalendarItem, day: Date): boolean {
  const ds = normalizeDay(day);
  const de = addDays(ds, 1);
  return item.start < de && item.end > ds;
}

export function tooltipForItem(item: ScheduleCalendarItem): string {
  const rawTitle = item.title.replace(/\n/g, ' · ');
  let timeLine = '';
  if (item.allDay) {
    const endAdj = addDays(item.end, -1);
    if (normalizeDay(item.start).getTime() === normalizeDay(endAdj).getTime()) {
      timeLine = `All day · ${format(item.start, 'EEE, MMM d')}`;
    } else {
      timeLine = `All day · ${format(item.start, 'MMM d')} – ${format(endAdj, 'MMM d')}`;
    }
  } else {
    timeLine = `${format(item.start, 'EEE MMM d, h:mm a')} – ${format(item.end, 'h:mm a')}`;
  }

  let tip = timeLine ? `${timeLine}\n${rawTitle}` : rawTitle;

  if (item.kind === 'calendar' && item.calendarEvent) {
    const ev = item.calendarEvent;
    tip += `\n${ev.eventType.charAt(0).toUpperCase()}${ev.eventType.slice(1)}`;
    if (ev.description?.trim()) {
      tip += `\n${ev.description.trim()}`;
    }
  }

  if (item.kind === 'task') {
    const m = item.estimatedMinutes;
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) {
      tip += `\n~${m} min estimated`;
    }
    if (item.dayPlan) {
      tip += `\nDay target only — a clock time appears once this step is packed into your work hours.`;
    }
  }

  return tip;
}
