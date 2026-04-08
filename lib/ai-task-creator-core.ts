import { addDays, format } from 'date-fns';
import { parseCalendarDate } from '@/lib/local-date';

export type AITaskCreatorResult =
  | {
      success: true;
      kind: 'event';
      title: string;
      description?: string | null;
      startDate: string;
      startTime: string | null;
      endTime: string | null;
      durationMinutes?: number | null;
      allDay: boolean;
      eventType: 'class' | 'meeting' | 'event' | 'study';
      repeat: null | { frequency: 'weekly'; interval: number; daysOfWeek: number[]; endDate?: string };
      sourceSpan?: string;
    }
  | {
      success: true;
      kind: 'task';
      title: string;
      description?: string | null;
      dueDate: string;
      priority: 'low' | 'medium' | 'high';
      subject?: string | null;
      estimatedHours: number;
      sessionStyle: 'single_block' | 'multi_step';
      sessionMinutes?: number;
      sourceSpan?: string;
    }
  | {
      success: true;
      kind: 'study_plan';
      summary: string;
      tasks: Array<{
        title: string;
        description?: string | null;
        subject?: string | null;
        dueDate: string;
        priority: 'low' | 'medium' | 'high';
        microTasks: Array<{
          title: string;
          description?: string;
          estimatedMinutes: number;
          scheduledDate: string;
        }>;
        estimatedTotalMinutes?: number;
      }>;
      sourceSpan?: string;
      schedulePattern?: string;
      patternCycleLength?: number | null;
      rotationSubjects?: string[];
    };

type ExtractionKind = 'event' | 'task' | 'study_plan';

type Extraction = {
  kind: ExtractionKind;
  title?: string;
  description?: string | null;
  subject?: string | null;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  totalMinutes?: number | null;
  singleSession?: boolean | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  allDay?: boolean | null;
  eventType?: 'class' | 'meeting' | 'event' | 'study' | string;
  repeat?: { frequency?: string; interval?: number; daysOfWeek?: number[]; endDate?: string } | null;
  subjects?: string[];
  cadence?: 'daily' | 'alternate' | 'rotate_daily' | 'weekdays' | 'weekly' | 'biweekly' | string;
  repeatInterval?: number | null;
  daysOfWeek?: number[] | null;
  deadline?: string | null;
  minutesPerSession?: number | null;
  sessionCount?: number | null;
  totalDays?: number | null;
  sessionsPerDay?: number | null;
};

export function buildAITaskCreatorPrompt(input: {
  text: string;
  today: string;
  nowHHMM: string;
}): string {
  return `You are an expert scheduling extractor.
Today is ${input.today}, local time ${input.nowHHMM}.

Convert user intent into JSON only. No markdown.
Understand paraphrases, messy phrasing, and imperfect grammar.
Never rely on literal trigger words.

Return ONE object, or an array of objects if multiple independent asks exist.

Kinds:
- "event": fixed-time calendar commitments (recurring or one-off).
- "task": one deliverable/work item.
- "study_plan": repeated sessions distributed over days.

JSON shapes:
event:
{"kind":"event","title":"string","description":"string|null","startDate":"YYYY-MM-DD|null","startTime":"HH:MM|null","endTime":"HH:MM|null","durationMinutes":number|null,"allDay":boolean,"eventType":"class|meeting|event|study","repeat":null|{"frequency":"weekly","interval":number,"daysOfWeek":[0-6],"endDate":"YYYY-MM-DD|null"}}

task:
{"kind":"task","title":"string","description":"string|null","subject":"string|null","priority":"low|medium|high","dueDate":"YYYY-MM-DD|null","totalMinutes":number|null,"singleSession":boolean|null}

study_plan:
{"kind":"study_plan","title":"string","description":"string|null","subjects":["string"],"priority":"low|medium|high","cadence":"daily|alternate|rotate_daily|weekdays|weekly|biweekly","repeatInterval":number|null,"daysOfWeek":[0-6]|null,"deadline":"YYYY-MM-DD|null","minutesPerSession":number|null,"sessionCount":number|null,"totalDays":number|null,"sessionsPerDay":number|null}

Rules:
- If intent is repeated prep/practice/work over many days -> study_plan.
- If multiple subjects rotate/switch/alternate -> study_plan.
- If specific time commitment/appointment/class slot -> event.
- If one assignment/deliverable -> task.
- Use null instead of guessing when unknown.

User input: ${JSON.stringify(input.text)}`;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function parseDateOrNull(v: unknown): Date | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseCalendarDate(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeDow(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const out = days
    .map((x) => Math.round(Number(x)))
    .filter((x) => Number.isFinite(x) && x >= 0 && x <= 6);
  return [...new Set(out)];
}

function normalizeExtraction(raw: Record<string, unknown>): Extraction | null {
  const kind = String(raw.kind ?? '').trim() as ExtractionKind;
  if (kind !== 'event' && kind !== 'task' && kind !== 'study_plan') return null;
  return {
    kind,
    title: typeof raw.title === 'string' ? raw.title.trim() : undefined,
    description: raw.description == null ? null : String(raw.description),
    subject: raw.subject == null ? null : String(raw.subject),
    priority:
      raw.priority === 'low' || raw.priority === 'high' || raw.priority === 'medium'
        ? raw.priority
        : 'medium',
    dueDate: raw.dueDate == null ? null : String(raw.dueDate),
    totalMinutes: raw.totalMinutes == null ? null : Number(raw.totalMinutes),
    singleSession: typeof raw.singleSession === 'boolean' ? raw.singleSession : null,
    startDate: raw.startDate == null ? null : String(raw.startDate),
    startTime: raw.startTime == null ? null : String(raw.startTime),
    endTime: raw.endTime == null ? null : String(raw.endTime),
    durationMinutes: raw.durationMinutes == null ? null : Number(raw.durationMinutes),
    allDay: raw.allDay === true,
    eventType: raw.eventType == null ? 'event' : String(raw.eventType),
    repeat: (raw.repeat as Extraction['repeat']) ?? null,
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map((x) => String(x).trim()).filter(Boolean) : [],
    cadence: raw.cadence == null ? 'daily' : String(raw.cadence),
    repeatInterval: raw.repeatInterval == null ? null : Number(raw.repeatInterval),
    daysOfWeek: raw.daysOfWeek == null ? null : (raw.daysOfWeek as number[]),
    deadline: raw.deadline == null ? null : String(raw.deadline),
    minutesPerSession: raw.minutesPerSession == null ? null : Number(raw.minutesPerSession),
    sessionCount: raw.sessionCount == null ? null : Number(raw.sessionCount),
    totalDays: raw.totalDays == null ? null : Number(raw.totalDays),
    sessionsPerDay: raw.sessionsPerDay == null ? null : Number(raw.sessionsPerDay),
  };
}

function planDates(
  cadence: string,
  start: Date,
  end: Date,
  count: number,
  daysOfWeek: number[],
  repeatInterval: number
): Date[] {
  const dates: Date[] = [];
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end0 = new Date(end);
  end0.setHours(0, 0, 0, 0);
  const maxIterations = 730;
  let it = 0;
  while (dates.length < count && cursor.getTime() <= end0.getTime() && it < maxIterations) {
    it += 1;
    const dow = cursor.getDay();
    let include = false;
    if (cadence === 'alternate') {
      const delta = Math.floor((cursor.getTime() - start.getTime()) / 86400000);
      include = delta % 2 === 0;
    } else if (cadence === 'weekdays') {
      include = dow >= 1 && dow <= 5;
    } else if (cadence === 'weekly' || cadence === 'biweekly') {
      const wanted = daysOfWeek.length ? daysOfWeek : [start.getDay()];
      const weekDelta = Math.floor((cursor.getTime() - start.getTime()) / (7 * 86400000));
      include = wanted.includes(dow) && weekDelta % Math.max(1, repeatInterval) === 0;
    } else {
      include = true;
    }
    if (include) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function buildStudyPlan(ex: Extraction, sourceSpan: string, todayLocal: Date): AITaskCreatorResult {
  const start = new Date(todayLocal);
  const deadline = parseDateOrNull(ex.deadline) ?? addDays(start, clampInt(ex.totalDays, 1, 365, 14) - 1);
  const safeEnd = deadline.getTime() < start.getTime() ? start : deadline;
  const cadenceRaw = String(ex.cadence || 'daily').toLowerCase();
  const cadence =
    cadenceRaw === 'alternate' ||
    cadenceRaw === 'rotate_daily' ||
    cadenceRaw === 'weekdays' ||
    cadenceRaw === 'weekly' ||
    cadenceRaw === 'biweekly'
      ? cadenceRaw
      : 'daily';
  const daysOfWeek = sanitizeDow(ex.daysOfWeek);
  const repeatInterval =
    cadence === 'biweekly' ? 2 : clampInt(ex.repeatInterval, 1, 4, cadence === 'weekly' ? 1 : 1);
  const sessionsPerDay = clampInt(ex.sessionsPerDay, 1, 3, 1);
  const minutesPerSession = clampInt(ex.minutesPerSession, 15, 240, 60);
  const spanDays = Math.max(1, Math.floor((safeEnd.getTime() - start.getTime()) / 86400000) + 1);
  let targetSessions = clampInt(ex.sessionCount, 1, 180, 0);
  if (targetSessions <= 0) {
    if (ex.totalDays != null) targetSessions = clampInt(ex.totalDays, 1, 180, spanDays);
    else targetSessions = Math.min(90, spanDays * sessionsPerDay);
  }

  const baseDates = planDates(
    cadence === 'rotate_daily' ? 'daily' : cadence,
    start,
    safeEnd,
    Math.max(1, targetSessions),
    daysOfWeek,
    repeatInterval
  );
  const datedSessions: Date[] = [];
  for (const d of baseDates) {
    for (let i = 0; i < sessionsPerDay && datedSessions.length < targetSessions; i += 1) {
      datedSessions.push(new Date(d));
    }
  }
  const subjects = (ex.subjects ?? []).filter(Boolean);
  const cycle = subjects.length ? subjects : [ex.title || 'Study'];
  const rootTitle = (ex.title || `${cycle.join(' + ')} plan`).trim().slice(0, 200);
  const microTasks = datedSessions.map((d, idx) => {
    const topic = cycle[idx % cycle.length] || 'Study';
    return {
      title: `${topic} prep`,
      description: ex.description || undefined,
      estimatedMinutes: minutesPerSession,
      scheduledDate: ymd(d),
    };
  });
  return {
    success: true,
    kind: 'study_plan',
    sourceSpan,
    summary: `Generated ${microTasks.length} sessions through ${ymd(safeEnd)}.`,
    tasks: [
      {
        title: rootTitle || 'Study plan',
        description: ex.description ?? null,
        subject: subjects.length === 1 ? subjects[0] : null,
        dueDate: ymd(safeEnd),
        priority: ex.priority || 'medium',
        microTasks,
        estimatedTotalMinutes: microTasks.reduce((acc, m) => acc + m.estimatedMinutes, 0),
      },
    ],
    schedulePattern:
      cadence === 'rotate_daily'
        ? 'custom_cycle'
        : cadence === 'alternate'
          ? 'alternate'
          : cadence === 'weekdays' || cadence === 'weekly' || cadence === 'biweekly'
            ? 'specific_days'
            : 'daily',
    patternCycleLength: cycle.length > 1 ? cycle.length : null,
    rotationSubjects: cycle.length > 1 ? cycle : undefined,
  };
}

export function resolveAITaskCreatorItems(input: {
  root: unknown;
  sourceText: string;
  todayLocal: Date;
}): AITaskCreatorResult[] {
  const items = Array.isArray(input.root) ? input.root : [input.root];
  const out: AITaskCreatorResult[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const ex = normalizeExtraction(item as Record<string, unknown>);
    if (!ex) continue;
    if (ex.kind === 'event') {
      const start = parseDateOrNull(ex.startDate) ?? input.todayLocal;
      const interval = clampInt(ex.repeat?.interval, 1, 12, 1);
      out.push({
        success: true,
        kind: 'event',
        sourceSpan: input.sourceText,
        title: (ex.title || 'Event').slice(0, 200),
        description: ex.description ?? null,
        startDate: ymd(start),
        startTime: ex.startTime ?? null,
        endTime: ex.endTime ?? null,
        durationMinutes:
          ex.durationMinutes == null ? null : clampInt(ex.durationMinutes, 10, 600, 60),
        allDay: ex.allDay === true,
        eventType:
          ex.eventType === 'class' || ex.eventType === 'meeting' || ex.eventType === 'study'
            ? ex.eventType
            : 'event',
        repeat: ex.repeat
          ? {
              frequency: 'weekly',
              interval,
              daysOfWeek: sanitizeDow(ex.repeat.daysOfWeek),
              ...(parseDateOrNull(ex.repeat.endDate) ? { endDate: ymd(parseDateOrNull(ex.repeat.endDate)!) } : {}),
            }
          : null,
      });
      continue;
    }
    if (ex.kind === 'task') {
      const due = parseDateOrNull(ex.dueDate) ?? addDays(input.todayLocal, 7);
      const totalMinutes = clampInt(ex.totalMinutes, 20, 16 * 60, 120);
      const single = ex.singleSession === true || totalMinutes <= 90;
      out.push({
        success: true,
        kind: 'task',
        sourceSpan: input.sourceText,
        title: (ex.title || 'Task').slice(0, 200),
        description: ex.description ?? null,
        dueDate: ymd(due),
        priority: ex.priority || 'medium',
        subject: ex.subject ?? null,
        estimatedHours: Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10),
        sessionStyle: single ? 'single_block' : 'multi_step',
        ...(single ? { sessionMinutes: totalMinutes } : {}),
      });
      continue;
    }
    out.push(buildStudyPlan(ex, input.sourceText, input.todayLocal));
  }
  return out;
}
