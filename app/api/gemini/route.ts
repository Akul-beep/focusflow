import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CalendarEvent } from '@/types';
import {
  filterTopicLines,
  isStructuralHeadingOnly,
  shouldSkipAsSchedulableTopicTitle,
  isBareCurriculumStrandBanner,
} from '@/lib/syllabus-topic-filters';
import {
  estimateMinutesHeuristic,
  learningPassFloorMinutes,
  mergeDurationEstimate,
  topicDurationLookupKeys,
} from '@/lib/topic-duration-estimate';
import { addDays, startOfDay, differenceInCalendarDays } from 'date-fns';
import {
  applyBalancedScheduleDates,
  applySequentialScheduleDates,
  microTasksAppearSequenced,
  normalizeMicroTaskMinutesToTotal,
} from '@/lib/scheduler';
import { parseLocalDateKey, parseCalendarDate } from '@/lib/local-date';
import {
  parseScheduleMetadata,
  overlayScheduleMetadataOnEvent,
  type ParsedScheduleMetadata,
} from '@/lib/parse-schedule-metadata';
import { buildCompactParseTaskPrompt, buildParseTaskRepairPrompt } from '@/lib/parse-task-groq-prompt';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { aiRequestAsyncLocal, getGeminiKeyOverrideForRequest } from '@/lib/ai-request-context';
import { decryptUserGroqKey, isValidUserGeminiApiKeyFormat } from '@/lib/ai-user-groq-key-crypto';
import { getAiSharedDailyLimit, utcTodayDateString } from '@/lib/ai-shared-quota';
import {
  extractDurationMinutesFromUserText,
  resolveTitleFromUserText,
  fixMisclassifiedRecurringActivityPlan,
  fixMisclassifiedRecurringWeeklyClassSlotAsEvent,
  fixMisclassifiedAlternatingWeekdayPlanAsEvent,
  fixMisclassifiedRecurringNthWeekdaySlotAsEvent,
  fixMisclassifiedWeeklyMeetingAsEvent,
  fixMisclassifiedRecurringWeekdayClockBlockAsEvent,
  looksLikeRecurringWeekdayClockBlock,
  stripSpuriousEventWeeklyRepeat,
  inferTomorrowForBarePastPaperIntent,
  sanitizeWeeklyRepeatDaysFromUserText,
  extractEventRepeatDaysFromUserText,
  extractEventTimeRangeFromUserText,
  inferTaskSessionStyle,
  normalizeSchedulingUserText,
  ensureEventWeeklyRepeatFromUserText,
  inferCalendarDayFromUserText,
  inferOrdinalDeadlineDayFromUserText,
  extractWeekdayIndicesFromUserText,
  userTextIndicatesCalendarEvent,
  userTextIndicatesFlexibleTask,
  hasTwoSubjectOneDayRotationPattern,
  isSinglePlanAlternatingSubjectsCue,
  reconcileTaskVsEventKindFromUserText,
  userAskedForWeeklyRecurrence,
} from '@/lib/ai-task-text-parse';

function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function normToken(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function lastScheduleDayBeforeDue(due: Date, today: Date): Date {
  const today0 = startOfDay(today);
  const due0 = startOfDay(due);
  const spanDays = Math.max(1, differenceInCalendarDays(due0, today0) + 1);
  return spanDays >= 3 ? addDays(due0, -1) : due0;
}

type StudyPlanMicroOut = {
  title: string;
  description?: string;
  estimatedMinutes: number;
  scheduledDate: string;
  /** Present when the model supplied an explicit step order. */
  order?: number;
};

type StudyPlanTaskOut = {
  title: string;
  description: string | null;
  subject: string | null;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  microTasks: StudyPlanMicroOut[];
  estimatedTotalMinutes: number;
};

function normalizeStudyPlanFromParsed(
  parsed: Record<string, unknown>,
  todayLocal: Date
): { summary: string; tasks: StudyPlanTaskOut[]; truncated?: boolean } | null {
  if (parsed.kind !== 'study_plan') return null;
  const summary = String(parsed.summary || parsed.planDescription || 'Study plan').trim() || 'Study plan';
  const tasksIn = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (tasksIn.length === 0) return null;

  const MAX_TOTAL = 200;
  let count = 0;
  let truncated = false;
  const out: StudyPlanTaskOut[] = [];

  taskLoop: for (const t of tasksIn) {
    if (typeof t !== 'object' || !t) continue;
    const tr = t as Record<string, unknown>;
    const title = String(tr.title || 'Study sessions').trim() || 'Study sessions';
    let due = tr.dueDate ? parseCalendarDate(String(tr.dueDate)) : addDays(todayLocal, 7);
    if (Number.isNaN(due.getTime())) due = addDays(todayLocal, 7);
    if (due < todayLocal) due = new Date(todayLocal);
    const lastSched = lastScheduleDayBeforeDue(due, todayLocal);
    const microRaw = Array.isArray(tr.microTasks) ? tr.microTasks : [];
    const micros: StudyPlanMicroOut[] = [];

    inner: for (const m of microRaw) {
      if (count >= MAX_TOTAL) {
        truncated = true;
        break inner;
      }
      if (typeof m !== 'object' || !m) continue;
      const mr = m as Record<string, unknown>;
      const mtTitle = String(mr.title || 'Session').trim() || 'Session';
      let mins = Math.round(Number(mr.estimatedMinutes));
      if (!Number.isFinite(mins)) mins = 45;
      mins = Math.max(10, Math.min(480, mins));
      let sd = String(mr.scheduledDate || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) {
        let d = parseCalendarDate(sd);
        if (d < todayLocal) d = new Date(todayLocal);
        if (d > lastSched) d = new Date(lastSched);
        sd = toLocalYYYYMMDD(d);
      } else {
        sd = '';
      }
      const desc = mr.description != null ? String(mr.description).trim() : '';
      const ordParsed = Number(mr.order);
      micros.push({
        title: mtTitle,
        ...(desc ? { description: desc } : {}),
        estimatedMinutes: mins,
        scheduledDate: sd,
        ...(Number.isFinite(ordParsed) && ordParsed > 0 ? { order: ordParsed } : {}),
      });
      count += 1;
    }

    if (micros.length === 0) continue;

    const needsBalance = micros.some((x) => !x.scheduledDate);
    if (needsBalance) {
      const forBal = micros.map((m) => ({
        estimatedMinutes: m.estimatedMinutes,
        ...(m.order != null ? { order: m.order } : {}),
        title: m.title,
      }));
      const useSequential = microTasksAppearSequenced(forBal);
      const balanced = useSequential
        ? applySequentialScheduleDates(forBal, todayLocal, lastSched)
        : applyBalancedScheduleDates(forBal, todayLocal, lastSched);
      for (let j = 0; j < micros.length; j++) {
        if (!micros[j]!.scheduledDate) {
          micros[j]!.scheduledDate = balanced[j]?.scheduledDate ?? toLocalYYYYMMDD(todayLocal);
        }
      }
    }

    const totalMin = micros.reduce((a, m) => a + m.estimatedMinutes, 0);
    out.push({
      title,
      description: tr.description != null ? String(tr.description) : null,
      subject: tr.subject != null ? String(tr.subject).trim() || null : null,
      dueDate: toLocalYYYYMMDD(due),
      priority:
        tr.priority === 'high' || tr.priority === 'low' ? tr.priority : 'medium',
      microTasks: micros,
      estimatedTotalMinutes: totalMin,
    });
    if (truncated) break taskLoop;
  }

  return out.length ? { summary, tasks: out, truncated } : null;
}

/** Title + minutes only — duplicate parents often get different per-task date balancing. */
function microStackLooseSignature(task: StudyPlanTaskOut): string {
  return task.microTasks.map((m) => `${normToken(m.title)}:${m.estimatedMinutes}`).join('\n');
}

/**
 * Models often return **two parent rows** (e.g. Physics + English) each with the **same**
 * alternating microTask list — the UI then shows 2× sessions. Collapse to **one** parent task.
 */
function mergeStudyPlanParentTasksWithIdenticalMicroStacks(plan: {
  summary: string;
  tasks: StudyPlanTaskOut[];
  truncated?: boolean;
}): { summary: string; tasks: StudyPlanTaskOut[]; truncated?: boolean } {
  if (plan.tasks.length < 2) return plan;
  const sig0 = microStackLooseSignature(plan.tasks[0]!);
  if (!sig0) return plan;
  if (!plan.tasks.every((t) => microStackLooseSignature(t) === sig0)) return plan;

  const distinctTitles = [...new Set(plan.tasks.map((t) => t.title.trim()).filter(Boolean))];
  const sum = plan.summary.trim();
  let mergedTitle = '';
  if (sum.length >= 3 && !/^study\s+plan$/i.test(sum)) {
    mergedTitle = sum;
  } else if (distinctTitles.length > 0) {
    mergedTitle = distinctTitles.join(' · ');
  } else {
    mergedTitle = plan.tasks[0]!.title;
  }

  const first = plan.tasks[0]!;
  let description: string | null = first.description;
  if (!description) {
    description = plan.tasks.slice(1).find((t) => t.description)?.description ?? null;
  }

  return {
    ...plan,
    tasks: [
      {
        ...first,
        title: mergedTitle.slice(0, 200),
        subject: null,
        description,
      },
    ],
  };
}

function inferDueDateFromText(text: string, today: Date): Date | null {
  return inferCalendarDayFromUserText(text, today);
}

type StudyCadence =
  | { kind: 'daily'; daysOfWeek: number[] }
  | { kind: 'alternate' }
  | { kind: 'weekly'; daysOfWeek: number[] }
  | { kind: 'biweekly'; daysOfWeek: number[] };

function inferStudyCadenceFromText(text: string): StudyCadence | null {
  const raw = normalizeSchedulingUserText(text);
  const t = raw.toLowerCase();

  const namedDays = extractWeekdayIndicesFromUserText(raw);
  if (/\balternate\s+(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/i.test(t) && namedDays.length > 0) {
    return { kind: 'biweekly', daysOfWeek: namedDays };
  }
  if (hasTwoSubjectOneDayRotationPattern(raw)) {
    return { kind: 'alternate' };
  }
  if (/\b(every\s+other\s+day|alternate\s+days?)\b/i.test(t)) {
    return { kind: 'alternate' };
  }
  if (/\b(every\s*weekday|weekdays)\b/i.test(t)) {
    return { kind: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] };
  }
  if (/\b(every\s+day|daily|each\s+day)\b/i.test(t)) {
    return { kind: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  }

  if (namedDays.length > 0 && userAskedForWeeklyRecurrence(raw)) {
    return { kind: 'weekly', daysOfWeek: namedDays };
  }

  // Implicit recurrence: "prep/revision ... till/until <date>" with duration usually means repeated sessions.
  if (
    /\b(till|until)\b/i.test(t) &&
    /\b(prep|prepare|study|revision|revise)\b/i.test(t) &&
    extractDurationMinutesFromUserText(t) != null
  ) {
    return { kind: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  }

  // "Between A and B … until …" (two subjects, one deadline) → daily sessions in range.
  if (extractBetweenThemesFromText(raw).length >= 2 && /\b(till|until)\b/i.test(t)) {
    return { kind: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  }

  return null;
}

function shouldExpandStudyPlanFromText(text: string, parsed: Record<string, unknown>): boolean {
  if (parsed.kind !== 'study_plan') return false;
  const cadence = inferStudyCadenceFromText(text);
  if (!cadence) return false;
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (tasks.length === 0) return false;
  const t0 = tasks[0] as Record<string, unknown>;
  const micros = Array.isArray(t0.microTasks) ? t0.microTasks : [];
  return micros.length <= 2;
}

function expandStudyPlanRecurringSessionsFromText(
  text: string,
  parsed: Record<string, unknown>,
  todayLocal: Date
): Record<string, unknown> {
  if (!shouldExpandStudyPlanFromText(text, parsed)) return parsed;
  const cadence = inferStudyCadenceFromText(text);
  if (!cadence) return parsed;

  const tasksIn = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (tasksIn.length === 0) return parsed;
  const alternatingThemes = extractAlternatingThemesFromText(text);

  let remaining = 200;
  const outTasks: unknown[] = [];

  for (const t of tasksIn) {
    if (typeof t !== 'object' || !t) continue;
    const tr = t as Record<string, unknown>;
    const due = tr.dueDate ? parseCalendarDate(String(tr.dueDate)) : addDays(todayLocal, 14);
    if (Number.isNaN(due.getTime())) {
      outTasks.push(tr);
      continue;
    }
    const start = startOfDay(todayLocal);
    const end = startOfDay(due);
    if (end < start) {
      outTasks.push(tr);
      continue;
    }

    const microRaw = Array.isArray(tr.microTasks) ? tr.microTasks : [];
    const template = (microRaw[0] as Record<string, unknown> | undefined) ?? {};
    const titleBase = String(template.title || tr.title || 'Session').trim() || 'Session';
    const descBase = template.description != null ? String(template.description).trim() : '';
    const minsFromTemplate = Math.round(Number(template.estimatedMinutes));
    const minsFromText = extractDurationMinutesFromUserText(text);
    const estimatedMinutes = Math.max(
      10,
      Math.min(480, Number.isFinite(minsFromTemplate) && minsFromTemplate > 0 ? minsFromTemplate : minsFromText ?? 45)
    );

    const expandedMicros: Array<Record<string, unknown>> = [];
    let cursor = new Date(start);
    let idx = 1;
    while (cursor.getTime() <= end.getTime() && remaining > 0) {
      const dow = cursor.getDay();
      let include = false;
      if (cadence.kind === 'alternate') {
        // If themes are provided (e.g., "physics and chem on alternate days"),
        // sessions happen daily and the theme alternates per day.
        if (alternatingThemes.length >= 2) {
          include = true;
        } else {
          const deltaDays = Math.floor((cursor.getTime() - start.getTime()) / 86400000);
          include = deltaDays % 2 === 0;
        }
      } else if (cadence.kind === 'biweekly') {
        if (cadence.daysOfWeek.includes(dow)) {
          const deltaDays = Math.floor((cursor.getTime() - start.getTime()) / 86400000);
          const weekBucket = Math.floor(deltaDays / 7);
          include = weekBucket % 2 === 0;
        } else {
          include = false;
        }
      } else {
        include = cadence.daysOfWeek.includes(dow);
      }
      if (include) {
        const alternateTitle =
          alternatingThemes.length >= 2
            ? `${alternatingThemes[expandedMicros.length % alternatingThemes.length]} prep`
            : null;
        expandedMicros.push({
          title: alternateTitle ?? (expandedMicros.length === 0 ? titleBase : `${titleBase} ${idx}`),
          ...(descBase ? { description: descBase } : {}),
          estimatedMinutes,
          // Preserve cadence dates so alternate/weekday plans survive downstream balancing.
          scheduledDate: toLocalYYYYMMDD(cursor),
        });
        idx += 1;
        remaining -= 1;
      }
      cursor = addDays(cursor, 1);
    }

    if (expandedMicros.length === 0) {
      outTasks.push(tr);
      continue;
    }

    outTasks.push({
      ...tr,
      microTasks: expandedMicros,
      estimatedTotalMinutes: expandedMicros.length * estimatedMinutes,
    });
  }

  if (outTasks.length === 0) return parsed;
  return {
    ...parsed,
    tasks: outTasks,
  };
}

function nextOccurrenceForWeeklyRepeat(args: {
  today: Date;
  daysOfWeek: number[];
  startTimeHHMM: string | null;
}): Date {
  const { today, daysOfWeek, startTimeHHMM } = args;
  const now = new Date(today);
  const baseDay = new Date(now);
  baseDay.setHours(0, 0, 0, 0);

  const [sh, sm] = startTimeHHMM ? startTimeHHMM.split(':').map((v) => parseInt(v, 10)) : [0, 0];
  const todayDow = baseDay.getDay();

  if (daysOfWeek.includes(todayDow)) {
    const candidate = new Date(baseDay);
    candidate.setHours(sh, sm, 0, 0);
    if (!startTimeHHMM || candidate.getTime() >= now.getTime()) return candidate;
  }

  for (let delta = 1; delta <= 14; delta++) {
    const d = new Date(baseDay);
    d.setDate(d.getDate() + delta);
    if (daysOfWeek.includes(d.getDay())) {
      d.setHours(sh, sm, 0, 0);
      return d;
    }
  }

  return baseDay;
}

const SPAN_TEXT_KEYS = ['spanText', 'sourceSpan', 'fromUserSnippet', 'sourceText'] as const;

function normalizeParseKind(v: unknown): 'study_plan' | 'event' | 'task' | null {
  const s = String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (
    s === 'study_plan' ||
    s === 'studyplan' ||
    s === 'plan' ||
    s === 'multi_session' ||
    s === 'multisession' ||
    s === 'sessions'
  )
    return 'study_plan';
  if (
    s === 'event' ||
    s === 'calendar_event' ||
    s === 'calendarevent' ||
    s === 'appointment' ||
    s === 'meeting' ||
    s === 'calendar' ||
    s === 'busy' ||
    s === 'blocked' ||
    s === 'fixed'
  )
    return 'event';
  if (s === 'task' || s === 'todo' || s === 'assignment' || s === 'homework' || s === 'deadline' || s === 'work')
    return 'task';
  return null;
}

function shallowKindAliases(o: Record<string, unknown>): 'study_plan' | 'event' | 'task' | null {
  const keys = [
    o.kind,
    o.type,
    o.category,
    o.intent,
    o.mode,
    (o as { schedule_kind?: unknown }).schedule_kind,
    (o as { scheduleKind?: unknown }).scheduleKind,
    (o as { item_kind?: unknown }).item_kind,
    (o as { object_type?: unknown }).object_type,
  ];
  for (const k of keys) {
    const nk = normalizeParseKind(k);
    if (nk) return nk;
  }
  return null;
}

function firstObjectWithScheduleShape(root: Record<string, unknown>): Record<string, unknown> | null {
  const nestKeys = [
    'parsed',
    'result',
    'results',
    'output',
    'data',
    'response',
    'schedule',
    'plan',
    'payload',
    'object',
    'content',
    'message',
    'assistant',
    'extraction',
  ] as const;
  for (const nk of nestKeys) {
    const v = root[nk];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = v as Record<string, unknown>;
      if (shallowKindAliases(inner) || inferKindFromObjectShape(inner)) return inner;
    }
  }
  return null;
}

/** When the model omits `kind` entirely, infer from familiar field shapes + user text. */
function inferKindFromObjectShape(o: Record<string, unknown>): 'study_plan' | 'event' | 'task' | null {
  const tasks = o.tasks;
  if (Array.isArray(tasks) && tasks.length > 0) {
    const t0 = tasks[0] as Record<string, unknown> | undefined;
    if (t0 && typeof t0 === 'object' && Array.isArray(t0.microTasks)) return 'study_plan';
  }
  if (typeof o.summary === 'string' && o.summary.trim() && Array.isArray(tasks) && tasks.length > 0) {
    return 'study_plan';
  }

  const hasStartTime = o.startTime != null && String(o.startTime).trim() !== '';
  const hasEndTime = o.endTime != null && String(o.endTime).trim() !== '';
  const hasAllDay = o.allDay === true;
  const hasRepeat =
    o.repeat != null && typeof o.repeat === 'object' && !Array.isArray(o.repeat);
  const hasRecurrence = (o as { recurrence?: unknown }).recurrence != null;

  /** `startDate` alone is unreliable (models confuse it with due dates) — require real clock or recurrence signals. */
  if (hasAllDay || hasRepeat || hasRecurrence || hasStartTime || hasEndTime) {
    return 'event';
  }

  if (o.dueDate != null || o.sessionStyle != null || o.sessionMinutes != null) {
    return 'task';
  }
  if (o.estimatedHours != null && !hasStartTime) {
    return 'task';
  }
  return null;
}

function inferKindFromObjectShapeAndText(o: Record<string, unknown>, userText: string): 'study_plan' | 'event' | 'task' | null {
  const fromShape = inferKindFromObjectShape(o);
  if (fromShape) return fromShape;
  if (typeof o.title === 'string' && o.title.trim()) {
    const cal = userTextIndicatesCalendarEvent(userText);
    const flex = userTextIndicatesFlexibleTask(userText);
    if (cal && !flex) return 'event';
    if (flex && !cal) return 'task';
    if (cal && flex) {
      if (extractEventTimeRangeFromUserText(userText) || /\ball[\s-]day\b/i.test(userText.toLowerCase())) return 'event';
      return 'task';
    }
    if (extractEventTimeRangeFromUserText(userText) && extractWeekdayIndicesFromUserText(userText).length > 0) {
      return 'event';
    }
    return 'task';
  }
  return null;
}

function syntheticFallbackScheduleItem(
  userText: string,
  todayLocal: Date,
  nowLocal: Date
): { spanText: string; item: Record<string, unknown> } {
  const title = resolveTitleFromUserText(userText, null) || userText.trim().slice(0, 200) || 'Schedule item';
  const cal = userTextIndicatesCalendarEvent(userText);
  const flex = userTextIndicatesFlexibleTask(userText);

  if (cal && !flex) {
    const dayGuess = inferCalendarDayFromUserText(userText, nowLocal) ?? todayLocal;
    const day0 = dayGuess < todayLocal ? todayLocal : dayGuess;
    const times = extractEventTimeRangeFromUserText(userText);
    const dm = extractDurationMinutesFromUserText(userText);
    const days = extractEventRepeatDaysFromUserText(userText, []);
    const wantsRepeat = userAskedForWeeklyRecurrence(userText) && days.length > 0;

    return {
      spanText: userText,
      item: {
        kind: 'event',
        title,
        description: null,
        startDate: toLocalYYYYMMDD(day0),
        startTime: times?.startHHMM ?? null,
        endTime: times?.endHHMM ?? null,
        durationMinutes: times ? null : dm,
        allDay: /\ball[\s-]day\b/i.test(userText.toLowerCase()),
        eventType: 'event',
        repeat: wantsRepeat
          ? { frequency: 'weekly', interval: 1, daysOfWeek: days }
          : null,
      },
    };
  }

  const dueGuess = inferCalendarDayFromUserText(userText, nowLocal);
  const dueDate = dueGuess && dueGuess >= todayLocal ? dueGuess : addDays(todayLocal, 7);
  const sessionStyle = inferTaskSessionStyle(userText, {});
  const dm = extractDurationMinutesFromUserText(userText);
  const sessionMinutes =
    sessionStyle === 'single_block'
      ? Math.max(10, Math.min(8 * 60, dm ?? 60))
      : undefined;
  return {
    spanText: userText,
    item: {
      kind: 'task',
      title,
      description: null,
      dueDate: toLocalYYYYMMDD(dueDate),
      priority: 'medium',
      subject: null,
      estimatedHours:
        sessionStyle === 'single_block' ? Math.max(0.5, (sessionMinutes ?? 60) / 60) : 2,
      sessionStyle,
      ...(sessionMinutes != null ? { sessionMinutes } : {}),
    },
  };
}

/** When the model wraps the payload: { "task": { "kind": "task", ... } } */
function unwrapNestedScheduleItem(o: Record<string, unknown>): Record<string, unknown> | null {
  if (shallowKindAliases(o)) return o;
  for (const nk of ['task', 'event', 'study_plan', 'item', 'data', 'payload'] as const) {
    const v = o[nk];
    if (typeof v === 'object' && v && shallowKindAliases(v as Record<string, unknown>)) {
      const inner = { ...(v as Record<string, unknown>) };
      for (const k of SPAN_TEXT_KEYS) {
        if (inner[k] == null && typeof o[k] === 'string') inner[k] = o[k];
      }
      return inner;
    }
  }
  return null;
}

function collectScheduleItemsFromArray(
  arr: unknown[],
  fallbackFullText: string
): Array<{ spanText: string; item: Record<string, unknown> }> {
  const out: Array<{ spanText: string; item: Record<string, unknown> }> = [];
  for (const el of arr) {
    if (typeof el !== 'object' || !el) continue;
    const o = el as Record<string, unknown>;
    let span = '';
    for (const k of SPAN_TEXT_KEYS) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) {
        span = normalizeSchedulingUserText(v);
        break;
      }
    }
    const stripped: Record<string, unknown> = { ...o };
    for (const k of SPAN_TEXT_KEYS) delete stripped[k];
    const candidate = unwrapNestedScheduleItem(stripped) ?? stripped;
    const nk = shallowKindAliases(candidate) ?? inferKindFromObjectShapeAndText(candidate, fallbackFullText);
    if (!nk) continue;
    const item = { ...candidate, kind: nk };
    out.push({ spanText: span || fallbackFullText, item });
  }
  return out;
}

function splitLikelyMultiIntentText(text: string): string[] {
  const raw = normalizeSchedulingUserText(text);
  if (!raw) return [];
  if (isSinglePlanAlternatingSubjectsCue(raw)) return [];
  /** "…next day and just keep that going" is one intent, not two "and" clauses. */
  if (/\bnext\s+day\s+and\s+(just\s+)?keep\b/i.test(raw)) return [];
  const hasDurationCue = (s: string) => /\b\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours|min|mins|minute|minutes)\b/i.test(s);
  const hasCadenceCue = (s: string) =>
    /\b(every|weekly|daily|each day|every day|every other day|alternate days?|on the other days?)\b/i.test(s);
  const enrichSegmentWithSharedCadenceAndDuration = (base: string, candidate: string): string => {
    let out = candidate.trim();
    const cadence = base.match(/\b(every other day|alternate days?|every day|daily|weekly)\b/i)?.[1] ?? null;
    const duration = base.match(/\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|minute|minutes)\b/i)?.[0] ?? null;
    if (cadence && !hasCadenceCue(out)) out = `${out} ${cadence}`.trim();
    if (duration && !hasDurationCue(out)) out = `${out}, ${duration}`.trim();
    return out;
  };
  const explicitParts = raw
    .split(/\s*(?:\n+|;|(?:\s+\+\s+))\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const cue = (s: string) =>
    /\b(due|by|before|until|tomorrow|today|next|every|weekly|daily|at\s+\d|am|pm|all[-\s]?day|session|sessions|times?|hours?|minutes?|every\s+other\s+day|alternate)\b/i.test(
      s
    );
  const strongExplicit = explicitParts.filter((p) => cue(p));
  if (strongExplicit.length >= 2) return strongExplicit;

  // Light split on " and " only when both sides look schedulable.
  const andParts = raw
    .split(/\s+\band\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (andParts.length >= 2) {
    if (
      andParts.length === 2 &&
      /\b(on\s+the\s+other\s+days?|other\s+days?)\b/i.test(andParts[1]!) &&
      hasCadenceCue(andParts[0]!)
    ) {
      return [andParts[0]!, enrichSegmentWithSharedCadenceAndDuration(andParts[0]!, andParts[1]!)];
    }
    const scored = andParts.filter((p) => cue(p));
    if (scored.length >= 2) {
      if (andParts.length === 2 && hasCadenceCue(andParts[0]!) && hasDurationCue(andParts[0]!)) {
        return [andParts[0]!, enrichSegmentWithSharedCadenceAndDuration(andParts[0]!, andParts[1]!)];
      }
      return andParts;
    }
  }
  return [];
}

type ParseTaskSlimContext = { e: Array<{ n: string }>; a: Array<{ t: string }> };

function primaryTitleFromScheduleItem(item: Record<string, unknown>): string | null {
  if (String(item.kind) === 'study_plan') {
    const sum = item.summary;
    if (typeof sum === 'string' && sum.trim()) return sum.trim();
    const tasks = item.tasks as unknown[] | undefined;
    const t0 = tasks?.[0] as Record<string, unknown> | undefined;
    const tt = t0?.title;
    if (typeof tt === 'string' && tt.trim()) return tt.trim();
    return null;
  }
  const t = item.title;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

/**
 * Models often echo **active task / exam titles** from CTX as extra event/task rows even when
 * the user never mentioned them. Drop those when we are not in an explicit multi-intent split.
 */
function filterSpuriousBatchItemsFromContext(
  extracted: Array<{ spanText: string; item: Record<string, unknown> }>,
  userText: string,
  ctx: ParseTaskSlimContext | null
): Array<{ spanText: string; item: Record<string, unknown> }> {
  if (!ctx || extracted.length <= 1) return extracted;
  if (splitLikelyMultiIntentText(userText).length >= 2) return extracted;

  const u = userText.toLowerCase();
  const ctxTitles = new Set<string>();
  for (const x of ctx.a) {
    const s = normToken(x.t);
    if (s.length >= 3) ctxTitles.add(s);
  }
  for (const x of ctx.e) {
    const s = normToken(x.n);
    if (s.length >= 3) ctxTitles.add(s);
  }
  if (ctxTitles.size === 0) return extracted;

  return extracted.filter(({ item }) => {
    const k = String(item.kind);
    if (k !== 'event' && k !== 'task') return true;
    const title = primaryTitleFromScheduleItem(item);
    if (!title) return true;
    const nt = normToken(title);
    if (!ctxTitles.has(nt)) return true;
    return u.includes(nt);
  });
}

/** When the user clearly asked for one alternating-subject plan but the model returned extras. */
function collapseToSingleRotatingStudyPlan(
  extracted: Array<{ spanText: string; item: Record<string, unknown> }>,
  userText: string
): Array<{ spanText: string; item: Record<string, unknown> }> {
  if (extracted.length <= 1) return extracted;
  if (splitLikelyMultiIntentText(userText).length >= 2) return extracted;
  if (!isSinglePlanAlternatingSubjectsCue(userText)) return extracted;

  const hasRotateMeta = (item: Record<string, unknown>) => {
    const m = parseScheduleMetadata(item);
    return m?.pattern === 'rotate_daily' && m.cycle.length >= 2;
  };

  const rotatePlans = extracted.filter((x) => x.item.kind === 'study_plan' && hasRotateMeta(x.item));
  if (rotatePlans.length === 1) return rotatePlans;

  const plans = extracted.filter((x) => x.item.kind === 'study_plan');
  if (plans.length === 1) return plans;

  return extracted;
}

/** "physics one day then english next day … keep that going lol" */
function extractThemesOneDayThenNextFromText(raw: string): string[] {
  const stripped = raw
    .replace(/\b(ok\s+so\s+like|yeah\s+so|um+|uh+|lol|lmao|haha|pls|please|kinda|sorta)\b/gi, ' ')
    .replace(/\s+/g, ' ');
  const m1 = stripped.match(
    /\b([a-z][a-z0-9\s]{0,40}?)\s+one\s+day\s+then\s+([a-z][a-z0-9\s]{0,40}?)\s+next\s+day\b/i
  );
  const m2 = stripped.match(
    /\b([a-z][a-z0-9\s]{0,40}?)\s+then\s+([a-z][a-z0-9\s]{0,40}?)\s+(?:the\s+)?next\s+day\b/i
  );
  const tidyTrail = (s: string) =>
    s.replace(/\s+(and\s+)?(just\s+)?(keep|going|that\s+going|that|repeat|alternat\w*|cycle|same\s+thing).*$/i, '').trim();
  const tidy = (s: string) =>
    tidyTrail(
      String(s || '')
        .replace(/\b(so|like|just)\b/gi, '')
        .replace(/\b(prep|practice|study|revision)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  const pick = m1 || m2;
  if (!pick) return [];
  const a = tidy(pick[1]!);
  const b = tidy(pick[2]!);
  if (!a || !b || a.length < 2 || b.length < 2) return [];
  if (!/[a-z]/i.test(a) || !/[a-z]/i.test(b)) return [];
  return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
}

function extractThemesFromOneDayCommaSegments(raw: string): string[] {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const themes: string[] = [];
  for (const p of parts) {
    const m = p.match(/^\s*one\s+day\s+(.+)$/i);
    if (!m) continue;
    let rest = m[1]!.trim();
    rest = rest.replace(/\s+(continuing|with\s+each|until|till)\b[\s\S]*$/i, '').trim();
    if (!rest) continue;
    const cleaned = rest
      .replace(/\b(prep|prepare|study|revision|revise|practice)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const title = resolveTitleFromUserText(cleaned || rest, null);
    if (title) themes.push(title);
  }
  return themes;
}

/** "between English and Physics …" / "between X and Y prep until …" */
function extractBetweenThemesFromText(raw: string): string[] {
  const m = raw.match(
    /\bbetween\s+([^,;.]+?)\s+and\s+([^,;.]+?)(?:$|[,;.]\s*|\s+until|\s+till|\s+for\s+each|\s+each\s+day|\s+daily|\s+every|\s+with\s|\s+continuing)/i
  );
  if (!m) return [];
  const tidy = (s: string) =>
    String(s || '')
      .replace(/\b(prep|practice|study|revision|revise|alternating|alternate|days?|day)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = tidy(m[1]!);
  const b = tidy(m[2]!);
  if (!a || !b || a.length > 48 || b.length > 48) return [];
  if (!/[a-z]/i.test(a) || !/[a-z]/i.test(b)) return [];
  if (/^\d+\s*$/i.test(a) || /^\d+\s*$/i.test(b)) return [];
  return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
}

function normalizeTitleForSubjectCluster(title: string): string {
  const t = String(title || '')
    .toLowerCase()
    .replace(/\b(prep|practice|study|revision|revise|session|block|slot)\b/gi, ' ')
    .replace(/\bpaper\s*\d+\b/gi, 'paper')
    .replace(/\b(part|step|q|question)\s*\d+\b/gi, '$1')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.slice(0, 80);
}

function titleReferencesSubjectHint(title: string, subjectHint: string): boolean {
  const t = normalizeTitleForSubjectCluster(title);
  const h = normalizeTitleForSubjectCluster(subjectHint);
  if (!t || !h) return false;
  if (t.includes(h) || h.includes(t)) return true;
  const hw = h.split(/\s+/).filter((w) => w.length > 2);
  return hw.some((w) => t.includes(w));
}

/** When the model duplicates "all A then all B", infer the two subject stems from micro-task titles. */
function inferDominantRotationSubjectsFromMicroTasks(
  microTasks: StudyPlanMicroOut[]
): string[] {
  if (microTasks.length < 4) return [];
  const stems = microTasks.map((m) => normalizeTitleForSubjectCluster(m.title));
  const freq = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  for (let i = 0; i < stems.length; i++) {
    const s = stems[i]!;
    if (!s || s.length < 2) continue;
    freq.set(s, (freq.get(s) ?? 0) + 1);
    if (!firstSeen.has(s)) firstSeen.set(s, i);
  }
  const ranked = [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length < 2) return [];
  const [a, b] = [ranked[0]!, ranked[1]!];
  const c0 = a[1];
  const c1 = b[1];
  if (c1 < Math.max(3, Math.floor(c0 * 0.15))) return [];
  const ratio = c1 / (c0 + 0.001);
  if (ratio < 0.12 || ratio > 8) return [];
  const pair = [a, b].sort((x, y) => (firstSeen.get(x[0]) ?? 0) - (firstSeen.get(y[0]) ?? 0));
  return pair.map(([stem]) => resolveTitleFromUserText(stem.split(/\s+/).slice(0, 4).join(' '), null));
}

function themeLabelForMicroTaskIndex(themes: string[], i: number, templateTitle: string): string {
  const theme = themes[i % themes.length]!;
  const tt = String(templateTitle || '').toLowerCase();
  if (/\bprep\b/i.test(tt)) return `${theme} prep`;
  if (/\bpractice\b/i.test(tt)) return `${theme} practice`;
  if (/\bstudy\b/i.test(tt)) return `${theme} study`;
  return `${theme} prep`;
}

function detectSplitDuplicateSubjectRuns(
  microTasks: StudyPlanMicroOut[],
  themes: string[]
): boolean {
  if (themes.length !== 2 || microTasks.length < 6) return false;
  const s0 = normalizeTitleForSubjectCluster(themes[0]!);
  const s1 = normalizeTitleForSubjectCluster(themes[1]!);
  const n = microTasks.length;
  const mid = Math.floor(n / 2);
  const labels = microTasks.map((m) => {
    const t = normalizeTitleForSubjectCluster(m.title);
    const h0 = t.includes(s0) || s0.split(/\s+/).some((w) => w.length > 2 && t.includes(w));
    const h1 = t.includes(s1) || s1.split(/\s+/).some((w) => w.length > 2 && t.includes(w));
    if (h0 && !h1) return 0;
    if (h1 && !h0) return 1;
    return -1;
  });
  const left0 = labels.slice(0, mid).filter((x) => x === 0).length;
  const left1 = labels.slice(0, mid).filter((x) => x === 1).length;
  const right0 = labels.slice(mid).filter((x) => x === 0).length;
  const right1 = labels.slice(mid).filter((x) => x === 1).length;
  return left0 >= mid * 0.55 && right1 >= (n - mid) * 0.55 && left1 < mid * 0.2 && right0 < (n - mid) * 0.2;
}

function countThemeHitsInMicroTasks(
  microTasks: StudyPlanMicroOut[],
  themes: string[]
): number[] {
  return themes.map((th) => microTasks.filter((m) => titleReferencesSubjectHint(m.title, th)).length);
}

function extractRotatingThemesFromUserText(text: string): string[] {
  const raw = normalizeSchedulingUserText(text);
  const t = raw.toLowerCase();

  const fromThenNext = extractThemesOneDayThenNextFromText(raw);
  if (fromThenNext.length >= 2) return fromThenNext;

  const fromOneDay = extractThemesFromOneDayCommaSegments(raw);
  if (fromOneDay.length >= 2) return fromOneDay;

  const fromBetween = extractBetweenThemesFromText(raw);
  if (fromBetween.length >= 2) return fromBetween;

  if (!/\b(every\s+other\s+day|alternate\s+days?)\b/i.test(t)) return [];

  const tidy = (s: string): string =>
    String(s || '')
      .replace(/\b(on\s+the\s+other\s+days?|every\s+other\s+day|alternate\s+days?)\b/gi, '')
      .replace(/\b(practice|prep|prepare|study|revision|revise|do|work on)\b/gi, '')
      .replace(/\b(of|for|the|my|our|your)\b/gi, ' ')
      .replace(/\b\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours|min|mins|minute|minutes)\b/gi, '')
      .replace(/[,:;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const altPair = raw.match(/\b(.+?)\s+every\s+other\s+day\s+and\s+(.+?)\s+on\s+the\s+other\s+days?\b/i);
  if (altPair) {
    const a = tidy(altPair[1]);
    const b = tidy(altPair[2]);
    if (a && b) return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
  }

  const listPair = raw.match(/\b(?:practice|prep|study|revision|revise)\s+(?:of\s+)?([a-z][a-z\s]{1,40}?)\s+and\s+([a-z][a-z\s]{1,40}?)(?:\b|,)/i);
  if (listPair) {
    const a = tidy(listPair[1]);
    const b = tidy(listPair[2]);
    if (a && b) return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
  }
  // "physics and chem prep", "math and bio revision"
  const nounTailPair = raw.match(
    /\b([a-z][a-z\s]{1,24}?)\s+and\s+([a-z][a-z\s]{1,24}?)\s+(?:prep|practice|revision|study)\b/i
  );
  if (nounTailPair) {
    const a = tidy(nounTailPair[1]);
    const b = tidy(nounTailPair[2]);
    if (a && b) return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
  }

  return [];
}

function extractAlternatingThemesFromText(text: string): string[] {
  return extractRotatingThemesFromUserText(text);
}

function extractRotationSubjectsHint(parsed: Record<string, unknown>): string[] {
  const normalize = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0 && s.length < 80)
        .slice(0, 8)
      : [];
  const md = parseScheduleMetadata(parsed);
  const fromGroq = md?.pattern === 'rotate_daily' && md.cycle.length >= 2 ? md.cycle : [];
  const top = normalize(parsed.rotationSubjects);
  const tasks = parsed.tasks;
  let nested: string[] = [];
  if (Array.isArray(tasks) && tasks[0] != null && typeof tasks[0] === 'object') {
    const t0 = tasks[0] as Record<string, unknown>;
    nested = normalize(t0.rotationSubjects);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...fromGroq, ...top, ...nested]) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.slice(0, 8);
}

function resolveRotationThemesForTask(
  sourceText: string,
  microTasks: StudyPlanMicroOut[],
  hint: string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (arr: string[]) => {
    for (const s of arr) {
      const t = String(s).trim();
      if (!t || t.length > 80) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  };
  push(hint);
  push(extractRotatingThemesFromUserText(sourceText));
  if (out.length < 2) {
    push(inferDominantRotationSubjectsFromMicroTasks(microTasks));
  }
  return out.slice(0, 8);
}

function shouldFlattenToOneSessionPerDayRotation(args: {
  cadence: StudyCadence;
  themes: string[];
  sourceText: string;
  microTasks: StudyPlanMicroOut[];
  candidateDatesLen: number;
  rotationHintLen: number;
  aiMeta: ParsedScheduleMetadata | null;
}): boolean {
  const { cadence, themes, sourceText, microTasks, candidateDatesLen, rotationHintLen, aiMeta } = args;
  if (aiMeta?.pattern === 'rotate_daily' && aiMeta.cycle.length >= 2) return true;
  if (themes.length < 2) return false;

  const raw = normalizeSchedulingUserText(sourceText);

  if (cadence.kind === 'alternate') return true;

  if (cadence.kind === 'daily') {
    if (rotationHintLen >= 2) {
      const matched = themes.filter((th) =>
        microTasks.some((m) => titleReferencesSubjectHint(m.title, th))
      );
      if (matched.length >= 2 || microTasks.length > candidateDatesLen) return true;
    }
    if (hasTwoSubjectOneDayRotationPattern(raw)) return true;
    if (extractBetweenThemesFromText(raw).length >= 2) return true;
    if (microTasks.length > candidateDatesLen) return true;
    if (detectSplitDuplicateSubjectRuns(microTasks, themes)) return true;
    const counts = countThemeHitsInMicroTasks(microTasks, themes);
    if (
      themes.length === 2 &&
      microTasks.length > candidateDatesLen &&
      microTasks.length >= 8 &&
      counts[0]! >= Math.floor(candidateDatesLen * 0.33) &&
      counts[1]! >= Math.floor(candidateDatesLen * 0.33)
    )
      return true;
  }

  if (cadence.kind === 'weekly' || cadence.kind === 'biweekly') {
    if (rotationHintLen >= 2 && microTasks.length > candidateDatesLen) return true;
    if (microTasks.length > candidateDatesLen && themes.length >= 2) return true;
  }

  return false;
}

function enforceCadenceOnNormalizedStudyPlan(
  plan: { summary: string; tasks: StudyPlanTaskOut[]; truncated?: boolean },
  sourceText: string,
  todayLocal: Date,
  rotationSubjectsHint: string[] = [],
  aiMeta: ParsedScheduleMetadata | null = null
): { summary: string; tasks: StudyPlanTaskOut[]; truncated?: boolean } {
  let cadence: StudyCadence | null = inferStudyCadenceFromText(sourceText);
  if (!cadence && aiMeta?.pattern === 'rotate_daily' && aiMeta.cycle.length >= 2) {
    cadence = { kind: 'alternate' };
  }
  if (!cadence) return plan;

  const MAX_AUTOGEN = 200;

  const outTasks = plan.tasks.map((task) => {
    const due = parseCalendarDate(task.dueDate);
    const lastSched = lastScheduleDayBeforeDue(due, todayLocal);
    const themesResolved =
      aiMeta?.pattern === 'rotate_daily' && aiMeta.cycle.length >= 2
        ? aiMeta.cycle.slice(0, 8)
        : resolveRotationThemesForTask(sourceText, task.microTasks, rotationSubjectsHint);
    /** Two rotating subjects on "alternate days" wording still map to **one session per calendar day** (A/B/A/B). */
    const alternateIsDailySubjectSwap =
      cadence.kind === 'alternate' && themesResolved.length >= 2;

    const candidateDates: string[] = [];
    for (let d = new Date(todayLocal); d.getTime() <= lastSched.getTime(); d = addDays(d, 1)) {
      const dow = d.getDay();
      if (cadence.kind === 'weekly' || cadence.kind === 'biweekly') {
        if (!cadence.daysOfWeek.includes(dow)) continue;
        if (cadence.kind === 'biweekly') {
          const deltaDays = Math.floor((d.getTime() - todayLocal.getTime()) / 86400000);
          const weekBucket = Math.floor(deltaDays / 7);
          if (weekBucket % 2 !== 0) continue;
        }
      } else if (cadence.kind === 'daily') {
        // any day
      } else if (cadence.kind === 'alternate') {
        if (!alternateIsDailySubjectSwap) {
          const deltaDays = Math.floor((d.getTime() - todayLocal.getTime()) / 86400000);
          if (deltaDays % 2 !== 0) continue;
        }
      }
      candidateDates.push(toLocalYYYYMMDD(d));
    }
    if (candidateDates.length === 0) return task;
    const flatten =
      (themesResolved.length >= 2 || (aiMeta?.pattern === 'rotate_daily' && aiMeta.cycle.length >= 2)) &&
      shouldFlattenToOneSessionPerDayRotation({
        cadence,
        themes: themesResolved,
        sourceText,
        microTasks: task.microTasks,
        candidateDatesLen: candidateDates.length,
        rotationHintLen: rotationSubjectsHint.length,
        aiMeta,
      });

    /** Multi-subject rotation: exactly one session per eligible calendar day (no duplicated A-block + B-block). */
    if (flatten) {
      const n = Math.min(MAX_AUTOGEN, candidateDates.length);
      const minsFromText = extractDurationMinutesFromUserText(sourceText);
      const t0 = task.microTasks[0];
      const templateMins = t0?.estimatedMinutes ?? 60;
      const mins = Math.max(
        10,
        Math.min(
          480,
          minsFromText != null && Number.isFinite(minsFromText) ? minsFromText : templateMins
        )
      );
      const desc0 = t0?.description ? String(t0.description).trim() : '';
      const templateTitle = t0?.title ?? '';
      const microsOut: StudyPlanMicroOut[] = [];
      for (let i = 0; i < n; i++) {
        microsOut.push({
          title: themeLabelForMicroTaskIndex(themesResolved, i, templateTitle),
          ...(desc0 ? { description: desc0 } : {}),
          estimatedMinutes: mins,
          scheduledDate: candidateDates[i]!,
        });
      }
      return {
        ...task,
        microTasks: microsOut,
        estimatedTotalMinutes: microsOut.reduce((a, m) => a + m.estimatedMinutes, 0),
      };
    }

    const targetCount = Math.min(
      MAX_AUTOGEN,
      Math.max(task.microTasks.length, candidateDates.length)
    );
    const expandedMicros: StudyPlanMicroOut[] = [];
    for (let i = 0; i < targetCount; i++) {
      const base = task.microTasks[i] ?? task.microTasks[i % Math.max(1, task.microTasks.length)]!;
      expandedMicros.push({
        title: base.title,
        ...(base.description ? { description: base.description } : {}),
        estimatedMinutes: base.estimatedMinutes,
        scheduledDate: base.scheduledDate,
      });
    }

    const rewritten = expandedMicros.map((mt, i) => {
      const date =
        i < candidateDates.length
          ? candidateDates[i]!
          : candidateDates[candidateDates.length - 1]!;
      return { ...mt, scheduledDate: date };
    });

    return {
      ...task,
      microTasks: rewritten,
      estimatedTotalMinutes: rewritten.reduce((a, m) => a + m.estimatedMinutes, 0),
    };
  });

  return { ...plan, tasks: outTasks };
}

/**
 * Accepts legacy `{ kind }`, `{ type }`, `{ items: [...] }`, top-level arrays, nested `response`/`data`, etc.
 * Callers add a text fallback if this still yields nothing.
 */
function extractScheduleItemsFromAiRoot(
  root: unknown,
  fallbackFullText: string
): Array<{ spanText: string; item: Record<string, unknown> }> {
  if (root == null) return [];

  if (Array.isArray(root)) {
    return collectScheduleItemsFromArray(root, fallbackFullText);
  }

  if (typeof root !== 'object') return [];

  const r = root as Record<string, unknown>;
  let topKind = shallowKindAliases(r);
  if (!topKind) topKind = inferKindFromObjectShapeAndText(r, fallbackFullText);

  if (topKind) {
    const item: Record<string, unknown> = { ...r, kind: topKind };
    delete item.items;
    return [{ spanText: fallbackFullText, item }];
  }

  const nested = firstObjectWithScheduleShape(r);
  if (nested) {
    const nk = shallowKindAliases(nested) ?? inferKindFromObjectShapeAndText(nested, fallbackFullText);
    if (nk) {
      const item: Record<string, unknown> = { ...nested, kind: nk };
      delete item.items;
      return [{ spanText: fallbackFullText, item }];
    }
  }

  const listKeys = ['items', 'schedule', 'entries', 'commitments', 'plans', 'results'] as const;
  for (const lk of listKeys) {
    const raw = r[lk];
    if (Array.isArray(raw) && raw.length > 0) {
      const fromList = collectScheduleItemsFromArray(raw, fallbackFullText);
      if (fromList.length > 0) return fromList;
    }
  }

  return [];
}

function applyParseTaskHeuristics(
  seg: string,
  parsed: Record<string, unknown>
): Record<string, unknown> {
  let p = { ...parsed };
  const coercedKind = shallowKindAliases(p);
  if (coercedKind) p = { ...p, kind: coercedKind };
  const m1 = fixMisclassifiedWeeklyMeetingAsEvent(seg, p);
  if (m1) p = m1;
  const m2 = fixMisclassifiedRecurringWeekdayClockBlockAsEvent(seg, p);
  if (m2) p = m2;
  const m3 = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(seg, p);
  if (m3) p = m3;
  const m4 = fixMisclassifiedRecurringActivityPlan(seg, p);
  if (m4) p = m4;
  const m4n = fixMisclassifiedRecurringNthWeekdaySlotAsEvent(seg, p);
  if (m4n) p = m4n;
  const m5 = fixMisclassifiedAlternatingWeekdayPlanAsEvent(seg, p);
  if (m5) p = m5;
  p = reconcileTaskVsEventKindFromUserText(seg, p);
  p = stripSpuriousEventWeeklyRepeat(seg, p);
  p = ensureEventWeeklyRepeatFromUserText(seg, p);
  return p;
}

function serializeWeeklyRepeatForClient(rep: CalendarEvent['repeat'] | null | undefined): {
  frequency: 'weekly';
  interval: number;
  daysOfWeek: number[];
  endDate?: string;
} | null {
  if (!rep || rep.frequency !== 'weekly' || !Array.isArray(rep.daysOfWeek) || rep.daysOfWeek.length === 0) {
    return null;
  }
  const end = rep.endDate
    ? rep.endDate instanceof Date
      ? rep.endDate
      : new Date(String(rep.endDate))
    : null;
  const endOk = end && !Number.isNaN(end.getTime()) ? toLocalYYYYMMDD(end) : undefined;
  return {
    frequency: 'weekly',
    interval: Number.isFinite(Number(rep.interval)) && Number(rep.interval) > 0 ? Number(rep.interval) : 1,
    daysOfWeek: rep.daysOfWeek,
    ...(endOk ? { endDate: endOk } : {}),
  };
}

/** Downstream scheduler metadata — cadence is inferred once here, not re-parsed client-side. */
function deriveSchedulePatternMeta(
  sourceText: string,
  aiMeta: ParsedScheduleMetadata | null
): {
  schedulePattern: string;
  patternCycleLength: number | null;
} {
  if (aiMeta?.pattern === 'rotate_daily' && aiMeta.cycle.length >= 2) {
    return { schedulePattern: 'custom_cycle', patternCycleLength: aiMeta.cycle.length };
  }
  if (aiMeta?.pattern === 'every_nth_week') {
    return { schedulePattern: 'specific_days', patternCycleLength: aiMeta.everyNWeeks };
  }
  if (aiMeta?.pattern === 'every_other_day') {
    return { schedulePattern: 'alternate', patternCycleLength: null };
  }
  if (aiMeta?.pattern === 'pack') {
    return { schedulePattern: 'unspecified', patternCycleLength: null };
  }

  const c = inferStudyCadenceFromText(sourceText);
  if (!c) {
    return { schedulePattern: 'unspecified', patternCycleLength: null };
  }
  if (c.kind === 'daily') {
    const th = extractRotatingThemesFromUserText(sourceText);
    if (th.length >= 2) {
      return { schedulePattern: 'custom_cycle', patternCycleLength: th.length };
    }
    return { schedulePattern: 'daily', patternCycleLength: null };
  }
  if (c.kind === 'weekly' || c.kind === 'biweekly') {
    const len = c.daysOfWeek.length;
    return { schedulePattern: 'specific_days', patternCycleLength: len > 0 ? len : null };
  }
  if (c.kind === 'alternate') {
    const th = extractAlternatingThemesFromText(sourceText);
    if (th.length >= 2) {
      return { schedulePattern: 'custom_cycle', patternCycleLength: th.length };
    }
    return { schedulePattern: 'alternate', patternCycleLength: null };
  }
  return { schedulePattern: 'unspecified', patternCycleLength: null };
}

type ParseTaskItemBuildResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function buildParseTaskItemResponse(
  seg: string,
  parsedIn: Record<string, unknown>,
  todayLocal: Date,
  nowLocal: Date
): ParseTaskItemBuildResult {
  let parsed = applyParseTaskHeuristics(seg, parsedIn);
  const aiScheduleMeta = parseScheduleMetadata(parsed);
  if (aiScheduleMeta) {
    parsed = overlayScheduleMetadataOnEvent(parsed, aiScheduleMeta);
  }

  // If the model returns a plain task for recurring cadence text, lift it to a study_plan seed first.
  if (parsed.kind === 'task') {
    const groqRotate =
      aiScheduleMeta?.pattern === 'rotate_daily' && aiScheduleMeta.cycle.length >= 2;
    const cadence = inferStudyCadenceFromText(seg);
    const looksEvent = userTextIndicatesCalendarEvent(seg);
    const looksFlexible = userTextIndicatesFlexibleTask(seg);
    if (!looksEvent && (groqRotate || (cadence && looksFlexible))) {
      const dueGuess = inferDueDateFromText(seg, nowLocal);
      const dueDateRaw =
        dueGuess ??
        (parsed.dueDate ? parseCalendarDate(String(parsed.dueDate)) : addDays(todayLocal, 7));
      const dueDate = dueDateRaw < todayLocal ? new Date(todayLocal) : dueDateRaw;
      const minsFromText = extractDurationMinutesFromUserText(seg);
      const minsFromParsed = Math.round(Number(parsed.sessionMinutes));
      const estHours = Number(parsed.estimatedHours);
      const sessionMinutes = Math.max(
        10,
        Math.min(
          8 * 60,
          Number.isFinite(minsFromText)
            ? Number(minsFromText)
            : Number.isFinite(minsFromParsed) && minsFromParsed > 0
              ? minsFromParsed
              : Math.round((Number.isFinite(estHours) && estHours > 0 ? estHours : 1) * 60)
        )
      );

      const titleResolved = resolveTitleFromUserText(seg, parsed.title != null ? String(parsed.title) : null);
      const preservedScheduleMeta = parsed.scheduleMetadata;
      parsed = {
        kind: 'study_plan',
        summary: `${titleResolved} recurring plan`,
        tasks: [
          {
            title: titleResolved,
            description: parsed.description != null ? String(parsed.description) : null,
            subject: parsed.subject != null ? String(parsed.subject) : null,
            dueDate: toLocalYYYYMMDD(dueDate),
            priority: parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'medium',
            microTasks: [
              {
                title: titleResolved,
                description: undefined,
                estimatedMinutes: sessionMinutes,
                scheduledDate: '',
              },
            ],
          },
        ],
        ...(preservedScheduleMeta != null ? { scheduleMetadata: preservedScheduleMeta } : {}),
      };
    }
  }

  if (parsed.kind === 'study_plan') {
    const rotationHint = extractRotationSubjectsHint(parsed);
    parsed = expandStudyPlanRecurringSessionsFromText(seg, parsed, todayLocal);
    const normalized = normalizeStudyPlanFromParsed(parsed, todayLocal);
    const dedupedParents = normalized
      ? mergeStudyPlanParentTasksWithIdenticalMicroStacks(normalized)
      : null;
    const studyPlan = dedupedParents
      ? enforceCadenceOnNormalizedStudyPlan(dedupedParents, seg, todayLocal, rotationHint, aiScheduleMeta)
      : null;
    if (studyPlan) {
      const patternMeta = deriveSchedulePatternMeta(seg, aiScheduleMeta);
      return {
        ok: true,
        body: {
          success: true,
          kind: 'study_plan',
          sourceSpan: seg,
          summary: studyPlan.summary,
          tasks: studyPlan.tasks,
          schedulePattern: patternMeta.schedulePattern,
          patternCycleLength: patternMeta.patternCycleLength,
          ...(rotationHint.length > 0 ? { rotationSubjects: rotationHint } : {}),
          ...(parsed.scheduleMetadata != null ? { scheduleMetadata: parsed.scheduleMetadata } : {}),
          ...(studyPlan.truncated ? { truncated: true } : {}),
        },
      };
    }
    /** Model returned study_plan-shaped JSON we cannot normalize — degrade to a normal task instead of failing. */
    const title =
      String(parsed.summary || parsed.title || '').trim().slice(0, 200) ||
      resolveTitleFromUserText(seg, null);
    let dueD = parsed.dueDate ? parseCalendarDate(String(parsed.dueDate)) : addDays(todayLocal, 7);
    if (Number.isNaN(dueD.getTime()) || dueD < todayLocal) dueD = addDays(todayLocal, 7);
    const sessionStyle = inferTaskSessionStyle(seg, { ...parsed, kind: 'task' });
    const dm = extractDurationMinutesFromUserText(seg);
    parsed = {
      ...parsed,
      kind: 'task',
      title,
      dueDate: toLocalYYYYMMDD(dueD),
      priority: parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'medium',
      sessionStyle,
      estimatedHours: sessionStyle === 'single_block' ? Math.max(0.5, (dm ?? 60) / 60) : 2,
      ...(sessionStyle === 'single_block'
        ? { sessionMinutes: Math.max(10, Math.min(8 * 60, dm ?? 60)) }
        : {}),
    };
  }

  /**
   * Generic constraint repair when model under-outputs repeated sessions.
   * Works across domains (papers, workouts, practice runs, interview rounds, etc.),
   * without relying on task-specific keywords.
   */
  const inferRepeatedSessionConstraints = (
    text: string
  ): { count: number; minutesPerSession: number; oneGo: boolean } | null => {
    const t = normalizeSchedulingUserText(text).toLowerCase();
    const mins = extractDurationMinutesFromUserText(t);
    if (mins == null || mins < 10) return null;
    const minutesPerSession = Math.max(10, Math.min(8 * 60, Math.round(mins)));

    const countPatterns = [
      /\b(\d{1,3})\s*x\b/i,
      /\b(\d{1,3})\s+times?\b/i,
      /\b(\d{1,3})\s+(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?|exams?)\b/i,
      /\bhave\s+(\d{1,3})\b/i,
    ] as const;
    let count: number | null = null;
    for (const p of countPatterns) {
      const m = t.match(p);
      if (!m) continue;
      const n = Math.round(Number(m[1]));
      if (Number.isFinite(n) && n >= 2 && n <= 200) {
        count = n;
        break;
      }
    }
    if (count == null) return null;

    const perItemCue =
      /\b(each|every|per)\b/i.test(t) ||
      /\bone\s+at\s+a\s+time\b/i.test(t) ||
      /\bone\s+by\s+one\b/i.test(t);
    const oneGo =
      /\b(one\s+go|one\s+sitting|single\s+sitting|in\s+one\s+shot|uninterrupted)\b/i.test(t);
    const hasDeadlineCue =
      /\b(by|before|until|done\s+by|complete\s+by|due)\b/i.test(t) || inferDueDateFromText(text, nowLocal) != null;
    if (!perItemCue && !oneGo) return null;
    if (!hasDeadlineCue) return null;

    return { count, minutesPerSession, oneGo };
  };

  const inferRepeatedSessionUnitLabel = (text: string): string => {
    const t = normalizeSchedulingUserText(text).toLowerCase();
    if (/\bpast\s+papers?|practice\s+papers?|question\s+papers?|timed\s+papers?|papers?\b/i.test(t)) return 'Paper';
    if (/\bmock\s+exams?|exams?\b/i.test(t)) return 'Exam session';
    if (/\bessay|essays|dissertation|coursework|report\b/i.test(t)) return 'Writing block';
    if (/\bproblem\s+sets?|problems?\b/i.test(t)) return 'Problem set';
    return 'Session';
  };

  if (parsed.kind !== 'event') {
    const constraints = inferRepeatedSessionConstraints(seg);
    if (constraints) {
      const inferred = inferDueDateFromText(seg, nowLocal);
      const dueDateRaw =
        inferred ??
        (parsed.dueDate ? parseCalendarDate(String(parsed.dueDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      const dueDate = dueDateRaw < todayLocal ? new Date(todayLocal) : dueDateRaw;

      const titleResolved = resolveTitleFromUserText(seg, parsed.title != null ? String(parsed.title) : null);
      const unitLabel = inferRepeatedSessionUnitLabel(seg);
      const parentTitle = `${titleResolved} sessions`;
      const microTasks = Array.from({ length: constraints.count }, (_, i) => ({
        title: `${unitLabel} ${i + 1}`,
        description: constraints.oneGo
          ? `Complete in one sitting (${constraints.minutesPerSession} min).`
          : `Focused session (${constraints.minutesPerSession} min).`,
        estimatedMinutes: constraints.minutesPerSession,
        scheduledDate: '',
      }));

      return {
        ok: true,
        body: {
          success: true,
          kind: 'study_plan',
          sourceSpan: seg,
          summary: `${constraints.count} sessions of ${constraints.minutesPerSession} minutes each by ${toLocalYYYYMMDD(
            dueDate
          )}.`,
          tasks: [
            {
              title: parentTitle,
              description: parsed.description != null ? String(parsed.description) : null,
              subject: parsed.subject != null ? String(parsed.subject) : null,
              dueDate: toLocalYYYYMMDD(dueDate),
              priority: parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'medium',
              microTasks,
              estimatedTotalMinutes: constraints.count * constraints.minutesPerSession,
            },
          ],
          ...(parsed.scheduleMetadata != null ? { scheduleMetadata: parsed.scheduleMetadata } : {}),
        },
      };
    }
  }

  const kind: 'task' | 'event' = parsed.kind === 'event' ? 'event' : 'task';

  if (kind === 'event') {
    let startDate = parsed.startDate ? parseCalendarDate(String(parsed.startDate)) : new Date();
    if (Number.isNaN(startDate.getTime())) startDate = new Date();

    let eventRepeat = parsed.repeat as CalendarEvent['repeat'] | null | undefined;
    if (
      eventRepeat?.frequency === 'weekly' &&
      Array.isArray(eventRepeat.daysOfWeek) &&
      eventRepeat.daysOfWeek.length
    ) {
      eventRepeat = {
        ...eventRepeat,
        daysOfWeek: sanitizeWeeklyRepeatDaysFromUserText(seg, eventRepeat.daysOfWeek),
      };
      const edRaw = (eventRepeat as { endDate?: unknown }).endDate;
      if (edRaw != null && String(edRaw).trim()) {
        const ed = parseCalendarDate(String(edRaw).slice(0, 10));
        if (!Number.isNaN(ed.getTime())) {
          eventRepeat = { ...eventRepeat, endDate: ed } as CalendarEvent['repeat'];
        }
      }
    } else {
      eventRepeat = eventRepeat ?? null;
    }

    let startTimeOut = (parsed.startTime as string | null | undefined) ?? null;
    let endTimeOut = (parsed.endTime as string | null | undefined) ?? null;
    const inferredTimes = extractEventTimeRangeFromUserText(seg);
    if (!startTimeOut && inferredTimes) {
      startTimeOut = inferredTimes.startHHMM;
      endTimeOut = endTimeOut ?? inferredTimes.endHHMM ?? null;
    }

    const hasWeeklyRepeat =
      eventRepeat?.frequency === 'weekly' &&
      Array.isArray(eventRepeat.daysOfWeek) &&
      eventRepeat.daysOfWeek.length > 0;

    if (hasWeeklyRepeat && eventRepeat?.daysOfWeek?.length) {
      startDate = nextOccurrenceForWeeklyRepeat({
        today: nowLocal,
        daysOfWeek: eventRepeat.daysOfWeek,
        startTimeHHMM: startTimeOut,
      });
    }

    if (!hasWeeklyRepeat) {
      const inferredDay = inferCalendarDayFromUserText(seg, nowLocal);
      if (inferredDay) {
        const norm = normalizeSchedulingUserText(seg);
        const hasExplicitIso = /\d{4}-\d{2}-\d{2}/.test(seg);
        const weekdayNamed = extractWeekdayIndicesFromUserText(norm).length > 0;
        const relativeDay =
          /\b(tomorrow|today|day after tomorrow|tonight)\b/i.test(norm) ||
          /\bin\s+\d+\s+days?\b/i.test(norm);
        const modelStr = parsed.startDate != null ? String(parsed.startDate).trim() : '';
        const modelValid = /^\d{4}-\d{2}-\d{2}$/.test(modelStr);

        if (!hasExplicitIso && (weekdayNamed || relativeDay)) {
          startDate = inferredDay;
        } else if (!modelValid) {
          startDate = inferredDay;
        }
      }
    }

    const start0 = new Date(startDate);
    start0.setHours(0, 0, 0, 0);
    if (!hasWeeklyRepeat && start0 < todayLocal) {
      startDate = new Date(todayLocal);
    }

    const rawDur = Number(parsed.durationMinutes);
    let durationMinutes =
      Number.isFinite(rawDur) && rawDur > 0 ? Math.max(5, Math.min(12 * 60, Math.round(rawDur))) : null;
    const durFromText = extractDurationMinutesFromUserText(seg);
    if (durationMinutes == null && durFromText != null) {
      durationMinutes = Math.max(5, Math.min(12 * 60, durFromText));
    }
    if (durationMinutes == null && startTimeOut && endTimeOut) {
      const [sh, sm] = startTimeOut.split(':').map((v) => parseInt(v, 10));
      const [eh, em] = endTimeOut.split(':').map((v) => parseInt(v, 10));
      if (
        [sh, sm, eh, em].every((x) => Number.isFinite(x)) &&
        eh * 60 + em > sh * 60 + sm
      ) {
        durationMinutes = Math.max(5, eh * 60 + em - (sh * 60 + sm));
      }
    }

    return {
      ok: true,
      body: {
        success: true,
        kind,
        sourceSpan: seg,
        title: resolveTitleFromUserText(seg, parsed.title != null ? String(parsed.title) : null),
        description: parsed.description != null ? String(parsed.description) : null,
        startDate: toLocalYYYYMMDD(startDate),
        startTime: startTimeOut,
        endTime: endTimeOut,
        durationMinutes,
        allDay: Boolean(parsed.allDay),
        eventType: (parsed.eventType as CalendarEvent['eventType']) || 'class',
        repeat: serializeWeeklyRepeatForClient(eventRepeat ?? null),
        ...(parsed.scheduleMetadata != null ? { scheduleMetadata: parsed.scheduleMetadata } : {}),
      },
    };
  }

  const today = nowLocal;
  const inferred = inferDueDateFromText(seg, today);
  const dueDateRaw =
    inferred ??
    (parsed.dueDate ? parseCalendarDate(String(parsed.dueDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const today0 = new Date(todayLocal);
  let dueDate = dueDateRaw < today0 ? new Date(today0) : dueDateRaw;
  if (!inferred) {
    const bareTomorrow = inferTomorrowForBarePastPaperIntent(seg, todayLocal);
    if (bareTomorrow) dueDate = bareTomorrow;
  }
  const estH = Number(parsed.estimatedHours);
  const sessionStyle = inferTaskSessionStyle(seg, parsed);
  const rawSm = Number(parsed.sessionMinutes);
  let sessionMinutes: number | null = null;
  const minutesFromUserText = extractDurationMinutesFromUserText(seg);
  if (sessionStyle === 'single_block') {
    if (minutesFromUserText != null) {
      sessionMinutes = Math.max(10, Math.min(8 * 60, minutesFromUserText));
    } else if (Number.isFinite(rawSm) && rawSm > 0) {
      sessionMinutes = Math.max(10, Math.min(8 * 60, Math.round(rawSm)));
    } else {
      const fromHours = Math.round((Number.isFinite(estH) && estH > 0 ? estH : 1) * 60);
      sessionMinutes = Math.max(10, Math.min(8 * 60, fromHours));
    }
  }
  const titleResolved = resolveTitleFromUserText(seg, parsed.title != null ? String(parsed.title) : null);
  return {
    ok: true,
    body: {
      success: true,
      kind,
      sourceSpan: seg,
      title: titleResolved,
      description: parsed.description != null ? String(parsed.description) : null,
      dueDate: toLocalYYYYMMDD(dueDate),
      priority: (parsed.priority as 'low' | 'medium' | 'high') || 'medium',
      subject: parsed.subject != null ? String(parsed.subject) : null,
      estimatedHours:
        Number.isFinite(estH) && estH > 0 ? estH : sessionStyle === 'single_block' ? (sessionMinutes ?? 60) / 60 : 2,
      sessionStyle,
      ...(sessionStyle === 'single_block' && sessionMinutes != null ? { sessionMinutes } : {}),
      ...(parsed.scheduleMetadata != null ? { scheduleMetadata: parsed.scheduleMetadata } : {}),
    },
  };
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const isValidGeminiApiKey = GEMINI_API_KEY &&
  GEMINI_API_KEY.trim() !== '' &&
  !GEMINI_API_KEY.includes('PASTE_YOUR_KEY_HERE') &&
  !GEMINI_API_KEY.includes('your_') &&
  GEMINI_API_KEY.length > 20;
if (!isValidGeminiApiKey) {
  console.warn('No valid AI API key found. Set GEMINI_API_KEY in .env.local.');
}

type ChunkedMicroTask = {
  title: string;
  description?: string;
  estimatedMinutes: number;
  order: number;
};

function normalizeChunkTitle(title: string): string {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\d.)\-\s]+/, '')
    .trim();
}

function isLowSignalChunkTitle(title: string): boolean {
  const t = normalizeChunkTitle(title).toLowerCase();
  if (!t) return true;
  if (/^(step|task|work|study)\s*\d*$/i.test(t)) return true;
  if (/^(write|work on|do)\s+(essay|project|assignment)(\s*\(part\s*\d+\))?$/i.test(t)) return true;
  if (/^\w+\s*\(part\s*\d+\)$/i.test(t)) return true;
  return false;
}

function inferWorkflowFromTaskText(title: string, description: string): 'writing' | 'project' | 'generic' {
  const blob = `${title} ${description}`.toLowerCase();
  if (/\b(essay|report|lab report|paper|dissertation|coursework|article)\b/i.test(blob)) return 'writing';
  if (/\b(project|presentation|prototype|build|experiment|poster)\b/i.test(blob)) return 'project';
  return 'generic';
}

function rewriteLowSignalChunkTitles(
  items: ChunkedMicroTask[],
  parentTitle: string,
  parentDescription: string
): ChunkedMicroTask[] {
  if (items.length === 0) return items;
  const workflow = inferWorkflowFromTaskText(parentTitle, parentDescription);
  const lowSignalCount = items.filter((it) => isLowSignalChunkTitle(it.title)).length;
  if (lowSignalCount < Math.ceil(items.length * 0.5)) return items;

  const writingPhases = [
    'Gather sources and evidence',
    'Build essay outline',
    'Write first draft',
    'Revise argument flow',
    'Edit and proofread',
    'Finalize citations and formatting',
  ];
  const projectPhases = [
    'Plan approach and checklist',
    'Build core work',
    'Complete remaining sections',
    'Test and fix issues',
    'Polish final version',
  ];
  const genericPhases = [
    'Plan the work',
    'Do focused work block 1',
    'Do focused work block 2',
    'Review and improve',
    'Finalize and submit',
  ];
  const pool = workflow === 'writing' ? writingPhases : workflow === 'project' ? projectPhases : genericPhases;

  return items.map((it, idx) => ({
    ...it,
    title: pool[Math.min(idx, pool.length - 1)]!,
  }));
}

function chunkPhaseRank(title: string): number {
  const t = normalizeChunkTitle(title).toLowerCase();
  if (/\b(read|research|gather|collect|sources?|brainstorm)\b/.test(t)) return 10;
  if (/\b(plan|outline|structure)\b/.test(t)) return 20;
  if (/\b(write|draft|develop)\b/.test(t)) return 30;
  if (/\b(revise|rewrite|improve)\b/.test(t)) return 40;
  if (/\b(edit|proofread|polish)\b/.test(t)) return 50;
  if (/\b(final|submit|citation|format)\b/.test(t)) return 60;
  return 35;
}

function finalizeChunkSequence(
  items: ChunkedMicroTask[],
  parentTitle: string,
  parentDescription: string,
  preserveOrder: boolean
): ChunkedMicroTask[] {
  const normalized = items.map((it, idx) => ({
    ...it,
    title: normalizeChunkTitle(it.title) || `Study step ${idx + 1}`,
    description: String(it.description || '').trim() || undefined,
    estimatedMinutes: Math.max(10, Math.round(Number(it.estimatedMinutes) || 25)),
    order: Number.isFinite(Number(it.order)) ? Number(it.order) : idx + 1,
  }));

  const retitled = rewriteLowSignalChunkTitles(normalized, parentTitle, parentDescription);
  const sorted = preserveOrder
    ? [...retitled].sort((a, b) => a.order - b.order)
    : [...retitled].sort((a, b) => chunkPhaseRank(a.title) - chunkPhaseRank(b.title) || a.order - b.order);

  const seen = new Map<string, number>();
  return sorted.map((it, idx) => {
    const base = normalizeChunkTitle(it.title) || `Study step ${idx + 1}`;
    const key = base.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return {
      ...it,
      title: n === 1 ? base : `${base} (${n})`,
      order: idx + 1,
    };
  });
}

type ScheduledMicroTask = ChunkedMicroTask & {
  scheduledDate?: string;
};

type StudyNowRecommendation = {
  subject: string;
  task: string;
  microTaskId: string | null;
  durationMinutes: number;
  reason: string;
};

type RebuildWeekResponse = {
  rescheduled: Array<{
    microTaskId: string;
    newDate: string;
    newStartTime: string;
    durationMinutes: number;
  }>;
  message: string;
};

type ExamPlanResponse = {
  plan: Array<{
    date: string;
    topic: string;
    durationMinutes: number;
    startTime: string;
    sessionType: 'study' | 'revision';
  }>;
  summary: string;
};

function sanitizeExamPlanRows(
  plan: ExamPlanResponse['plan'],
  examDateStr: string,
  todayStr: string
): ExamPlanResponse['plan'] {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  const examKey = String(examDateStr || '').slice(0, 10);
  const todayKey = String(todayStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examKey) || !/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return [];

  const examDay = parseLocalDateKey(examKey);
  const todayD = parseLocalDateKey(todayKey);
  const lastSched = addDays(examDay, -1);

  const out: ExamPlanResponse['plan'] = [];
  for (const row of plan) {
    const ds = String(row?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
    const d = parseLocalDateKey(ds);
    if (d.getTime() < todayD.getTime() || d.getTime() > lastSched.getTime()) continue;
    const topic = String(row?.topic || '').trim();
    if (!topic) continue;
    const durationMinutes = Math.min(180, Math.max(10, Math.round(Number(row?.durationMinutes) || 30)));
    const rawTime = String(row?.startTime || '').trim();
    const startTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : '16:00';
    out.push({
      date: ds,
      topic,
      durationMinutes,
      startTime,
      sessionType: row?.sessionType === 'revision' ? 'revision' : 'study',
    });
  }
  out.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.startTime.localeCompare(b.startTime);
  });
  return out;
}

type SyllabusBulkStructure = {
  subjects: Array<{
    name: string;
    units?: string[];
    groups?: Array<{ title?: string; topics?: string[] }>;
    chapters?: Array<{ title?: string; topics?: string[] }>;
  }>;
};

type SyllabusSubjectNormalized = {
  name: string;
  units: string[];
  groups?: Array<{ title: string; topics: string[] }>;
};

function normalizeSyllabusGroupsFromRaw(
  raw: SyllabusBulkStructure['subjects'][number]['groups']
): Array<{ title: string; topics: string[] }> | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: Array<{ title: string; topics: string[] }> = [];
  for (const g of raw) {
    const gg = g as { title?: string; topics?: unknown };
    const title =
      String(gg.title ?? (g as { chapter?: string }).chapter ?? (g as { unit?: string }).unit ?? 'Section')
        .trim() || 'Section';
    const topics = Array.isArray(gg.topics)
      ? filterTopicLines(gg.topics.map((t) => String(t).trim()).filter(Boolean))
      : [];
    if (topics.length) out.push({ title, topics });
  }
  return out.length ? out : undefined;
}

function prepareSyllabusSubjectFromAi(raw: unknown): SyllabusSubjectNormalized | null {
  const r = raw as Record<string, unknown>;
  const name = String(r.name || '').trim();
  const groupsRaw = (r.groups ?? r.chapters) as SyllabusBulkStructure['subjects'][number]['groups'];
  const groups = normalizeSyllabusGroupsFromRaw(groupsRaw);
  const flatFromUnits = Array.isArray(r.units)
    ? filterTopicLines(r.units.map((u) => String(u).trim()).filter(Boolean))
    : [];
  let units: string[];
  if (groups && groups.length > 0) {
    const fromGroups = groups.flatMap((g) => g.topics);
    units = filterTopicLines(fromGroups.length > 0 ? fromGroups : flatFromUnits);
  } else {
    units = flatFromUnits;
  }
  if (!name && units.length === 0) return null;
  return {
    name: name || 'General',
    units,
    groups,
  };
}

type MultiExamPlanResult = {
  feasible: boolean;
  adjustmentAdvice: string;
  summary: string;
  plans: Array<{
    subject: string;
    plan: ExamPlanResponse['plan'];
  }>;
};

type TopicDurationResponse = {
  subjects: Array<{
    name: string;
    topics: Array<{ topic: string; estimatedMinutes: number }>;
  }>;
};

function examSubjectNameKey(name: string): string {
  return String(name || 'General')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseAiTopicDurationRows(
  rows: Array<{ topic?: unknown; estimatedMinutes?: unknown }> | undefined,
  defaultSession: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive'
): Array<{ topic: string; estimatedMinutes: number }> {
  if (!Array.isArray(rows)) return [];
  const aiVals = rows
    .map((r) => Number(r?.estimatedMinutes))
    .filter((v) => Number.isFinite(v) && v > 0);
  const uniq = new Set(aiVals.map((v) => Math.round(v)));
  const mean = aiVals.length ? aiVals.reduce((a, b) => a + b, 0) / aiVals.length : 0;
  const variance = aiVals.length
    ? aiVals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / aiVals.length
    : 0;
  const lowSpreadAi = aiVals.length >= 6 && (uniq.size <= 2 || variance < 18);
  const out: Array<{ topic: string; estimatedMinutes: number }> = [];
  for (const t of rows) {
    const topic = String(t.topic || '').trim();
    if (!topic) continue;
    if (
      isStructuralHeadingOnly(topic) ||
      shouldSkipAsSchedulableTopicTitle(topic) ||
      isBareCurriculumStrandBanner(topic)
    ) {
      continue;
    }
    const h = estimateMinutesHeuristic(topic, defaultSession, gradeLevel, pace);
    const rawAi = Number(t.estimatedMinutes);
    const aiMins = Number.isFinite(rawAi) && !lowSpreadAi ? rawAi : h;
    out.push({
      topic,
      estimatedMinutes: mergeDurationEstimate(topic, aiMins, h, gradeLevel, pace),
    });
  }
  return out;
}

function minuteLookupFromTopicRows(
  rows: Array<{ topic: string; estimatedMinutes: number }>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    for (const k of topicDurationLookupKeys(r.topic)) {
      if (!m.has(k)) m.set(k, r.estimatedMinutes);
    }
  }
  return m;
}

function resolveMinutesForTopic(
  topic: string,
  lookup: Map<string, number>,
  defaultSession: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive'
): number {
  for (const k of topicDurationLookupKeys(topic)) {
    const v = lookup.get(k);
    if (v != null && Number.isFinite(v)) {
      const got = Math.min(300, Math.round(v / 5) * 5);
      const h = estimateMinutesHeuristic(topic, defaultSession, gradeLevel, pace);
      return Math.max(
        learningPassFloorMinutes(topic, Math.max(h, got), gradeLevel, pace),
        got
      );
    }
  }
  const h = estimateMinutesHeuristic(topic, defaultSession, gradeLevel, pace);
  const out = Math.max(learningPassFloorMinutes(topic, h, gradeLevel, pace), h);
  return Math.min(300, Math.round(out / 5) * 5);
}

/** Response rows follow each subject's input topic list order (model may shuffle; we remap by string keys). */
function alignTopicDurationsToInputOrder(
  inputSubjects: Array<{ name?: string; topics?: string[] }>,
  parsedSubjects: Array<{
    name?: string;
    topics?: Array<{ topic?: unknown; estimatedMinutes?: unknown }>;
  }>,
  defaultSession: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive'
): TopicDurationResponse['subjects'] {
  const processedAi = parsedSubjects.map((s) => ({
    key: examSubjectNameKey(String(s.name || 'General')),
    rows: parseAiTopicDurationRows(s.topics, defaultSession, gradeLevel, pace),
  }));

  const byKey = new Map<string, Array<{ topic: string; estimatedMinutes: number }>>();
  for (const p of processedAi) {
    byKey.set(p.key, p.rows);
  }

  return inputSubjects.map((inputS, idx) => {
    const name = String(inputS.name || 'General').trim() || 'General';
    const inputTopics = filterTopicLines(
      Array.isArray(inputS.topics) ? inputS.topics.map((t) => String(t).trim()).filter(Boolean) : []
    ).filter(
      (topic) => !shouldSkipAsSchedulableTopicTitle(topic) && !isBareCurriculumStrandBanner(topic)
    );

    let aiRows = byKey.get(examSubjectNameKey(name));
    if (!aiRows?.length && inputSubjects.length === parsedSubjects.length && parsedSubjects[idx]) {
      aiRows = parseAiTopicDurationRows(parsedSubjects[idx].topics, defaultSession, gradeLevel, pace);
    }
    if (!aiRows?.length && byKey.size === 1) {
      aiRows = [...byKey.values()][0];
    }

    const lookup = aiRows?.length ? minuteLookupFromTopicRows(aiRows) : new Map<string, number>();
    const topics = inputTopics.map((topic) => ({
      topic,
      estimatedMinutes: resolveMinutesForTopic(topic, lookup, defaultSession, gradeLevel, pace),
    }));
    return { name, topics };
  });
}

function safeJsonParse<T>(text: string): T {
  return JSON.parse(text) as T;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const jsonMatch =
    trimmed.match(/```json\s*([\s\S]*?)\s*```/) ||
    trimmed.match(/\[[\s\S]*\]/) ||
    trimmed.match(/\{[\s\S]*\}/);
  return (jsonMatch?.[1] || jsonMatch?.[0] || trimmed).trim();
}

function safeJsonParseLoose<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    try {
      // Common LLM JSON issues: trailing commas.
      const cleaned = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}

const KNOWN_SUBJECT_PATTERNS: RegExp[] = [
  /\bphysics\b/i,
  /\bchemistry\b/i,
  /\bbiology\b/i,
  /\bmathematics\b/i,
  /\bmath\b/i,
  /\badditional mathematics\b/i,
  /\benglish\b/i,
  /\blanguage\b/i,
  /\bliterature\b/i,
  /\bhistory\b/i,
  /\bgeography\b/i,
  /\beconomics\b/i,
  /\bbusiness\b/i,
  /\baccounting\b/i,
  /\bcomputer science\b/i,
  /\bict\b/i,
  /\bpsychology\b/i,
  /\bsociology\b/i,
  /\bfrench\b/i,
  /\bspanish\b/i,
  /\bgerman\b/i,
  /\bhar\b/i,
  /\benvironmental\b/i,
  /\bglobal perspectives\b/i,
];

function isUnitLikeName(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    /^(unit|chapter|topic|module|section|paper)\b/.test(v) ||
    /^\d+[\).:-]/.test(v) ||
    /\b(unit|chapter|topic)\s*\d+\b/.test(v)
  );
}

function isLikelyRealSubjectName(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (isUnitLikeName(v)) return false;
  if (v.length > 80) return false;
  return KNOWN_SUBJECT_PATTERNS.some((p) => p.test(v));
}

function normalizeStructuredSubjects(
  inputSubjects: Array<{ name: string; units: string[] }>
): Array<{ name: string; units: string[] }> {
  const normalized: Array<{ name: string; units: string[] }> = [];
  let currentRealSubject: { name: string; units: string[] } | null = null;

  for (const raw of inputSubjects) {
    const name = String(raw.name || '').trim();
    const units = Array.isArray(raw.units) ? raw.units.map((u) => String(u || '').trim()).filter(Boolean) : [];
    if (!name && units.length === 0) continue;

    const isRealSubject =
      /^subject\s*:/i.test(name) ||
      /^course\s*:/i.test(name) ||
      isLikelyRealSubjectName(name);

    if (isRealSubject) {
      const cleanName = name.replace(/^(subject|course)\s*:/i, '').trim();
      const next = { name: cleanName || 'General', units: [...units] };
      normalized.push(next);
      currentRealSubject = next;
      continue;
    }

    // Not a subject => treat its "name" as a unit/topic under current subject.
    if (!currentRealSubject) {
      currentRealSubject = { name: 'General', units: [] };
      normalized.push(currentRealSubject);
    }
    if (name) currentRealSubject.units.push(name);
    currentRealSubject.units.push(...units);
  }

  return normalized
    .map((s) => ({
      name: s.name,
      units: filterTopicLines(
        Array.from(
          new Set(
            s.units
              .map((u) => u.trim())
              .filter(Boolean)
              .filter((u) => !/^(syllabus|contents?)$/i.test(u))
          )
        )
      ),
    }))
    .filter((s) => s.units.length > 0);
}

function mergeSubjectsPreferMoreTopics(
  primary: Array<{ name: string; units: string[] }>,
  secondary: Array<{ name: string; units: string[] }>
): Array<{ name: string; units: string[] }> {
  const out = primary.map((p) => ({ name: p.name, units: [...p.units] }));
  const findMatchIndex = (name: string) =>
    out.findIndex((o) => {
      const a = o.name.toLowerCase();
      const b = name.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });

  for (const s of secondary) {
    const idx = findMatchIndex(s.name);
    if (idx === -1) {
      out.push({ name: s.name, units: [...s.units] });
      continue;
    }
    const merged = Array.from(new Set([...out[idx].units, ...s.units].map((u) => u.trim()).filter(Boolean)));
    out[idx] = { ...out[idx], units: merged };
  }

  return out.filter((s) => s.units.length > 0);
}

function fallbackSubjectsFromSyllabusText(input: string): Array<{ name: string; units: string[] }> {
  const withBoundaryHints = input
    // If flattened text contains inline "Subject:", force a newline.
    .replace(/\s+(?=Subject\s*:)/gi, '\n')
    .replace(/\s+(?=Course\s*:)/gi, '\n')
    // Preserve bullet/topic boundaries when PDF extraction still merges some segments.
    .replace(/\s+(?=\d+\s*[.)])/g, '\n')
    .replace(/\s+(?=[•▪◦\-]\s)/g, '\n');

  const lines = withBoundaryHints
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const subjects: Array<{ name: string; units: string[] }> = [];
  let current: { name: string; units: string[] } | null = null;

  const isSubjectHeader = (line: string) => {
    const trimmed = line.trim();
    const isAllCapsHeading =
      /^[A-Z][A-Z0-9 &/()-]{2,70}$/.test(trimmed) &&
      !isUnitLikeName(trimmed) &&
      !/^(SECTION|SYLLABUS CONTENT|ASSESSMENT OBJECTIVES?)/.test(trimmed);
    return /^(subject|course)\s*:/i.test(trimmed) || isLikelyRealSubjectName(trimmed) || isAllCapsHeading;
  };

  const norm = (line: string) => line.replace(/^(subject|course)\s*:/i, '').trim();

  const flush = () => {
    if (!current) return;
    const units = Array.from(new Set(current.units.map((u) => u.trim()).filter(Boolean)));
    if (units.length > 0) subjects.push({ name: current.name || 'General', units });
  };

  for (const raw of lines) {
    if (isSubjectHeader(raw)) {
      flush();
      current = { name: norm(raw), units: [] };
      continue;
    }
    const cleaned = raw.replace(/^[\-•*\d.)\s]+/, '').trim();
    if (cleaned.length < 3) continue;
    if (/^(paper|exam code|specification|board|syllabus code)\b/i.test(cleaned)) continue;
    if (isStructuralHeadingOnly(cleaned)) continue;
    if (!current) current = { name: 'General', units: [] };

    // Split merged chunks into likely separate topics.
    const chunks = cleaned
      .split(/\s*\|\s*|\s*;\s*|(?<=\b(?:topic|chapter|unit)\s*\d+[a-z]?)\s+(?=[A-Z])/i)
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => !isStructuralHeadingOnly(c));
    if (chunks.length > 1) {
      current.units.push(...chunks);
    } else {
      current.units.push(cleaned);
    }
  }
  flush();

  if (subjects.length > 0) return normalizeStructuredSubjects(subjects);
  const units = Array.from(
    new Set(lines.map((l) => l.replace(/^[\-•*\d.)\s]+/, '').trim()).filter((l) => l.length >= 3))
  );
  return units.length ? normalizeStructuredSubjects([{ name: 'General', units }]) : [];
}

function formatTopicListFallback(raw: string): string[] {
  return filterTopicLines(
    Array.from(
      new Set(
        raw
          .split(/\r?\n|;|\|/g)
          .map((x) => x.trim())
          .map((x) => x.replace(/^[\-•*\d.)\s]+/, '').trim())
          .filter((x) => x.length >= 2)
      )
    )
  );
}

function getProviderOrder(): Array<'gemini'> {
  if (isValidGeminiApiKey) return ['gemini'];
  return [];
}

async function userHasStoredAiCredentialRow(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteHandlerClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase.from('user_ai_credentials').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

async function loadUserGeminiApiKeyDecrypted(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteHandlerClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_ai_credentials')
    .select('groq_key_ciphertext')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.groq_key_ciphertext) return null;
  try {
    const plain = decryptUserGroqKey(data.groq_key_ciphertext);
    if (!isValidUserGeminiApiKeyFormat(plain)) return null;
    return plain.trim();
  } catch {
    return null;
  }
}

async function generateTextWithGemini(
  prompt: string,
  options?: { maxCompletionTokens?: number; modelOverride?: string }
): Promise<string> {
  const override = getGeminiKeyOverrideForRequest()?.trim();
  const serverKey = isValidGeminiApiKey ? GEMINI_API_KEY.trim() : '';
  const apiKey = override || serverKey;
  if (!apiKey) throw new Error('Gemini not configured');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: options?.modelOverride || GEMINI_MODEL_NAME,
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
      ...(Number.isFinite(options?.maxCompletionTokens)
        ? {
            maxOutputTokens: Math.max(128, Math.min(8192, Math.floor(options!.maxCompletionTokens!))),
          }
        : {}),
    },
  });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

type GenerateOptions = {
  /**
   * Groq on-demand TPM often budgets roughly `prompt + max_tokens`.
   * Keep low for parseTask; raise only for actions that need long JSON.
   */
  maxCompletionTokens?: number;
  modelOverride?: string;
};

function getGroqModelFallbacks(): string[] {
  const fromEnv = String(process.env.GROQ_MODEL_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // No default secondary model: lower-quality fallbacks confuse scheduling UX.
  return [...new Set(fromEnv)];
}

const AI_MAX_CONCURRENT = Math.max(
  1,
  Math.min(32, Number(process.env.AI_MAX_CONCURRENT_REQUESTS) || 4)
);
const AI_QUEUE_TIMEOUT_MS = Math.max(
  1000,
  Math.min(120000, Number(process.env.AI_QUEUE_TIMEOUT_MS) || 20000)
);
const AI_WINDOW_MS = 60_000;
const AI_MAX_REQ_PER_WINDOW = Math.max(
  5,
  Math.min(600, Number(process.env.AI_MAX_REQ_PER_MINUTE_PER_IP) || 15)
);
let aiInFlight = 0;
const aiWaiters: Array<() => void> = [];
const ipRateWindow = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = ipRateWindow.get(ip) || [];
  const recent = arr.filter((ts) => now - ts <= AI_WINDOW_MS);
  if (recent.length >= AI_MAX_REQ_PER_WINDOW) {
    ipRateWindow.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipRateWindow.set(ip, recent);
  if (ipRateWindow.size > 2000) {
    // light cleanup to avoid unbounded growth on long-running processes
    for (const [k, v] of ipRateWindow) {
      if (v.length === 0 || now - v[v.length - 1]! > AI_WINDOW_MS * 3) ipRateWindow.delete(k);
    }
  }
  return false;
}

async function acquireAiSlot(): Promise<void> {
  if (aiInFlight < AI_MAX_CONCURRENT) {
    aiInFlight += 1;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = aiWaiters.indexOf(wake);
      if (idx >= 0) aiWaiters.splice(idx, 1);
      reject(new Error('AI queue timeout'));
    }, AI_QUEUE_TIMEOUT_MS);
    const wake = () => {
      clearTimeout(timer);
      aiInFlight += 1;
      resolve();
    };
    aiWaiters.push(wake);
  });
}

function releaseAiSlot(): void {
  aiInFlight = Math.max(0, aiInFlight - 1);
  const next = aiWaiters.shift();
  if (next) next();
}

async function generateText(prompt: string, options?: GenerateOptions): Promise<string> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr = 'No AI provider available';
  const canCallGemini =
    getProviderOrder().length > 0 || Boolean(getGeminiKeyOverrideForRequest()?.trim());
  while (attempt < maxAttempts) {
    attempt += 1;
    if (!canCallGemini) break;
    try {
      return await generateTextWithGemini(prompt, options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      const retryable = /429|rate limit|quota|Too Many Requests|retry/i.test(msg);
      if (!retryable || attempt >= maxAttempts) break;
      const waitMs = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error(`No AI provider available. ${lastErr}`);
}

function isAiAction(action: unknown): boolean {
  const a = String(action || '');
  return [
    'parseTask',
    'chunkTask',
    'scheduleTasks',
    'recommendNow',
    'estimateTopicDurations',
    'extractSyllabusTopics',
    'convertSyllabusToExternalFormat',
    'extractExamSyllabusFromDocument',
    'extractExamSyllabusFromText',
    'multiExamPlan',
    'rebuildWeek',
    'examPlan',
  ].includes(a);
}

function isProviderRateLimitErrorMessage(message: string): boolean {
  return /rate limit|429|quota|tokens per day|tokens per minute|rate_limit_exceeded/i.test(
    String(message || '')
  );
}

type AiRouteAuthContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseRouteHandlerClient>>;
  userId: string | null;
  canRunAi: boolean;
  shouldChargeSharedQuota: boolean;
  /** Decrypted Gemini key for this user (POST only); null if none or invalid. */
  userGeminiApiKey: string | null;
  /** True if a row exists in user_ai_credentials (BYOK UI / health). */
  hasStoredUserGeminiCredential: boolean;
};

async function loadAiRouteAuthContext(mode: 'get' | 'post'): Promise<AiRouteAuthContext> {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const serverKeyOk = getProviderOrder().length > 0;

  let hasStoredUserGeminiCredential = false;
  let userGeminiApiKey: string | null = null;
  if (userId) {
    hasStoredUserGeminiCredential = await userHasStoredAiCredentialRow(supabase, userId);
    if (mode === 'post') {
      userGeminiApiKey = await loadUserGeminiApiKeyDecrypted(supabase, userId);
    }
  }

  const canRunAi =
    serverKeyOk || (mode === 'get' ? hasStoredUserGeminiCredential : Boolean(userGeminiApiKey));
  const shouldChargeSharedQuota =
    mode === 'post' && Boolean(userId) && serverKeyOk && !userGeminiApiKey;

  return {
    supabase,
    userId,
    canRunAi,
    shouldChargeSharedQuota,
    userGeminiApiKey,
    hasStoredUserGeminiCredential,
  };
}

export async function GET() {
  const ctx = await loadAiRouteAuthContext('get');
  const providerOrder = getProviderOrder();
  const primary = providerOrder[0];
  const configured = ctx.canRunAi;

  let sharedAi: { limit: number; used: number; byok: boolean } | null = null;
  if (ctx.userId) {
    if (ctx.hasStoredUserGeminiCredential) {
      sharedAi = {
        limit: 0,
        used: 0,
        byok: true,
      };
    } else {
      const today = utcTodayDateString();
      const { data: usage } = await ctx.supabase
        .from('ai_usage_daily')
        .select('shared_ai_calls')
        .eq('user_id', ctx.userId)
        .eq('usage_date', today)
        .maybeSingle();
      sharedAi = {
        limit: getAiSharedDailyLimit(),
        used: Number(usage?.shared_ai_calls) || 0,
        byok: false,
      };
    }
  } else {
    sharedAi = {
      limit: getAiSharedDailyLimit(),
      used: 0,
      byok: false,
    };
  }

  const providerLabel = primary === 'gemini' ? 'gemini' : 'none';
  const modelLabel = primary === 'gemini' ? GEMINI_MODEL_NAME : null;

  return NextResponse.json({
    configured,
    provider: providerLabel,
    model: modelLabel,
    message: configured
      ? undefined
      : 'The AI assistant is not enabled on this server. Add GEMINI_API_KEY to your environment and restart.',
    sharedAi,
  });
}

// ─────────────────────────────────────────────────────────────────────
// New deterministic parseTask logic: LLM extracts → server builds
// ─────────────────────────────────────────────────────────────────────

/** Resolve a calendar date from a YYYY-MM-DD string the model returned. */
function safeParseModelDate(raw: unknown, fallback: Date): Date {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = parseCalendarDate(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * Extract an explicit item/session count from user text.
 * "8 math papers" → 8, "do 5 past papers" → 5, "3 chapters" → 3.
 * Returns null if no count is found.
 */
function extractSessionCountFromUserText(text: string): number | null {
  const t = text.toLowerCase().trim();
  const numberWords: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    dozen: 12,
    couple: 2,
  };
  // Match patterns like: "8 papers", "do 5 mock exams", "complete 3 chapters"
  // Also "3x practice", "10 sets of exercises"
  const patterns = [
    /\b(\d{1,3})\s+(?:[\w-]+\s+){0,3}(?:past\s+)?(?:papers?|exams?|mocks?|tests?|quizzes?|exercises?|problems?|questions?|sets?|worksheets?|chapters?|sections?|items?|sessions?|pieces?|tasks?|assignments?|essays?|drills?|rounds?|attempts?|practice\s+(?:papers?|tests?|sets?|exams?))\b/i,
    /\b(?:do|complete|finish|solve|attempt|practice|revise|review|work\s+(?:through|on))\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s*x\s*(?:practice|mock|paper|test|drill)\b/i,
    /\b(\d{1,3})\s*q(?:uestions?)?\b/i,
    /\bhave\s+(\d{1,3})\s+(?:to\s+(?:do|complete|finish))?\b/i,
    /\b(\d{1,3})\s+of\s+them\b/i,
  ];
  for (const pat of patterns) {
    const m = t.match(pat);
    if (m) {
      const n = Math.round(Number(m[1]));
      if (Number.isFinite(n) && n >= 2 && n <= 200) return n;
    }
  }
  const wordMatch = t.match(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|couple)\b\s+(?:of\s+)?(?:past\s+)?(?:papers?|exams?|mocks?|tests?|quizzes?|exercises?|problems?|questions?|sets?|worksheets?|chapters?|sections?|items?|sessions?|pieces?|tasks?|assignments?|essays?|drills?|rounds?|attempts?)\b/i
  );
  if (wordMatch) {
    const n = numberWords[wordMatch[1]!.toLowerCase()];
    if (Number.isFinite(n) && n >= 2 && n <= 200) return n;
  }
  return null;
}

function extractQuestionCountFromUserText(text: string): number | null {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  const m = t.match(/\b(\d{1,4})\s*q(?:uestions?)?\b/i) ?? t.match(/\b(\d{1,4})\s+questions?\b/i);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(500, n);
}

function inferSessionCountForQuestionWorkload(questionCount: number, minutesPerSession: number): number {
  // Rough pacing target: around 4 minutes/question by default.
  const qPerSession = Math.max(6, Math.min(20, Math.round(minutesPerSession / 4)));
  return Math.max(1, Math.ceil(questionCount / qPerSession));
}

function professionalizeStudyPlanTitle(input: string): string {
  const s = normalizeSchedulingUserText(input)
    .replace(/\b(?:i\s+got|i\s+have|i\s+need|please|kinda|like|you\s+know|idk|have\s+to|gotta|wanna)\b/gi, ' ')
    .replace(/\b(?:for\s+like|and\s+like|they\s+are|they\s+re|ill|i'?ll)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'Study plan';
  const clipped = s.slice(0, 72).replace(/[,.]\s*$/, '');
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function toProfessionalTitle(input: string): string {
  const raw = String(input || '').trim().replace(/\s+/g, ' ');
  if (!raw) return raw;
  const words = raw.split(' ');
  const small = new Set(['and', 'or', 'for', 'to', 'of', 'on', 'in', 'at', 'by', 'the', 'a', 'an']);
  return words
    .map((w, i) => {
      const low = w.toLowerCase();
      if (i > 0 && small.has(low)) return low;
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(' ')
    .replace(/\bi\b/g, 'I');
}

function inferCanonicalWorkTitleFromUserText(userText: string): string | null {
  const t = normalizeSchedulingUserText(userText).toLowerCase();
  const subjectWord = t.match(
    /\b(math|maths|english|physics|chem|chemistry|biology|bio|history|geography|econ|economics|business|french|spanish|german|mandarin|lit|literature|cs|computer\s+science)\b/
  )?.[1];
  const normalizeSubject = (s: string): string => {
    const m: Record<string, string> = {
      maths: 'Math',
      math: 'Math',
      chem: 'Chemistry',
      bio: 'Biology',
      lit: 'Literature',
      econ: 'Economics',
      cs: 'Computer Science',
    };
    const k = s.trim().toLowerCase();
    return m[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));
  };
  const subj = subjectWord ? normalizeSubject(subjectWord) : '';
  if (/\b(past\s+papers?|practice\s+papers?|question\s+papers?|timed\s+papers?)\b/.test(t)) {
    return subj ? `${subj} Practice Paper` : 'Practice Paper';
  }
  if (/\bpaper\b/.test(t)) {
    return subj ? `${subj} Paper` : 'Paper';
  }
  if (/\b(essay|essays)\b/.test(t)) {
    return subj ? `${subj} Essay` : 'Essay';
  }
  return null;
}

/**
 * Extract a repeat interval from user text.
 * "every second Monday" → 2, "every third week" → 3, "biweekly" → 2.
 */
function extractRepeatIntervalFromUserText(text: string): number | null {
  const t = normalizeSchedulingUserText(text).toLowerCase().trim();
  // "every other", "every second", "every 2nd", "alternate weeks", "bi-weekly", "fortnightly"
  if (/\b(?:every\s+(?:other|second|2nd)|alternate\s+weeks?|bi[\s-]?weekly|fortnightly)\b/i.test(t)) return 2;
  if (
    /\b(?:second|2nd)\s+(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      t
    )
  )
    return 2;
  if (
    /\b(?:third|3rd)\s+(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      t
    )
  )
    return 3;
  if (/\bevery\s+(?:third|3rd)\b/i.test(t)) return 3;
  if (/\bevery\s+(?:fourth|4th)\b/i.test(t)) return 4;
  // "every N weeks"
  const m = t.match(/\bevery\s+(\d{1,2})\s+weeks?\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 12) return n;
  }
  return null;
}

/**
 * Extract subject names from user text when the LLM missed them.
 * "English and IH prep" → ["English", "IH"]
 * "alternating physics and chemistry" → ["physics", "chemistry"]
 */
function extractSubjectsFromUserText(text: string): string[] {
  const t = text.trim();

  // Pattern 1: "alternating/alternate/switch between X and Y"
  let m = t.match(/\b(?:alternating|alternate|switch(?:ing)?\s+between|rotating)\s+(?:days?\s+)?(.+?)\s+(?:and|&)\s+(.+?)(?:\s+(?:prep|practice|for|till|by|each|every)\b|$)/i);
  if (m) {
    const a = m[1]!.trim(), b = m[2]!.trim();
    if (a.length >= 1 && a.length <= 40 && b.length >= 1 && b.length <= 40)
      return [a.charAt(0).toUpperCase() + a.slice(1), b.charAt(0).toUpperCase() + b.slice(1)];
  }

  // Pattern 2: "X and Y prep/practice/revision" (before schedule qualifiers)
  m = t.match(/\b([\w]+)\s+(?:and|&)\s+([\w]+)\s+(?:prep|practice|revision|review|study)\b/i);
  if (m) {
    return [m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1), m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1)];
  }

  // Pattern 3: general "X and Y" as first words before scheduling context
  const cleaned = t
    .replace(/\b(?:prep|revision|review|practice|study(?:ing)?|homework|work)\b.*/i, '')
    .replace(/\b(?:for|till|until|by|changing|alternating|rotating|each|every|daily)\b.*/i, '')
    .trim();
  m = cleaned.match(/^(.+?)\s+(?:and|&|\+)\s+(.+?)$/i);
  if (m) {
    const a = m[1]!.replace(/\b(?:alternating|alternate|rotating|switch\s+between)\s*/i, '').trim();
    const b = m[2]!.trim();
    if (a.length >= 1 && a.length <= 40 && b.length >= 1 && b.length <= 40)
      return [a.charAt(0).toUpperCase() + a.slice(1), b.charAt(0).toUpperCase() + b.slice(1)];
  }

  // Pattern 4: "X, Y, and Z" with 3 subjects
  m = t.match(/^([\w\s]+),\s*([\w\s]+?)(?:,?\s*(?:and|&)\s*([\w\s]+?))?(?:\s+(?:prep|practice|revision|each|every|daily|alternating|for|till|by)\b)/i);
  if (m && m[3]) {
    const subs = [m[1]!, m[2]!, m[3]!].map(s => { const v = s.trim(); return v.charAt(0).toUpperCase() + v.slice(1); }).filter(s => s.length >= 1 && s.length <= 40);
    if (subs.length >= 2) return subs;
  }

  // Pattern 5: "study math on one day, next day physics"
  m = t.match(
    /\b(?:study|do|revise|practice)\s+([a-z][a-z0-9\s]{1,30}?)\s+(?:on\s+)?one\s+day[,;\s]+(?:the\s+)?next\s+day\s+([a-z][a-z0-9\s]{1,30}?)(?:\b|[,.;])/i
  );
  if (m) {
    const a = m[1]!.trim();
    const b = m[2]!.trim();
    if (a && b) return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
  }

  // Pattern 6: "one day physics, next day chem"
  m = t.match(
    /\bone\s+day\s+([a-z][a-z0-9\s]{1,30}?)[,;\s]+(?:the\s+)?next\s+day\s+([a-z][a-z0-9\s]{1,30}?)(?:\b|[,.;])/i
  );
  if (m) {
    const a = m[1]!.trim();
    const b = m[2]!.trim();
    if (a && b) return [resolveTitleFromUserText(a, null), resolveTitleFromUserText(b, null)];
  }

  return [];
}

/**
 * Detect if user text implies a study plan (not just a single task or event).
 */
function userTextIndicatesStudyPlan(text: string): boolean {
  const t = text.toLowerCase();
  // Strong cadence cues that imply multi-day sessions even without "prep/study" wording.
  if (/\b(?:every\s+(?:second|2nd|other)\s+day|every\s+2\s+days?|alternat(?:e|ing|ive)\s+days?)\b/.test(t)) return true;
  if (/\b(?:one\s+day\s+.*\s+next\s+day|next\s+day\s+.*\s+one\s+day)\b/.test(t)) return true;
  if (/\b(?:alternating|alternate|rotating|rotate|switch(?:ing)?\s+between|cycling|each\s+day|every\s+day|chang(?:ing|e)\s+each\s+day)\b/.test(t)) return true;
  if (/\b(?:daily|weekday)\s+(?:prep|practice|revision|review|study)\b/.test(t)) return true;
  if (/\b(?:prep|practice|revision|review|study)\s+(?:daily|every\s+day|each\s+day|till|until|for\s+\d)\b/.test(t)) return true;
  if (/\b(?:till|until|by)\s+(?:the\s+)?\d/.test(t) && /\bprep\b/.test(t)) return true;
  if (/\bfor\s+\d+\s+(?:days?|weeks?)\b/.test(t) && /\b(?:prep|practice|revision|review|study)\b/.test(t)) return true;
  if (
    /\b(?:past\s+papers?|practice\s+papers?|mock\s+exams?|question\s+papers?|timed\s+papers?)\b/.test(t) &&
    /\b(?:by|before|until|till|deadline|due)\b/.test(t)
  )
    return true;
  return false;
}

function extractTopicListFromUserText(text: string): string[] {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return [];
  const m = raw.match(
    /\b(?:topics?|topic\s+list|for\s+topics?|including)\s*[:\-]\s*([a-z0-9 ,/&+()'".-]{6,220})$/i
  );
  if (!m) return [];
  const block = m[1]!;
  const parts = block
    .split(/,|\band\b|&|\+/i)
    .map((s) => s.trim().replace(/^[\-\u2022*]\s*/, ''))
    .filter((s) => s.length >= 2 && s.length <= 60);
  const uniq: string[] = [];
  for (const p of parts) {
    const v = p.charAt(0).toUpperCase() + p.slice(1);
    if (!uniq.some((u) => u.toLowerCase() === v.toLowerCase())) uniq.push(v);
    if (uniq.length >= 12) break;
  }
  return uniq;
}

function hasExplicitWeeklyNamedCadence(text: string): boolean {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  if (
    /\b(?:every|each)\s+(?:second|2nd|other|third|3rd|fourth|4th)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)s?\b/.test(
      t
    )
  )
    return true;
  if (
    /\b(?:second|2nd|third|3rd|fourth|4th)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/.test(
      t
    )
  )
    return true;
  return false;
}

/**
 * Deterministically generate micro-tasks for a study plan.
 * The LLM told us *what* to study and *how* (cadence, subjects, duration).
 * We generate the actual per-day sessions here — no LLM date-math.
 */
function generateMicroTasksForPlan(args: {
  subjects: string[];
  cadence: string;
  daysOfWeek: number[] | null;
  repeatInterval: number;
  deadline: Date;
  today: Date;
  minutesPerSession: number;
  sessionCount: number | null;
  totalDays: number | null;
  sessionsPerDay: number;
  title: string;
}): Array<{ title: string; estimatedMinutes: number; scheduledDate: string }> {
  const {
    subjects, cadence, daysOfWeek, repeatInterval, deadline, today,
    minutesPerSession, sessionCount, totalDays, sessionsPerDay, title,
  } = args;
  const MAX_SESSIONS = 200;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  // ── Determine the last calendar day we can schedule ON ──
  // Never schedule ON the deadline itself (that's the exam / due day)
  let lastDay: Date;
  if (totalDays != null && totalDays > 0) {
    // "for 12 days" → window is today .. today+11   (12 calendar days)
    lastDay = addDays(start, totalDays - 1);
    // But if deadline is before that, cap there
    const deadlineMinus1 = addDays(deadline, -1);
    deadlineMinus1.setHours(0, 0, 0, 0);
    if (deadline.getTime() > start.getTime() && deadlineMinus1.getTime() < lastDay.getTime()) {
      lastDay = deadlineMinus1;
    }
  } else if (deadline.getTime() > start.getTime()) {
    // Schedule up to the day BEFORE the deadline
    lastDay = addDays(deadline, -1);
    lastDay.setHours(0, 0, 0, 0);
  } else {
    lastDay = addDays(start, 13); // fallback: 2 weeks
  }
  if (lastDay < start) lastDay = new Date(start);

  // ── Collect all candidate session dates ──
  const candidateDates: Date[] = [];
  let cursor = new Date(start);
  let dayIndex = 0;
  let weekIndex = 0;
  let lastWeekNumber = -1;

  while (cursor.getTime() <= lastDay.getTime() && candidateDates.length < MAX_SESSIONS) {
    const dow = cursor.getDay();

    // Track week boundaries for biweekly/interval logic
    const weekNumber = Math.floor(differenceInCalendarDays(cursor, start) / 7);
    if (weekNumber !== lastWeekNumber) {
      lastWeekNumber = weekNumber;
      weekIndex = weekNumber;
    }

    let include = false;

    switch (cadence) {
      case 'daily':
      case 'rotate_daily':
        include = true;
        break;
      case 'weekdays':
        include = dow >= 1 && dow <= 5;
        break;
      case 'weekly':
        if (Array.isArray(daysOfWeek) && daysOfWeek.includes(dow)) {
          include = repeatInterval <= 1 || weekIndex % repeatInterval === 0;
        }
        break;
      case 'biweekly':
        if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
          include = daysOfWeek.includes(dow) && weekIndex % (repeatInterval || 2) === 0;
        } else {
          // biweekly without specific days → same day of week as start, every 2 weeks
          include = dow === start.getDay() && weekIndex % 2 === 0;
        }
        break;
      case 'alternate':
      case 'every_other_day':
        include = dayIndex % 2 === 0;
        break;
      default:
        include = true;
        break;
    }

    if (include) {
      for (let s = 0; s < sessionsPerDay; s++) {
        candidateDates.push(new Date(cursor));
      }
    }

    cursor = addDays(cursor, 1);
    dayIndex++;
  }

  // ── Apply sessionCount: if the user asked for N sessions, use exactly N ──
  let sessionDates: Date[];
  if (sessionCount != null && sessionCount > 0) {
    if (candidateDates.length >= sessionCount) {
      // Distribute N sessions evenly across the available candidate dates
      if (candidateDates.length === sessionCount) {
        sessionDates = candidateDates;
      } else if (sessionCount === 1) {
        sessionDates = [candidateDates[0]!];
      } else if (sessionCount <= 4) {
        // For small workloads, front-load earliest dates instead of spreading too far out.
        sessionDates = candidateDates.slice(0, sessionCount);
      } else {
        // Pick N dates evenly spaced across the available pool
        sessionDates = [];
        for (let i = 0; i < sessionCount; i++) {
          const idx = Math.round(i * (candidateDates.length - 1) / (sessionCount - 1));
          sessionDates.push(candidateDates[Math.min(idx, candidateDates.length - 1)]!);
        }
      }
    } else {
      // Fewer candidate dates than sessions requested → distribute multiple per day
      sessionDates = [];
      const perDay = Math.ceil(sessionCount / Math.max(1, candidateDates.length));
      let remaining = sessionCount;
      for (const d of candidateDates) {
        const count = Math.min(perDay, remaining);
        for (let i = 0; i < count; i++) sessionDates.push(new Date(d));
        remaining -= count;
        if (remaining <= 0) break;
      }
      // If still short (very few candidate dates), stack on the last available date
      const lastAvail = candidateDates[candidateDates.length - 1] ?? lastDay;
      while (sessionDates.length < sessionCount) {
        sessionDates.push(new Date(lastAvail));
      }
    }
  } else {
    sessionDates = candidateDates;
  }

  // Safety cap
  if (sessionDates.length > MAX_SESSIONS) sessionDates.length = MAX_SESSIONS;

  // ── Build micro-tasks with rotating subjects ──
  const subs = subjects.length > 0 ? subjects : [title || 'Study session'];
  const hasExplicitCount = sessionCount != null && sessionCount > 0;
  return sessionDates.map((date, i) => {
    const subject = subs[i % subs.length]!;
    let label: string;
    if (subs.length > 1) {
      // Rotating subjects: "Physics prep", "English prep"
      label = `${subject} prep`;
    } else if (hasExplicitCount) {
      // Counted items: "Math paper 1 of 8"
      label = `${title || subject} ${i + 1} of ${sessionDates.length}`;
    } else {
      label = title || subject;
    }
    return {
      title: label,
      estimatedMinutes: minutesPerSession,
      scheduledDate: toLocalYYYYMMDD(date),
    };
  });
}

/**
 * Take the LLM's flat extraction and build the full response for the client.
 * All micro-task / session generation happens deterministically here.
 */
function buildResponseFromLLMExtract(
  p: Record<string, unknown>,
  rawKind: string,
  userText: string,
  todayLocal: Date,
  nowLocal: Date
): Record<string, unknown> | null {
  // ── Server-side classification validation ──
  // Cross-check LLM's pick against strong user text signals and reclassify if needed
  let kind = rawKind;
  {
    const isCalEvent = userTextIndicatesCalendarEvent(userText);
    const wantsRepeat = userAskedForWeeklyRecurrence(userText);
    const isFlexTask = userTextIndicatesFlexibleTask(userText);
    const sessionCount = extractSessionCountFromUserText(userText);
    const hasLLMSubjects = Array.isArray(p.subjects) && (p.subjects as unknown[]).length > 0;
    const hasCadence = typeof p.cadence === 'string' && p.cadence.trim() !== '';

    // Extract subjects from user text as fallback (catches "English and IH prep")
    const textSubjects = extractSubjectsFromUserText(userText);
    const hasMultipleSubjects = (hasLLMSubjects && (p.subjects as unknown[]).length > 1) ||
      textSubjects.length > 1;

    // Detect if user text implies a study plan (alternating, rotating, daily prep, etc.)
    const impliesStudyPlan = userTextIndicatesStudyPlan(userText);

    // ── Reclassification rules ──

    // 0) Weekly named-day recurring work (including "prep") should stay event-like calendar recurrence.
    if (kind === 'task' && wantsRepeat && hasExplicitWeeklyNamedCadence(userText) && !sessionCount && !hasMultipleSubjects) {
      kind = 'event';
    }
    // 1) Task with 2+ subjects cycling → MUST be study_plan
    else if (kind === 'task' && hasMultipleSubjects) {
      kind = 'study_plan';
      if (!hasLLMSubjects) p.subjects = textSubjects;
      if (!hasCadence) p.cadence = 'rotate_daily';
      if (!p.deadline && p.dueDate) p.deadline = p.dueDate;
      if (sessionCount) p.sessionCount = sessionCount;
    }
    // 2) Task that implies a study plan (alternating/daily/rotating + prep/practice)
    else if (kind === 'task' && impliesStudyPlan && !isCalEvent) {
      kind = 'study_plan';
      if (!hasLLMSubjects && textSubjects.length > 0) p.subjects = textSubjects;
      else if (!hasLLMSubjects && p.subject) p.subjects = [p.subject];
      if (!hasCadence) p.cadence = textSubjects.length > 1 ? 'rotate_daily' : 'daily';
      if (!p.deadline && p.dueDate) p.deadline = p.dueDate;
      if (sessionCount) p.sessionCount = sessionCount;
    }
    // 3) Task with explicit session count (e.g., "8 papers by Friday")
    else if (kind === 'task' && sessionCount != null) {
      kind = 'study_plan';
      if (!hasLLMSubjects && textSubjects.length > 0) p.subjects = textSubjects;
      else if (!hasLLMSubjects && p.subject) p.subjects = [p.subject];
      if (!hasCadence) p.cadence = 'daily';
      if (!p.deadline && p.dueDate) p.deadline = p.dueDate;
      p.sessionCount = sessionCount;
    }
    // 4) Task that should be an event: has weekly recurrence + time
    else if (kind === 'task' && wantsRepeat && (isCalEvent || p.startTime || p.repeat)) {
      kind = 'event';
    }
    // 5) Task with a specific time but no "due"/"submit" → likely an event
    else if (kind === 'task' && isCalEvent && !isFlexTask) {
      kind = 'event';
    }
    // 6) Event that should be a task: no time/repeat, has "due"/"submit"/"deadline"
    if (kind === 'event' && isFlexTask && !isCalEvent && !wantsRepeat && !p.repeat && !p.startTime) {
      kind = 'task';
    }
    // 7) Study plan that should be event: single recurring calendar hold (no subjects, has time)
    if (kind === 'study_plan' && isCalEvent && wantsRepeat && !hasMultipleSubjects && !sessionCount && !impliesStudyPlan) {
      kind = 'event';
    }
  }
  const titleRaw = String(p.title ?? p.task ?? p.name ?? '').trim();
  const title = resolveTitleFromUserText(userText, titleRaw || null);

  // ── EVENT ──────────────────────────────────────────────────
  if (kind === 'event') {
    const startDate = safeParseModelDate(p.startDate, todayLocal);
    const startTime = typeof p.startTime === 'string' && p.startTime.trim() ? p.startTime.trim() : null;
    const endTime = typeof p.endTime === 'string' && p.endTime.trim() ? p.endTime.trim() : null;
    const allDay = p.allDay === true;

    // Infer times from user text if model missed them
    const inferredTimes = extractEventTimeRangeFromUserText(userText);
    const finalStartTime = startTime || inferredTimes?.startHHMM || null;
    const finalEndTime = endTime || inferredTimes?.endHHMM || null;

    // Duration
    const rawDur = Number(p.durationMinutes);
    let durationMinutes: number | null = Number.isFinite(rawDur) && rawDur > 0 ? Math.round(rawDur) : null;
    const durFromText = extractDurationMinutesFromUserText(userText);
    if (!durationMinutes && durFromText) durationMinutes = durFromText;
    if (!durationMinutes && finalStartTime && finalEndTime) {
      const [sh, sm] = finalStartTime.split(':').map(v => parseInt(v, 10));
      const [eh, em] = finalEndTime.split(':').map(v => parseInt(v, 10));
      if ([sh, sm, eh, em].every(x => Number.isFinite(x)) && eh! * 60 + em! > sh! * 60 + sm!) {
        durationMinutes = eh! * 60 + em! - (sh! * 60 + sm!);
      }
    }

    // Repeat
    let repeat: { frequency: string; interval: number; daysOfWeek: number[] } | null = null;
    const rep = p.repeat as Record<string, unknown> | null | undefined;
    if (rep && typeof rep === 'object' && !Array.isArray(rep)) {
      const days = Array.isArray(rep.daysOfWeek)
        ? extractEventRepeatDaysFromUserText(userText, (rep.daysOfWeek as number[]).filter(d => d >= 0 && d <= 6))
        : extractEventRepeatDaysFromUserText(userText, []);
      if (days.length > 0) {
        repeat = {
          frequency: 'weekly',
          interval: Math.max(1, Math.round(Number(rep.interval)) || 1),
          daysOfWeek: days,
        };
      }
    }
    // If user clearly asked for weekly repeat but model missed it
    if (!repeat && userAskedForWeeklyRecurrence(userText)) {
      const days = extractEventRepeatDaysFromUserText(userText, []);
      if (days.length > 0) {
        repeat = { frequency: 'weekly', interval: 1, daysOfWeek: days };
      }
    }
    // Server-side interval extraction: "every second/other/2nd Monday" → interval 2
    if (repeat) {
      const textInterval = extractRepeatIntervalFromUserText(userText);
      if (textInterval && textInterval > repeat.interval) {
        repeat = { ...repeat, interval: textInterval };
      }
    }

    // Adjust startDate for weekly repeat
    let finalStartDate = startDate;
    if (repeat && repeat.daysOfWeek.length > 0) {
      finalStartDate = nextOccurrenceForWeeklyRepeat({
        today: nowLocal,
        daysOfWeek: repeat.daysOfWeek,
        startTimeHHMM: finalStartTime,
      });
    } else {
      const inferred = inferCalendarDayFromUserText(userText, nowLocal);
      if (inferred) finalStartDate = inferred;
    }
    // Don't schedule in the past (unless repeating)
    if (!repeat) {
      const s0 = new Date(finalStartDate);
      s0.setHours(0, 0, 0, 0);
      if (s0 < todayLocal) finalStartDate = new Date(todayLocal);
    }

    return {
      success: true,
      kind: 'event',
      sourceSpan: userText,
      title,
      description: typeof p.description === 'string' ? p.description : null,
      startDate: toLocalYYYYMMDD(finalStartDate),
      startTime: finalStartTime,
      endTime: finalEndTime,
      durationMinutes,
      allDay,
      eventType: String(p.eventType || 'event'),
      repeat,
    };
  }

  // ── TASK ───────────────────────────────────────────────────
  if (kind === 'task') {
    const dueDateRaw = safeParseModelDate(p.dueDate, addDays(todayLocal, 7));
    const dueDate = dueDateRaw < todayLocal ? new Date(todayLocal) : dueDateRaw;
    // Check user text for date hints
    const inferredDate = inferCalendarDayFromUserText(userText, nowLocal);
    const finalDue = inferredDate && inferredDate >= todayLocal ? inferredDate : dueDate;

    const estHoursRaw = Number(p.estimatedHours);
    const minutesFromEstimatedHours =
      Number.isFinite(estHoursRaw) && estHoursRaw > 0 ? Math.round(estHoursRaw * 60) : null;
    const totalMinutes = Math.max(
      15,
      Math.min(8 * 60, Math.round(Number(p.totalMinutes)) || minutesFromEstimatedHours || 60)
    );
    const textMins = extractDurationMinutesFromUserText(userText);
    const effectiveMinutes = textMins ?? totalMinutes;
    const modelSingle =
      p.singleSession === true ||
      String(p.sessionStyle || '')
        .trim()
        .toLowerCase() === 'single_block';
    const essayLike = /\b(essay|report|coursework|dissertation|paper|write-up)\b/i.test(
      normalizeSchedulingUserText(userText)
    );
    // Long writing tasks should not default to a single 4h+ block unless the user explicitly asks for one sitting.
    const explicitOneSitting = /\b(one\s+sitting|single\s+block|one\s+go|do\s+not\s+break)\b/i.test(
      normalizeSchedulingUserText(userText)
    );
    const singleSession =
      explicitOneSitting || (modelSingle && !(essayLike && !textMins));

    return {
      success: true,
      kind: 'task',
      sourceSpan: userText,
      title: toProfessionalTitle(title),
      description: typeof p.description === 'string' ? p.description : null,
      dueDate: toLocalYYYYMMDD(finalDue),
      priority: p.priority === 'high' || p.priority === 'low' ? String(p.priority) : 'medium',
      subject: typeof p.subject === 'string' && p.subject.trim() ? p.subject.trim() : null,
      estimatedHours: Math.round((effectiveMinutes / 60) * 10) / 10,
      sessionStyle: singleSession ? 'single_block' : 'multi_step',
      ...(singleSession ? { sessionMinutes: effectiveMinutes } : {}),
    };
  }

  // ── STUDY PLAN ─────────────────────────────────────────────
  if (kind === 'study_plan') {
    const llmSubjects = Array.isArray(p.subjects)
      ? (p.subjects as string[]).map(s => String(s).trim()).filter(s => s.length > 0 && s.length < 80).slice(0, 8)
      : [];
    const llmSubjectAlias = Array.isArray(p.subject)
      ? (p.subject as unknown[]).map((s) => String(s).trim()).filter((s) => s.length > 0 && s.length < 80).slice(0, 8)
      : typeof p.subject === 'string' && p.subject.trim()
        ? [String(p.subject).trim()]
        : [];
    const textSubjects = extractSubjectsFromUserText(userText);
    const textTopics = extractTopicListFromUserText(userText);
    const subjects =
      llmSubjects.length > 0
        ? llmSubjects
        : llmSubjectAlias.length > 0
          ? llmSubjectAlias
          : textSubjects.length > 0
            ? textSubjects
            : textTopics;
    const cadence = String(p.cadence || 'daily').trim();
    const daysOfWeek = Array.isArray(p.daysOfWeek)
      ? (p.daysOfWeek as number[]).filter(d => d >= 0 && d <= 6)
      : null;
    const rawDeadline = safeParseModelDate(p.deadline ?? p.dueDate, addDays(todayLocal, 14));
    const inferredOrdinalDeadline = inferOrdinalDeadlineDayFromUserText(userText, nowLocal);
    const inferredCalendarDeadline = inferCalendarDayFromUserText(userText, nowLocal);
    const deadlineCandidate = inferredOrdinalDeadline ?? inferredCalendarDeadline ?? rawDeadline;
    const deadline = deadlineCandidate < todayLocal ? addDays(todayLocal, 14) : deadlineCandidate;

    const rawMins = Number(p.minutesPerSession);
    const textMins = extractDurationMinutesFromUserText(userText);
    const minutesPerSession = Math.max(10, Math.min(480,
      textMins ?? (Number.isFinite(rawMins) && rawMins > 0 ? rawMins : 45)
    ));

    const rawTotal = Number(p.totalDays);
    const totalDays = Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : null;
    const sessionsPerDay = Math.max(1, Math.min(4, Math.round(Number(p.sessionsPerDay)) || 1));

    // ── repeatInterval for weekly/biweekly ──
    const rawInterval = Number(p.repeatInterval);
    const repeatInterval = Number.isFinite(rawInterval) && rawInterval > 0 ? Math.round(rawInterval) : 1;

    // ── sessionCount: LLM may have extracted or server extracts from text ──
    const rawCount = Number(p.sessionCount);
    const llmSessionCount = Number.isFinite(rawCount) && rawCount > 0 ? Math.round(rawCount) : null;
    const textSessionCount = extractSessionCountFromUserText(userText);
    let sessionCount =
      llmSessionCount != null && textSessionCount != null
        ? Math.max(llmSessionCount, textSessionCount)
        : llmSessionCount ?? textSessionCount;
    const questionCount = extractQuestionCountFromUserText(userText);
    if (
      questionCount != null &&
      sessionCount != null &&
      sessionCount >= questionCount &&
      !/\b(each|per)\s+question\b/i.test(normalizeSchedulingUserText(userText))
    ) {
      sessionCount = inferSessionCountForQuestionWorkload(questionCount, minutesPerSession);
    }
    const textLower = normalizeSchedulingUserText(userText).toLowerCase();
    const inferredCanonical = inferCanonicalWorkTitleFromUserText(userText);
    const canonicalSingular = inferredCanonical
      ? inferredCanonical
      : /paper/.test(textLower)
        ? 'Practice Paper'
        : /essay/.test(textLower)
          ? 'Essay Session'
          : 'Study Session';
    const subjectLead = subjects.length > 0 ? subjects[0] : (typeof p.subject === 'string' ? String(p.subject).trim() : '');
    const cleanLead = subjectLead ? professionalizeStudyPlanTitle(subjectLead) : '';
    const microTaskSeedTitle = inferredCanonical
      ? inferredCanonical
      : cleanLead
        ? `${cleanLead} ${canonicalSingular}`
        : professionalizeStudyPlanTitle(title || canonicalSingular);

    const planStart =
      !/\btoday\b/i.test(normalizeSchedulingUserText(userText)) && nowLocal.getHours() >= 19
        ? addDays(todayLocal, 1)
        : todayLocal;

    // Generate micro-tasks deterministically
    const microTasks = generateMicroTasksForPlan({
      subjects,
      cadence,
      daysOfWeek,
      repeatInterval,
      deadline,
      today: planStart,
      minutesPerSession,
      sessionCount,
      totalDays,
      sessionsPerDay,
      title: microTaskSeedTitle,
    });

    if (microTasks.length === 0) {
      // Degrade to simple task
      return {
        success: true,
        kind: 'task',
        sourceSpan: userText,
        title,
        description: typeof p.description === 'string' ? p.description : null,
        dueDate: toLocalYYYYMMDD(deadline),
        priority: 'medium',
        subject: subjects[0] || null,
        estimatedHours: Math.max(0.5, minutesPerSession / 60),
        sessionStyle: 'single_block',
        sessionMinutes: minutesPerSession,
      };
    }

    const microTasksLabeled =
      questionCount != null && microTasks.length > 0
        ? (() => {
            const per = Math.max(1, Math.floor(questionCount / microTasks.length));
            let startQ = 1;
            return microTasks.map((m, idx) => {
              const remaining = questionCount - startQ + 1;
              const take = idx === microTasks.length - 1 ? remaining : Math.min(per, remaining);
              const endQ = Math.max(startQ, startQ + take - 1);
              const labelBase = (subjects[0] ? `${subjects[0]} ` : '') + 'Questions';
              const out = {
                ...m,
                title:
                  startQ === endQ
                    ? `${labelBase}: Q${startQ}`
                    : `${labelBase}: Q${startQ}-${endQ}`,
              };
              startQ = endQ + 1;
              return out;
            });
          })()
        : microTasks;

    const totalMins = microTasksLabeled.reduce((a, m) => a + m.estimatedMinutes, 0);
    const baseTitle = microTaskSeedTitle;
    const alternatingTitle =
      subjects.length > 1 ? `Alternating ${subjects.join(' / ')} Prep` : null;
    const titleSeed = alternatingTitle ?? baseTitle;
    const planTitle =
      sessionCount && sessionCount > 1 ? `${titleSeed} Plan (${sessionCount} Sessions)` : titleSeed;

    return {
      success: true,
      kind: 'study_plan',
      sourceSpan: userText,
      summary: toProfessionalTitle(planTitle),
      schedulePattern: cadence === 'rotate_daily' ? 'custom_cycle' : cadence === 'daily' ? 'daily' : 'unspecified',
      patternCycleLength: subjects.length > 1 ? subjects.length : null,
      ...(subjects.length > 1 ? { rotationSubjects: subjects } : {}),
      tasks: [{
        title: toProfessionalTitle(planTitle),
        description: typeof p.description === 'string' ? p.description : null,
        subject: subjects.length === 1 ? subjects[0] : null,
        dueDate: toLocalYYYYMMDD(deadline),
        priority: 'medium',
        microTasks: microTasksLabeled.map((m) => ({ ...m, title: toProfessionalTitle(m.title) })),
        estimatedTotalMinutes: totalMins,
      }],
    };
  }

  // Unknown kind — try to infer
  if (p.startDate || p.startTime || p.repeat) {
    return buildResponseFromLLMExtract(p, 'event', userText, todayLocal, nowLocal);
  }
  if (Array.isArray(p.subjects) && (p.subjects as unknown[]).length > 0) {
    return buildResponseFromLLMExtract(p, 'study_plan', userText, todayLocal, nowLocal);
  }
  if (p.title || p.dueDate) {
    return buildResponseFromLLMExtract(p, 'task', userText, todayLocal, nowLocal);
  }

  return null;
}

/**
 * Fallback when the LLM returns nothing parseable.
 * Uses basic text analysis to build a sensible default.
 */
function buildFallbackFromUserText(
  userText: string,
  todayLocal: Date,
  nowLocal: Date
): Record<string, unknown> {
  const title = toProfessionalTitle(
    resolveTitleFromUserText(userText, null) || userText.trim().slice(0, 200) || 'Study session'
  );
  const cal = userTextIndicatesCalendarEvent(userText);
  const flex = userTextIndicatesFlexibleTask(userText);

  if (cal && !flex) {
    const dayGuess = inferCalendarDayFromUserText(userText, nowLocal) ?? todayLocal;
    const times = extractEventTimeRangeFromUserText(userText);
    const dm = extractDurationMinutesFromUserText(userText);
    const days = extractEventRepeatDaysFromUserText(userText, []);
    const wantsRepeat = userAskedForWeeklyRecurrence(userText) && days.length > 0;
    return {
      success: true,
      kind: 'event',
      sourceSpan: userText,
      title,
      description: null,
      startDate: toLocalYYYYMMDD(dayGuess < todayLocal ? todayLocal : dayGuess),
      startTime: times?.startHHMM ?? null,
      endTime: times?.endHHMM ?? null,
      durationMinutes: times ? null : dm,
      allDay: /\ball[\s-]day\b/i.test(userText),
      eventType: 'event',
      repeat: wantsRepeat ? { frequency: 'weekly', interval: 1, daysOfWeek: days } : null,
    };
  }

  const dueGuess = inferCalendarDayFromUserText(userText, nowLocal);
  const dueDate = dueGuess && dueGuess >= todayLocal ? dueGuess : addDays(todayLocal, 7);
  const dm = extractDurationMinutesFromUserText(userText);
  return {
    success: true,
    kind: 'task',
    sourceSpan: userText,
    title,
    description: null,
    dueDate: toLocalYYYYMMDD(dueDate),
    priority: 'medium',
    subject: null,
    estimatedHours: Math.max(0.5, (dm ?? 60) / 60),
    sessionStyle: dm ? 'single_block' : 'multi_step',
    ...(dm ? { sessionMinutes: dm } : {}),
  };
}

function normalizeLLMParseTaskItem(
  raw: Record<string, unknown>,
  userText: string,
  todayLocal: Date,
  nowLocal: Date
): Record<string, unknown> | null {
  const inferredKind = (() => {
    if (Array.isArray((raw as { microTasks?: unknown }).microTasks)) return 'study_plan';
    if (
      Array.isArray((raw as { tasks?: unknown }).tasks) &&
      (raw as { tasks?: unknown[] }).tasks?.some(
        (t) => t && typeof t === 'object' && Array.isArray((t as { microTasks?: unknown }).microTasks)
      )
    ) {
      return 'study_plan';
    }
    return '';
  })();
  const kind = String(raw.kind || inferredKind).trim();
  if (kind !== 'event' && kind !== 'task' && kind !== 'study_plan') return null;
  if (
    kind === 'task' &&
    userTextIndicatesStudyPlan(userText) &&
    !(userAskedForWeeklyRecurrence(userText) && hasExplicitWeeklyNamedCadence(userText))
  ) {
    const upgraded = buildResponseFromLLMExtract({ ...raw }, 'study_plan', userText, todayLocal, nowLocal);
    if (upgraded) return upgraded;
  }
  if (kind === 'task') {
    const rawCount = Number(raw.sessionCount);
    const textCount = extractSessionCountFromUserText(userText);
    const hasRepeatedWorkload = textCount != null && textCount > 1;
    if (hasRepeatedWorkload && !(userAskedForWeeklyRecurrence(userText) && hasExplicitWeeklyNamedCadence(userText))) {
      const upgraded = buildResponseFromLLMExtract({ ...raw }, 'study_plan', userText, todayLocal, nowLocal);
      if (upgraded) return upgraded;
    }
  }
  if (kind === 'study_plan') {
    // Always pass study plans through deterministic builder so alternating-day intent
    // produces one rotating track (not parallel duplicated subject tracks).
    const normalizedPlan = buildResponseFromLLMExtract({ ...raw }, 'study_plan', userText, todayLocal, nowLocal);
    if (normalizedPlan) return normalizedPlan;
  }
  const title =
    String(raw.title || raw.task || raw.name || '').trim() ||
    resolveTitleFromUserText(userText, null);

  if (kind === 'event') {
    const scheduleMeta =
      raw.scheduleMetadata && typeof raw.scheduleMetadata === 'object' && !Array.isArray(raw.scheduleMetadata)
        ? (raw.scheduleMetadata as Record<string, unknown>)
        : null;
    const startDate = safeParseModelDate(
      raw.startDate ?? scheduleMeta?.startDate ?? scheduleMeta?.createdDate,
      todayLocal
    );
    const inferredTimes = extractEventTimeRangeFromUserText(userText);
    const startTime =
      typeof raw.startTime === 'string' && raw.startTime.trim()
        ? raw.startTime.trim()
        : typeof raw.start_time === 'string' && String(raw.start_time).trim()
          ? String(raw.start_time).trim()
        : typeof raw.time === 'string' && raw.time.trim()
          ? raw.time.trim()
          : inferredTimes?.startHHMM ?? null;
    const endTime =
      typeof raw.endTime === 'string' && raw.endTime.trim()
        ? raw.endTime.trim()
        : typeof raw.end_time === 'string' && String(raw.end_time).trim()
          ? String(raw.end_time).trim()
          : inferredTimes?.endHHMM ?? null;
    const repeatRaw = raw.repeat as Record<string, unknown> | null | undefined;
    let repeat: { frequency: string; interval: number; daysOfWeek: number[] } | null = null;
    const weekdayNameToIndex = (v: unknown): number | null => {
      const s = String(v || '').trim().toLowerCase();
      if (!s) return null;
      if (s.startsWith('sun')) return 0;
      if (s.startsWith('mon')) return 1;
      if (s.startsWith('tue')) return 2;
      if (s.startsWith('wed')) return 3;
      if (s.startsWith('thu')) return 4;
      if (s.startsWith('fri')) return 5;
      if (s.startsWith('sat')) return 6;
      return null;
    };
    if (Array.isArray(raw.repeat)) {
      const mapped = [...new Set(raw.repeat.map(weekdayNameToIndex).filter((d): d is number => d != null))];
      const days = extractEventRepeatDaysFromUserText(userText, mapped);
      if (days.length > 0) {
        repeat = {
          frequency: 'weekly',
          interval: extractRepeatIntervalFromUserText(userText) ?? 1,
          daysOfWeek: days,
        };
      }
    } else if (repeatRaw && typeof repeatRaw === 'object' && !Array.isArray(repeatRaw)) {
      const modelDays = Array.isArray(repeatRaw.daysOfWeek)
        ? (repeatRaw.daysOfWeek as number[]).filter((d) => Number.isFinite(Number(d)) && d >= 0 && d <= 6)
        : [];
      const days = extractEventRepeatDaysFromUserText(userText, modelDays);
      if (days.length > 0) {
        const textInterval = extractRepeatIntervalFromUserText(userText) ?? 1;
        repeat = {
          frequency: 'weekly',
          interval: Math.max(1, Math.max(Math.round(Number(repeatRaw.interval)) || 1, textInterval)),
          daysOfWeek: days,
        };
      }
    }
    const resolvedStart =
      repeat && repeat.daysOfWeek.length > 0
        ? nextOccurrenceForWeeklyRepeat({
            today: nowLocal,
            daysOfWeek: repeat.daysOfWeek,
            startTimeHHMM: startTime,
          })
        : startDate;
    const durationFromModel = Number(raw.durationMinutes);
    const durationFromText = extractDurationMinutesFromUserText(userText);
    const durationMinutes =
      Number.isFinite(durationFromModel) && durationFromModel > 0
        ? Math.round(durationFromModel)
        : startTime && endTime
          ? null
          : durationFromText ?? 60;
    return {
      success: true,
      kind: 'event',
      sourceSpan: userText,
      title: toProfessionalTitle(title),
      description: typeof raw.description === 'string' ? raw.description : null,
      startDate: toLocalYYYYMMDD(resolvedStart < todayLocal && !repeat ? todayLocal : resolvedStart),
      startTime,
      endTime,
      durationMinutes,
      allDay: raw.allDay === true,
      eventType:
        raw.eventType === 'class' || raw.eventType === 'meeting' || raw.eventType === 'study' ? raw.eventType : 'event',
      repeat,
    };
  }

  if (kind === 'task') {
    const dueDate = safeParseModelDate(raw.dueDate, addDays(todayLocal, 7));
    const estimatedHoursRaw = Number(raw.estimatedHours);
    const sessionStyleRaw = String(raw.sessionStyle || '').trim();
    const estimatedHours =
      Number.isFinite(estimatedHoursRaw) && estimatedHoursRaw > 0
        ? Math.max(0.25, Math.min(24, estimatedHoursRaw))
        : 1;
    const sessionStyle = sessionStyleRaw === 'single_block' || sessionStyleRaw === 'multi_step'
      ? sessionStyleRaw
      : 'multi_step';
    return {
      success: true,
      kind: 'task',
      sourceSpan: userText,
      title: toProfessionalTitle(title),
      description: typeof raw.description === 'string' ? raw.description : null,
      dueDate: toLocalYYYYMMDD(dueDate < todayLocal ? todayLocal : dueDate),
      priority: raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'medium',
      subject: typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim() : null,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      sessionStyle,
      ...(Number.isFinite(Number(raw.sessionCount)) && Number(raw.sessionCount) > 1
        ? { sessionCount: Math.round(Number(raw.sessionCount)) }
        : Number.isFinite(Number(raw.count)) && Number(raw.count) > 1
          ? { sessionCount: Math.round(Number(raw.count)) }
          : {}),
      ...(Number.isFinite(Number(raw.minutesPerSession)) && Number(raw.minutesPerSession) > 0
        ? { minutesPerSession: Math.round(Number(raw.minutesPerSession)) }
        : {}),
      ...(sessionStyle === 'single_block'
        ? { sessionMinutes: Math.max(10, Math.min(8 * 60, Math.round(Number(raw.sessionMinutes)) || 60)) }
        : {}),
    };
  }

  const summary = String(raw.summary || raw.title || 'Study plan').trim() || 'Study plan';
  const tasksIn = Array.isArray(raw.tasks) ? raw.tasks : [];
  const tasks = tasksIn
    .filter((t) => t && typeof t === 'object')
    .map((t) => t as Record<string, unknown>)
    .map((t) => {
      const dueDate = safeParseModelDate(t.dueDate, addDays(todayLocal, 14));
      const microIn = Array.isArray(t.microTasks) ? t.microTasks : [];
      const microTasks = microIn
        .filter((m) => m && typeof m === 'object')
        .map((m) => m as Record<string, unknown>)
        .map((m, idx) => {
          const mDate = safeParseModelDate(m.scheduledDate, addDays(todayLocal, idx));
          const mins = Math.max(10, Math.min(480, Math.round(Number(m.estimatedMinutes)) || 45));
          return {
            title: String(m.title || `Session ${idx + 1}`).trim() || `Session ${idx + 1}`,
            description: typeof m.description === 'string' ? m.description : undefined,
            estimatedMinutes: mins,
            scheduledDate: toLocalYYYYMMDD(mDate),
          };
        });
      return {
        title: String(t.title || summary).trim() || summary,
        description: typeof t.description === 'string' ? t.description : null,
        subject: typeof t.subject === 'string' && t.subject.trim() ? t.subject.trim() : null,
        dueDate: toLocalYYYYMMDD(dueDate < todayLocal ? todayLocal : dueDate),
        priority: t.priority === 'high' || t.priority === 'low' ? t.priority : 'medium',
        microTasks,
        estimatedTotalMinutes:
          Number.isFinite(Number(t.estimatedTotalMinutes)) && Number(t.estimatedTotalMinutes) > 0
            ? Math.round(Number(t.estimatedTotalMinutes))
            : microTasks.reduce((a, m) => a + m.estimatedMinutes, 0),
      };
    })
    .filter((t) => t.microTasks.length > 0);
  if (tasks.length === 0) return null;
  return {
    success: true,
    kind: 'study_plan',
    sourceSpan: userText,
    summary,
    tasks,
  };
}

export async function POST(request: NextRequest) {
  let acquiredSlot = false;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    const authCtx = await loadAiRouteAuthContext('post');
    if (!authCtx.canRunAi) {
      return NextResponse.json(
        {
          error: 'AI provider key not configured',
          message:
            'AI is not enabled for this request. Add GEMINI_API_KEY on the server, or sign in and save your Gemini API key under Settings → AI assistant.',
        },
        { status: 500 }
      );
    }

    const ip = getClientIp(request);
    if (isAiAction(action) && isRateLimited(ip)) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many AI requests right now. Please retry in a few seconds.',
        },
        { status: 429 }
      );
    }

    if (isAiAction(action)) {
      if (authCtx.shouldChargeSharedQuota && authCtx.userId) {
        const limit = getAiSharedDailyLimit();
        const { data: rpcRows, error: rpcError } = await authCtx.supabase.rpc('consume_shared_ai_slot', {
          p_limit: limit,
        });
        if (rpcError) {
          console.error('consume_shared_ai_slot failed:', rpcError);
          return NextResponse.json(
            {
              error: 'AI quota unavailable',
              message:
                'Apply the latest Supabase schema (user_ai_credentials, ai_usage_daily, consume_shared_ai_slot) from supabase-schema-extensions.sql, then try again.',
            },
            { status: 503 }
          );
        }
        const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        const allowed =
          row && typeof row === 'object' && 'allowed' in row ? Boolean((row as { allowed?: boolean }).allowed) : false;
        const used =
          row && typeof row === 'object' && 'used_count' in row
            ? Number((row as { used_count?: number }).used_count)
            : limit;
        if (!allowed) {
          return NextResponse.json(
            {
              error: 'ai_daily_limit',
              code: 'AI_DAILY_LIMIT',
              limit,
              used: Number.isFinite(used) ? used : limit,
              message:
                'You have used today’s included AI turns for your account. Open Settings → AI assistant to add your own Gemini API key (same key on every device you sign in with), or try again tomorrow.',
            },
            { status: 429 }
          );
        }
      }
      await acquireAiSlot();
      acquiredSlot = true;
    }

    return await aiRequestAsyncLocal.run(
      {
        geminiApiKeyOverride: authCtx.userGeminiApiKey || undefined,
      },
      async () => {
    if (action === 'chunkTask') {
      const { title, description, estimatedHours, dueDate, priority, studyPace, defaultSessionMinutes, gradeLevel } = data;

      const hoursNum = Number(estimatedHours);
      const hoursLabel = Number.isFinite(hoursNum) ? hoursNum : 2;
      const targetMinutesBase = Math.round(hoursLabel * 60);

      const chunkBlob = `${String(title || '').trim()}\n${String(description || title || '').trim()}`;
      const inferRepeatedSessionConstraint = (
        text: string
      ): { count: number; sessionMinutes: number; oneGo: boolean } | null => {
        const t = normalizeSchedulingUserText(text).toLowerCase();
        const duration = extractDurationMinutesFromUserText(t);
        if (duration == null || duration < 10) return null;
        const sessionMinutes = Math.max(10, Math.min(8 * 60, Math.round(duration)));

        const countPatterns = [
          /\b(\d{1,3})\s*x\b/i,
          /\b(\d{1,3})\s+times?\b/i,
          /\b(\d{1,3})\s+(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?)\b/i,
          /\bhave\s+(\d{1,3})\b/i,
        ] as const;
        let count: number | null = null;
        for (const p of countPatterns) {
          const m = t.match(p);
          if (!m) continue;
          const n = Math.round(Number(m[1]));
          if (Number.isFinite(n) && n >= 2 && n <= 200) {
            count = n;
            break;
          }
        }
        if (count == null) return null;

        const perItemCue =
          /\b(each|every|per)\b/i.test(t) || /\bone\s+by\s+one\b/i.test(t);
        const oneGo =
          /\b(one\s+go|one\s+sitting|single\s+sitting|in\s+one\s+shot|uninterrupted)\b/i.test(t);
        if (!perItemCue && !oneGo) return null;
        return { count, sessionMinutes, oneGo };
      };
      const repeatedConstraint = inferRepeatedSessionConstraint(chunkBlob);
      const targetMinutes = repeatedConstraint
        ? Math.max(targetMinutesBase, repeatedConstraint.count * repeatedConstraint.sessionMinutes)
        : targetMinutesBase;
      if (looksLikeRecurringWeekdayClockBlock(chunkBlob)) {
        const singleTitle = resolveTitleFromUserText(
          chunkBlob,
          String(title || '').trim() || null
        ).slice(0, 200);
        const mins = Math.max(10, Math.min(8 * 60, targetMinutes));
        return NextResponse.json({
          success: true,
          microTasks: [
            {
              title: singleTitle,
              description: undefined,
              estimatedMinutes: mins,
              order: 1,
              id: `micro-${Date.now()}-0`,
              parentTaskId: '',
              completed: false,
            },
          ],
        });
      }

      const pace = String(studyPace || 'balanced').trim().toLowerCase();
      const sessionPref = Number(defaultSessionMinutes) > 0 ? Number(defaultSessionMinutes) : 30;
      const dueDateText = typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : 'not specified';
      const priorityText = typeof priority === 'string' && priority.trim() ? priority.trim() : 'medium';
      const gradeText = typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : 'not specified';

      const prompt = `You break one assignment into ordered work steps. Read the **title and description as one brief**—they may mention timing ("alternate days", "one long session Friday"), subject-specific work (labs, drills, scenes, reps), or deliverables.

Task title: ${JSON.stringify(String(title || '').trim())}
Description: ${JSON.stringify(String(description || title || '').trim())}
Total effort budget: ${targetMinutes} minutes (server will renormalize minutes to match this exactly).
Due: ${dueDateText} | Priority: ${priorityText} | Grade/program: ${gradeText} | Pace: ${pace} | Typical focus block: ~${sessionPref} min (flexible—not every step must match).
${repeatedConstraint ? `User constraint: there are ${repeatedConstraint.count} separate sessions, each about ${repeatedConstraint.sessionMinutes} minutes${repeatedConstraint.oneGo ? ', each done in one sitting' : ''}. Output at least ${repeatedConstraint.count} steps.` : ''}

## What to produce
- Steps are **real actions** toward the same outcome (research → outline → draft → cite → polish; or warmup → technique → piece → record; or read → exercises → review)—never meta steps like "open the app" or "make a schedule".
- **Titles**: concrete, use the user's vocabulary where possible (course name, artifact type). No "Step 1", no vague "Work on project". Prefer verb + object ("Draft methods section", "Run quadratic equation drills").
- **Descriptions** (optional): one short line—success criteria, focus, or what "done" looks like.
- **Count & size** (adapt to total minutes and pace): ≤2h total → 3–5 steps; 2–4h → 4–7; 4–8h → 6–10; never more than 10 steps. Light pace → slightly shorter blocks; intensive → allow longer deep-work chunks. Use 15–25m only for quick setup/review; use 45–90m when the description implies a single long sitting or deep focus.
- If the user clearly asked for **one uninterrupted session** (e.g. one mock exam, one performance run), use **one** step whose minutes ≈ total (still ≤ max 180 per step is OK; server may split when packing the calendar).

Return ONLY a JSON array (no markdown): [{"title","description","estimatedMinutes","order"}, ...]`;

      const text = await generateText(prompt);

      const jsonText = extractJson(text);
      const parsed = safeJsonParse<ChunkedMicroTask[]>(jsonText);
      let microTasks = Array.isArray(parsed) ? parsed : [];
      if (repeatedConstraint && microTasks.length < repeatedConstraint.count) {
        const baseTitle = resolveTitleFromUserText(chunkBlob, String(title || '').trim() || null);
        microTasks = Array.from({ length: repeatedConstraint.count }, (_, i) => ({
          title: `${baseTitle} - session ${i + 1}`,
          description: repeatedConstraint.oneGo
            ? `Complete in one sitting (${repeatedConstraint.sessionMinutes} min).`
            : `Focused session (${repeatedConstraint.sessionMinutes} min).`,
          estimatedMinutes: repeatedConstraint.sessionMinutes,
          order: i + 1,
        }));
      }
      const sequenced = finalizeChunkSequence(
        microTasks,
        String(title || ''),
        String(description || title || ''),
        !!repeatedConstraint
      );
      const normalized = normalizeMicroTaskMinutesToTotal(sequenced, targetMinutes);

      return NextResponse.json({
        success: true,
        microTasks: normalized.map((mt, idx) => ({
          ...mt,
          title: normalizeChunkTitle(mt.title) || `Study step ${idx + 1}`,
          description: String(mt.description || '').trim() || undefined,
          estimatedMinutes: Math.max(10, Number(mt.estimatedMinutes) || 25),
          order: idx + 1,
          id: `micro-${Date.now()}-${idx}`,
          parentTaskId: '',
          completed: false,
        })),
      });
    }

    if (action === 'parseTask') {
      const body = data as { text?: string };
      const text = normalizeSchedulingUserText(String(body.text || ''));
      if (!text) {
        return NextResponse.json({ error: 'Missing text' }, { status: 400 });
      }

      const nowLocal = new Date();
      const todayLocal = new Date(nowLocal);
      todayLocal.setHours(0, 0, 0, 0);

      // ── AI-led parsing: prompt -> JSON -> heuristic normalization ──
      const prompt = buildCompactParseTaskPrompt({
        text,
        today: toLocalYYYYMMDD(nowLocal),
        nowHHMM: toLocalHHMM(nowLocal),
      });

      let rootParsed: unknown = null;
      try {
        const responseText = await generateText(prompt, {
          maxCompletionTokens: 1024,
        });
        const jsonText = extractJson(responseText);
        const repairPrompt = buildParseTaskRepairPrompt({
          text,
          candidateJson: jsonText,
          today: toLocalYYYYMMDD(nowLocal),
        });
        const repairedText = await generateText(repairPrompt, {
          maxCompletionTokens: 1400,
        });
        const repairedJsonText = extractJson(repairedText);
        rootParsed = safeJsonParseLoose<unknown>(repairedJsonText) ?? safeJsonParseLoose<unknown>(jsonText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isProviderRateLimitErrorMessage(msg)) {
          let safeFallback = buildFallbackFromUserText(text, todayLocal, nowLocal);
          if (String(safeFallback.kind) === 'task' && userTextIndicatesStudyPlan(text)) {
            const upgraded = buildResponseFromLLMExtract(
              { kind: 'study_plan', title: String((safeFallback as Record<string, unknown>).title || 'Study plan') },
              'study_plan',
              text,
              todayLocal,
              nowLocal
            );
            if (upgraded) safeFallback = upgraded;
          }
          return NextResponse.json({
            ...safeFallback,
            _meta: {
              modelRoot: null,
              fallback: true,
              reason: 'provider_rate_limited',
            },
          });
        }
        throw e;
      }

      const items: Record<string, unknown>[] = [];
      const rawItems = Array.isArray(rootParsed) ? rootParsed : [rootParsed];
      for (const rawItem of rawItems) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const p = rawItem as Record<string, unknown>;
        const result = normalizeLLMParseTaskItem(p, text, todayLocal, nowLocal);
        if (result) items.push(result);
      }
      if (items.length === 0) {
        let safeFallback = buildFallbackFromUserText(text, todayLocal, nowLocal);
        if (String(safeFallback.kind) === 'task' && userTextIndicatesStudyPlan(text)) {
          const upgraded = buildResponseFromLLMExtract(
            { kind: 'study_plan', title: String(safeFallback.title || 'Study plan') },
            'study_plan',
            text,
            todayLocal,
            nowLocal
          );
          if (upgraded) safeFallback = upgraded;
        }
        return NextResponse.json({ ...safeFallback, _meta: { modelRoot: rootParsed, fallback: true } });
      }

      if (items.length === 1) {
        return NextResponse.json({ ...items[0], _meta: { modelRoot: rootParsed } });
      }
      return NextResponse.json({
        success: true,
        batch: true,
        items,
        _meta: { modelRoot: rootParsed },
      });
    }

    if (action === 'scheduleTask') {
      const { task } = data;

      const due = task?.dueDate ? parseCalendarDate(String(task.dueDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const today = new Date();
      const today0 = new Date(today);
      today0.setHours(0, 0, 0, 0);
      const due0 = new Date(due);
      due0.setHours(0, 0, 0, 0);
      const spanDays = Math.max(1, Math.ceil((due0.getTime() - today0.getTime()) / 86400000) + 1);
      const lastScheduleDay = spanDays >= 3 ? addDays(due0, -1) : due0;

      const validDateList: string[] = [];
      for (let d = new Date(today0); d.getTime() <= lastScheduleDay.getTime(); d = addDays(d, 1)) {
        validDateList.push(toLocalYYYYMMDD(d));
      }
      if (validDateList.length === 0) validDateList.push(toLocalYYYYMMDD(today0));

      const taskMts = Array.isArray(task?.microTasks) ? task.microTasks : [];
      if (taskMts.length === 0) {
        return NextResponse.json({ success: true, microTasks: [] });
      }

      const normalizedHintDate = (v: unknown): string | null => {
        const s = String(v ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
        const d = parseCalendarDate(s);
        if (Number.isNaN(d.getTime())) return null;
        const d0 = new Date(d);
        d0.setHours(0, 0, 0, 0);
        if (d0.getTime() < today0.getTime() || d0.getTime() > lastScheduleDay.getTime()) return null;
        return toLocalYYYYMMDD(d0);
      };

      const forBalance = taskMts.map((tm: ScheduledMicroTask, idx: number) => ({
        estimatedMinutes: Number(tm.estimatedMinutes) > 0 ? Number(tm.estimatedMinutes) : 25,
        order: Number.isFinite(Number(tm.order)) ? Number(tm.order) : idx + 1,
        title: String(tm.title ?? ''),
      }));

      const useSequential = microTasksAppearSequenced(forBalance);
      const balanced = useSequential
        ? applySequentialScheduleDates(forBalance, today0, lastScheduleDay)
        : applyBalancedScheduleDates(forBalance, today0, lastScheduleDay);

      const withDates = taskMts.map((mt: ScheduledMicroTask, idx: number) => {
        const hinted = normalizedHintDate(mt.scheduledDate);
        return {
          ...mt,
          /** Preserve explicit AI date hints (e.g., alternate-day plans); otherwise use balanced fallback. */
          scheduledDate: hinted ?? balanced[idx]?.scheduledDate ?? validDateList[0],
        };
      });

      return NextResponse.json({
        success: true,
        microTasks: withDates,
      });
    }

    if (action === 'scheduleTasks') {
      const { tasks, availableHours } = data;

      const prompt = `You pack a student's open work into **realistic** calendar slots. Inputs may be messy; infer sensible plans for **any** task type (STEM, languages, arts, job search, chores).

Tasks (each may include id, title, due date, priority, notes):
${JSON.stringify(tasks, null, 2)}

Available hours (keys = weekday names; values = hour numbers or free-text windows—interpret generously):
${JSON.stringify(availableHours, null, 2)}

Rules:
- Respect **due dates** and **priority** (urgent + soon due first).
- **Spread** heavy work across days; avoid stacking all hard tasks on one evening.
- Micro-tasks: usually **20–60 min**; use **shorter** only for quick admin; **longer** only when the task is inherently one block (mock exam, long run).
- **Titles** must be specific to the parent task (no generic "Study").
- **taskId** = 0-based index into the **tasks** array above.
- **scheduledTime** = local **YYYY-MM-DDTHH:mm:ss** for the **first** suggested block of that row (subsequent micro-tasks are ordered the same day or later—do not schedule in the past relative to "today" if provided inside tasks).

Return ONLY a JSON array (no markdown). **taskId** = 0-based integer index into the tasks list.
[
  {
    "taskId": 0,
    "scheduledTime": "YYYY-MM-DDTHH:mm:ss",
    "microTasks": [
      { "title": "string", "description": "string", "estimatedMinutes": 30, "order": 1 }
    ]
  }
]`;

      const text = (await generateText(prompt)).trim();

      let jsonText = text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const scheduled = safeJsonParseLoose<unknown>(jsonText);
      if (!Array.isArray(scheduled)) {
        return NextResponse.json(
          { error: 'Invalid schedule format from AI' },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        scheduled,
      });
    }

    if (action === 'recommendNow') {
      const { currentTime, dayOfWeek, deadlines, remainingTasks, energyPreference, candidateMicroTasks, noStudyDay } =
        data as {
          currentTime?: string;
          dayOfWeek?: string;
          deadlines?: unknown;
          remainingTasks?: unknown;
          energyPreference?: string;
          candidateMicroTasks?: Array<{
            microTaskId?: string;
            taskId?: string;
            microTaskTitle?: string;
            taskTitle?: string;
            subject?: string;
          }>;
          noStudyDay?: boolean;
        };

      const candidates = Array.isArray(candidateMicroTasks)
        ? candidateMicroTasks
          .map((c) => ({
            microTaskId: String(c.microTaskId || '').trim(),
            taskId: String(c.taskId || '').trim(),
            microTaskTitle: String(c.microTaskTitle || '').trim(),
            taskTitle: String(c.taskTitle || '').trim(),
            subject: String(c.subject || 'General').trim() || 'General',
          }))
          .filter((c) => c.microTaskId && c.taskId)
        : [];

      if (candidates.length === 0) {
        return NextResponse.json(
          {
            error: 'no_open_steps',
            message: 'No open study steps to recommend. Add or uncomplete a task first.',
          },
          { status: 422 }
        );
      }

      const allowedIds = new Set(candidates.map((c) => c.microTaskId));

      const prompt = `You are a student study coach. Recommend exactly ONE study step the student should do right now.

Current time: ${currentTime}
Day: ${dayOfWeek || 'unknown'}
Today is a scheduled no-study day (rest day): ${noStudyDay ? 'yes — still pick from the list only if the student explicitly asked for a suggestion; keep reasons gentle' : 'no'}
Upcoming deadlines (context): ${JSON.stringify(deadlines)}
Remaining sessions on today's plan: ${JSON.stringify(remainingTasks)}
Student peak energy time: ${energyPreference}

You MUST choose from this list only (each line is one real calendar step):
${candidates
          .map(
            (c, i) =>
              `${i + 1}. microTaskId="${c.microTaskId}" | subject: ${c.subject} | task: ${c.taskTitle} | step: ${c.microTaskTitle}`
          )
          .join('\n')}

Return raw JSON only, no markdown:
{
  "subject": "string (usually the subject from the chosen row)",
  "task": "string (use the chosen step title — the microTaskTitle)",
  "microTaskId": "string — MUST be exactly one of the microTaskId values from the list above",
  "durationMinutes": number,
  "reason": "string — max 15 words"
}`;

      try {
        const responseText = await generateText(prompt);
        const jsonText = extractJson(responseText);
        const parsed = safeJsonParseLoose<StudyNowRecommendation | null>(jsonText);
        if (!parsed || typeof parsed !== 'object') {
          return NextResponse.json(
            { error: 'Invalid recommendation format from AI', message: 'Try again in a moment.' },
            { status: 422 }
          );
        }

        const rawMicroId =
          parsed.microTaskId != null && String(parsed.microTaskId).trim()
            ? String(parsed.microTaskId).trim()
            : '';
        let microId: string | null = rawMicroId && allowedIds.has(rawMicroId) ? rawMicroId : null;
        if (!microId) {
          const pick = candidates.find(
            (c) =>
              normToken(parsed.task || '').length > 2 &&
              (normToken(c.microTaskTitle).includes(normToken(parsed.task)) ||
                normToken(parsed.task).includes(normToken(c.microTaskTitle)))
          );
          microId = pick?.microTaskId ?? null;
        }
        if (!microId) {
          microId = candidates[0]!.microTaskId;
        }
        const chosen = candidates.find((c) => c.microTaskId === microId) ?? candidates[0]!;

        return NextResponse.json({
          success: true,
          recommendation: {
            subject: chosen.subject,
            task: chosen.microTaskTitle,
            microTaskId: chosen.microTaskId,
            durationMinutes: Number(parsed.durationMinutes) > 0 ? Number(parsed.durationMinutes) : 30,
            reason: parsed.reason || 'Matches your plan and deadlines.',
          },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'AI request failed';
        return NextResponse.json(
          { error: 'recommendNow_failed', message: message.includes('No AI provider') ? message : 'Try again in a moment.' },
          { status: 502 }
        );
      }
    }

    if (action === 'syllabusExtract') {
      const { chunkText } = data as { chunkText?: string };
      const text = typeof chunkText === 'string' ? chunkText : '';
      const prompt = `Extract only the chapter or topic names from this syllabus excerpt.
Ignore page numbers, descriptions, sub-points, and formatting.
Return only the top-level topics or chapters as a flat list.

Syllabus text: ${text.slice(0, 3200)}

Return raw JSON only:
{ "topics": ["string", "string", ...] }`;

      const responseText = await generateText(prompt);
      const jsonText = extractJson(responseText);
      const parsed = safeJsonParse<{ topics?: string[] }>(jsonText);
      const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
      return NextResponse.json({ success: true, topics });
    }

    if (action === 'formatTopicList') {
      const body = data as { subject?: string; rawTopics?: string };
      const subject = String(body.subject || '').trim() || 'General';
      const rawTopics = String(body.rawTopics || '');
      const fallback = formatTopicListFallback(rawTopics);
      if (!rawTopics.trim()) {
        return NextResponse.json({ success: true, subject, topics: fallback });
      }
      const prompt = `Clean and normalize this topic list for a student subject.
Subject: ${subject}
Raw text:
${rawTopics.slice(0, 12000)}

Rules:
- Return one topic per item.
- Remove duplicates.
- Keep wording specific and useful.
- Do not invent topics.
- Preserve the **original top-to-bottom order** of the remaining topics (do not sort alphabetically or by difficulty).
- EXCLUDE lines that are only unit/chapter/module headings (e.g. "Unit 3", "Chapter 2") with no substantive topic name.

Return raw JSON only:
{ "topics": ["topic 1", "topic 2"] }`;
      try {
        const responseText = await generateText(prompt);
        const parsed = safeJsonParseLoose<{ topics?: string[] }>(extractJson(responseText));
        const aiTopics = Array.isArray(parsed?.topics) ? parsed.topics.map((t) => String(t).trim()).filter(Boolean) : [];
        const topics = filterTopicLines(aiTopics.length > 0 ? aiTopics : fallback);
        return NextResponse.json({ success: true, subject, topics });
      } catch {
        return NextResponse.json({ success: true, subject, topics: fallback });
      }
    }

    if (action === 'estimateTopicDurations') {
      const body = data as {
        sessionLengthMinutes?: number;
        studentContext?: string;
        gradeLevel?: string;
        subjects?: Array<{ name?: string; topics?: string[] }>;
      };
      const defaultSession = Number(body.sessionLengthMinutes) > 0 ? Number(body.sessionLengthMinutes) : 30;
      const gradeLevelRaw = body.gradeLevel?.trim() || '';
      const isExamPrep =
        typeof body.studentContext === 'string' && /EXAM PREP/i.test(body.studentContext);
      const effectiveGrade = isExamPrep ? gradeLevelRaw || '10' : gradeLevelRaw;
      const pace: 'light' | 'balanced' | 'intensive' =
        typeof body.studentContext === 'string' && /study pace:\s*light/i.test(body.studentContext)
          ? 'light'
          : typeof body.studentContext === 'string' && /study pace:\s*intensive/i.test(body.studentContext)
            ? 'intensive'
            : 'balanced';
      const ctx = body.studentContext?.trim() ? `\nExtra student context: ${body.studentContext.trim()}` : '';
      const gradeLine = effectiveGrade
        ? `\nStudent grade / program: ${effectiveGrade}`
        : isExamPrep
          ? '\nStudent grade / program: 10 (year) — default for exam prep when unset.'
          : '\nStudent grade / program: not specified — assume a typical MYP or upper-secondary student.';
      const subjects = Array.isArray(body.subjects) ? body.subjects : [];

      const fallbackTopicMinutes = (topic: string) => {
        const t = String(topic);
        const h = estimateMinutesHeuristic(t, defaultSession, effectiveGrade, pace);
        if (isExamPrep) {
          return Math.max(8, Math.min(28, Math.round((h * 0.52) / 5) * 5));
        }
        return Math.max(learningPassFloorMinutes(t, h, effectiveGrade, pace), h);
      };

      const fallback: TopicDurationResponse = {
        subjects: subjects.map((s) => ({
          name: String(s.name || 'General'),
          topics: filterTopicLines(Array.isArray(s.topics) ? s.topics.map((t) => String(t)) : [])
            .filter(
              (topic) =>
                !shouldSkipAsSchedulableTopicTitle(topic) && !isBareCurriculumStrandBanner(topic)
            )
            .map((topic) => {
              const t = String(topic);
              return {
                topic: t,
                estimatedMinutes: fallbackTopicMinutes(t),
              };
            }),
        })),
      };

      const promptExam = `You estimate SHORT review times for exam prep (not full first-time lessons).${gradeLine}${ctx}

Default session (${defaultSession} min) is context only — do not paste it on every row.

Input:
${JSON.stringify(subjects, null, 2)}

Rules:
- **Order**: Same topic strings, same order as input.
- **Targets**: Most lines **10–20 min** active recall / light practice. Simple vocabulary or recall: **8–12**. Heavy proof/essay/lab depth: up to **25–28** rarely.
- Avoid 30+ unless the line clearly demands extended work.
- Grade ${effectiveGrade || '10'}: calibrate slightly (younger a bit more time on the same label).
- Skip headings with no examinable content.

Return raw JSON only:
{ "subjects": [ { "name": "string", "topics": [ { "topic": "string", "estimatedMinutes": 15 } ] } ] }`;

      const promptDefault = `You are an expert study-skills coach. For EACH topic line, output ONE integer: realistic minutes for a first focused learning pass (understand + practice enough to be exam-ready, not a 2-minute skim).

Default session length (${defaultSession} min) is only context for how long they usually sit — not a template to paste on every row.${gradeLine}${ctx}

Input (subjects + topic strings — read subject and line together):
${JSON.stringify(subjects, null, 2)}

Before you write JSON, mentally:
1) Walk the input topics **in the order given** (do not reorder rows in your output).
2) For each row, ask: recall/definitions vs procedures vs extended reasoning vs writing/lab depth?
3) Sanity-check: if two lines look like the same difficulty, their minutes should be close; if one is clearly deeper, gap should be obvious.
4) No "default 45 for everything" — spread should look human.

Rules:
- **Minimum realism**: Ordinary syllabus topics (including short titles like "Logs", "Indices", "Absolute value") almost always need **at least 28–45 minutes** for a serious first pass. Use **below 25** only when the line explicitly says flashcards / one-minute recall / skim-only.
- **STEM procedures** (log laws, trig, quadratics, kinematics, etc.): usually **40–75** depending on depth — never 10–15 unless it is explicitly micro-review.
- **Subject matters**: Biology vocabulary ≠ Physics problem strands ≠ History essays. Use domain norms (languages, arts, PE, humanities, STEM).
- **Output order**: For each subject, the "topics" array must list the **same strings in the same order** as the input (same topic text per line). Only add estimatedMinutes per line.
- One syllabus line = one JSON row unless the input duplicated a heading.
- Long text ≠ automatically huge time — judge by what must be understood or practiced.
- A line like "Big idea — standard" or "Big idea — vertex" (em dash) is usually one small variant on the same idea: still usually **25–40** minutes each, not 12.
- Grade/program: calibrate pace (younger often slower on the same surface topic).
- Skip pure section headings with no examinable content.
- Never output a topic string that starts with "Unit:" (spreadsheet column junk, e.g. duplicate unit headings); those are not study rows.

Return raw JSON only:
{
  "subjects": [
    {
      "name": "Physics",
      "topics": [
        { "topic": "Kinematics", "estimatedMinutes": 35 }
      ]
    }
  ]
}`;

      const prompt = isExamPrep ? promptExam : promptDefault;
      try {
        const responseText = await generateText(prompt);
        const parsed = safeJsonParseLoose<TopicDurationResponse>(extractJson(responseText));
        const normalized = Array.isArray(parsed?.subjects) ? parsed!.subjects : [];
        if (!normalized.length) return NextResponse.json({ success: true, ...fallback });
        let clean = alignTopicDurationsToInputOrder(
          subjects,
          normalized,
          defaultSession,
          effectiveGrade,
          pace
        );
        if (isExamPrep) {
          clean = clean.map((s) => ({
            ...s,
            topics: s.topics.map((r) => ({
              ...r,
              estimatedMinutes: Math.max(
                8,
                Math.min(28, Math.round(Number(r.estimatedMinutes) / 5) * 5)
              ),
            })),
          }));
        }
        return NextResponse.json({ success: true, subjects: clean });
      } catch {
        return NextResponse.json({ success: true, ...fallback });
      }
    }

    if (action === 'syllabusBulkStructure') {
      const raw = typeof (data as { syllabusText?: string }).syllabusText === 'string'
        ? (data as { syllabusText: string }).syllabusText
        : '';
      const text = raw.slice(0, 60000);
      const singleSubjectName = String(
        (data as { singleSubjectName?: string }).singleSubjectName || ''
      ).trim();

      const sharedRules = `1) Prefer "groups" (units / chapters / modules): each group has a short "title" (e.g. "Unit 2 — Algebra") and "topics" (examinable subtopics). **Preserve the source order** of groups and of topics within each group — do not reorder by difficulty or alphabetically.
2) Every topic string must be a real study item — NOT bare labels like "Unit 2" or "Chapter 3" with no content. Do NOT repeat the group title alone as a topic. Do NOT output lines starting with "Unit:" (spreadsheet-style metadata, not a topic name).
3) KEEP wording close to the source. Do NOT summarize away subtopics. Deduplicate only exact duplicates.
4) If the document has no clear unit boundaries, omit "groups" and use "units" as a flat ordered list of topics instead (still in source order).
5) Works for any subject: languages, arts, design, PE, humanities, sciences — same rules.
6) **Semicolons**: In prose like "Topic A; Topic B; Topic C" each clause MUST become its own topic string (same order).
7) **Separate bullets / outcomes** → **separate** strings in "topics". Numbered items, distinct bullets, or clearly different ideas must stay separate.
8) **Line-wrap only**: Combine into a single string only when the source obviously broke **one** short phrase across lines. Join those parts with " · ".`;

      const prompt = singleSubjectName
        ? `You are parsing syllabus text for ONE subject only: "${singleSubjectName}".

The entire excerpt below belongs to this subject. Extract EVERY examinable topic the student must study before an exam. Do not drop items. Do not postpone "hard" topics to implied later study — list everything in source order.

${sharedRules}
9) Return JSON with **exactly one** object in "subjects". Its "name" must be "${singleSubjectName}".

Text:
${text}

Return raw JSON only:
{
  "subjects": [
    {
      "name": "${singleSubjectName}",
      "groups": [
        { "title": "string", "topics": ["string", "..."] }
      ],
      "units": ["optional flat list; if groups present, repeat the same topics in order for compatibility"]
    }
  ]
}`
        : `You are parsing student syllabus material. The text may include MULTIPLE school subjects (e.g. Physics, Chemistry, Mathematics).

For EACH distinct subject, extract structure:

${sharedRules}
6) **One array element = one calendar task**: Each string in "topics" is scheduled as its **own** study block. Do **not** concatenate a whole unit, a whole section, or many separate outcomes into one giant string. Prefer **more, shorter** topic strings over one blob.

Text:
${text}

Return raw JSON only:
{
  "subjects": [
    {
      "name": "string",
      "groups": [
        { "title": "string", "topics": ["string", "..."] }
      ],
      "units": ["optional flat list; if groups present, repeat the same topics in order for compatibility"]
    }
  ]
}`;

      let prepared: SyllabusSubjectNormalized[] = [];
      try {
        const rawResponse = await generateText(prompt);
        const jsonText = extractJson(rawResponse);
        const parsed = safeJsonParseLoose<SyllabusBulkStructure>(jsonText);
        const rawList = Array.isArray(parsed?.subjects) ? parsed.subjects : [];
        prepared = rawList.map((x) => prepareSyllabusSubjectFromAi(x)).filter(Boolean) as SyllabusSubjectNormalized[];
      } catch {
        prepared = [];
      }

      const groupsByName = new Map<string, Array<{ title: string; topics: string[] }>>();
      for (const p of prepared) {
        if (p.groups && p.groups.length > 0) {
          groupsByName.set(p.name.toLowerCase(), p.groups);
        }
      }

      let subjects: SyllabusSubjectNormalized[] = normalizeStructuredSubjects(
        prepared.map(({ name, units }) => ({ name, units }))
      ).map((s) => ({
        name: s.name,
        units: s.units,
        groups: groupsByName.get(s.name.toLowerCase()),
      }));

      const fallbackSubjects = fallbackSubjectsFromSyllabusText(text);
      if (singleSubjectName) {
        const pick =
          subjects.find(
            (s) => s.name.toLowerCase().trim() === singleSubjectName.toLowerCase().trim()
          ) || subjects[0];
        if (pick) {
          subjects = [{ ...pick, name: singleSubjectName }];
        } else {
          const mergedUnits = filterTopicLines(
            fallbackSubjects.flatMap((s) => s.units || [])
          );
          subjects = [
            {
              name: singleSubjectName,
              units: mergedUnits,
              groups: undefined,
            },
          ];
        }
      } else if (subjects.length > 0 && fallbackSubjects.length > 0) {
        subjects = mergeSubjectsPreferMoreTopics(
          subjects.map(({ name, units }) => ({ name, units })),
          fallbackSubjects
        ).map((s) => ({ name: s.name, units: s.units, groups: undefined }));
      }
      if (!subjects.length) {
        subjects = fallbackSubjects.map((s) => ({ name: s.name, units: s.units, groups: undefined }));
      }

      return NextResponse.json({
        success: true,
        subjects: subjects.map((s) => {
          const rawGroups = s.groups;
          const groups =
            Array.isArray(rawGroups) && rawGroups.length > 0
              ? rawGroups
                .map((g) => ({
                  title: String(g.title || 'Section').trim() || 'Section',
                  topics: filterTopicLines(
                    Array.isArray(g.topics) ? g.topics.map((t) => String(t).trim()).filter(Boolean) : []
                  ),
                }))
                .filter((g) => g.topics.length > 0)
              : undefined;
          return {
            name: String(s.name || 'General').trim() || 'General',
            units: filterTopicLines(
              Array.isArray(s.units) ? s.units.map((u) => String(u).trim()).filter(Boolean) : []
            ),
            groups,
          };
        }),
      });
    }

    if (action === 'multiExamPlan') {
      const body = data as {
        today?: string;
        workStart?: string;
        workEnd?: string;
        weekendWorkStart?: string;
        weekendWorkEnd?: string;
        sessionLengthMinutes?: number;
        conservativeHoursPerSubjectPerDay?: number;
        studentContext?: string;
        subjects?: Array<{
          name: string;
          examDate: string;
          units: string[];
        }>;
      };
      const today = body.today || new Date().toISOString().split('T')[0];
      const workStart = body.workStart || '16:00';
      const workEnd = body.workEnd || '20:30';
      const weekendStart = String(body.weekendWorkStart || workStart).trim() || workStart;
      const weekendEnd = String(body.weekendWorkEnd || workEnd).trim() || workEnd;
      const sessionLen = Number(body.sessionLengthMinutes) > 0 ? Number(body.sessionLengthMinutes) : 30;
      const cap = Number(body.conservativeHoursPerSubjectPerDay) > 0 ? Number(body.conservativeHoursPerSubjectPerDay) : 2;
      const ctx = typeof body.studentContext === 'string' && body.studentContext.trim()
        ? `\nStudent context (optional): ${body.studentContext.trim()}`
        : '';
      const subj = Array.isArray(body.subjects) ? body.subjects : [];

      const prompt = `You are building realistic multi-subject exam prep schedules for a high school / college student.

Today (local): ${today}
Weekday work window (Mon–Fri): ${workStart} to ${workEnd}
Weekend work window (Sat–Sun): ${weekendStart} to ${weekendEnd}
Preferred session length: ${sessionLen} minutes
Cap: about ${cap} hours of study per subject per day (wall-clock feel — include short breaks between sessions in your judgment).
${ctx}

For EACH subject below you receive:
- examDate (YYYY-MM-DD) — do not schedule ON that date
- units: ordered list — **keep that exact order** when reasoning (do not reorder topics or units by difficulty).

Subjects JSON:
${JSON.stringify(subj, null, 2)}

Rules:
- Spread each subject from today through at least **3 days before** its exam for **new** material; keep the **last 2 days** before each exam lighter and revision-oriented for that subject.
- Insert **implicit breathing room**: do not chain back-to-back 90m marathons without gap; prefer several shorter blocks across days.
- Each single session should usually stay **≤ ~90 minutes**; if you need more depth, split across two sessions or two days.
- Interleave subjects on shared dates so one course does not eat every evening.
- If impossible, feasible: false + honest adjustmentAdvice + best-effort plans.

Return raw JSON only:
{
  "feasible": boolean,
  "adjustmentAdvice": "string — empty if feasible",
  "summary": "string — one friendly sentence",
  "plans": [
    {
      "subject": "string (must match input name)",
      "plan": [
        {
          "date": "YYYY-MM-DD",
          "topic": "string",
          "durationMinutes": number,
          "startTime": "HH:MM",
          "sessionType": "study" | "revision"
        }
      ]
    }
  ]
}`;

      const jsonText = extractJson(await generateText(prompt));
      const parsed = safeJsonParse<MultiExamPlanResult>(jsonText);
      const plans = Array.isArray(parsed.plans)
        ? parsed.plans.map((p) => ({
          subject: String(p.subject || ''),
          plan: Array.isArray(p.plan) ? p.plan : [],
        }))
        : [];

      return NextResponse.json({
        success: true,
        multiExam: {
          feasible: parsed.feasible !== false,
          adjustmentAdvice: String(parsed.adjustmentAdvice || ''),
          summary: String(parsed.summary || ''),
          plans,
        },
      });
    }

    if (action === 'rebuildWeek') {
      const { missedTasks, availableWindows, dayOfWeek, date, startTime, endTime, sessionLengthMinutes, studentContext } = data;
      const ctx =
        typeof studentContext === 'string' && studentContext.trim()
          ? `\nStudent context (optional): ${studentContext.trim()}`
          : '';
      const prompt = `A student fell behind. Propose **new** dates/times for **only** the missed steps so the week still feels doable—works for any subject or activity.

${ctx.trim() ? ctx.trim() + '\n' : ''}Missed items (each should include microTaskId; may include task title, subject, estimated minutes, old date):
${JSON.stringify(missedTasks)}
Remaining free windows this week (each date has its own startTime/endTime—weekends may differ from weekdays):
${JSON.stringify(availableWindows)}
Today: ${dayOfWeek}, ${date}
Fallback hint if a date is missing times: ${startTime}–${endTime} (local)
Preferred session length: ~${sessionLengthMinutes} minutes (may split or merge slightly if needed)

Guidelines:
- **Preserve microTaskId** exactly as given—those ids tie back to the app.
- Do **not** schedule in the **past** relative to ${date}.
- **Spread** across remaining days; no single day should take the entire pile unless the list is tiny.
- Respect **durationMinutes** roughly (±15 min OK); deep-work steps need longer contiguous blocks.
- If two steps are from the **same parent task**, avoid random interleaving with unrelated subjects unless it helps fatigue—grouping short steps from one assignment is fine.
- If windows are insufficient, still return the **best effort** partial redistribution and keep **message** honest but calm.

Return raw JSON only:
{
  "rescheduled": [
    { "microTaskId": "string", "newDate": "YYYY-MM-DD", "newStartTime": "HH:MM", "durationMinutes": number }
  ],
  "message": "one short reassuring sentence, max 22 words"
}`;

      const responseText = await generateText(prompt);
      const jsonText = extractJson(responseText);
      const parsed = safeJsonParse<RebuildWeekResponse>(jsonText);

      return NextResponse.json({
        success: true,
        rebuild: {
          rescheduled: Array.isArray(parsed.rescheduled) ? parsed.rescheduled : [],
          message: parsed.message || "You're still on track. Here's the updated plan.",
        },
      });
    }

    if (action === 'examPlan') {
      const {
        examName,
        subject,
        examDate,
        today,
        daysAvailable,
        topicsArray,
        startTime,
        endTime,
        weekendStartTime,
        weekendEndTime,
        maxHoursPerDay,
        sessionLengthMinutes,
      } = data;
      const sessionPref = Number(sessionLengthMinutes) > 0 ? Number(sessionLengthMinutes) : 30;
      const workStart = String(startTime || '16:00').trim();
      const workEnd = String(endTime || '20:30').trim();
      const wkndStart = String(weekendStartTime || workStart).trim() || workStart;
      const wkndEnd = String(weekendEndTime || workEnd).trim() || workEnd;
      const maxH = Math.max(0.5, Number(maxHoursPerDay) || 2);
      const topics = Array.isArray(topicsArray) ? topicsArray.map((t: unknown) => String(t).trim()).filter(Boolean) : [];

      const prompt = `You are an expert study planner. Output ONLY valid JSON (no markdown, no code fences).

Create a day-by-day exam prep plan.

Exam name: ${String(examName || 'Exam')}
Subject: ${String(subject || 'General')}
Exam date (YYYY-MM-DD, do NOT schedule on this date): ${String(examDate)}
Today (YYYY-MM-DD): ${String(today)}
Approx. calendar days until exam: ${Number(daysAvailable) || 1}
Topics (preserve wording; each line is one syllabus item — use EXACT strings in "topic" when possible): ${JSON.stringify(topics)}
Daily study budget for THIS subject: about ${maxH} hours
Weekday work window (Mon–Fri): ${workStart} to ${workEnd}
Weekend work window (Sat–Sun): ${wkndStart} to ${wkndEnd}
Preferred session length: ${sessionPref} minutes (sessions may be slightly shorter/longer if needed)

Rules:
1) Every "date" must be >= today and strictly BEFORE exam date (never the exam day).
2) Reserve the last 2 calendar days before the exam for revision-only rows (sessionType "revision"); earlier rows use "study".
3) Spread workload; do not put everything on one day. Respect ~${maxH}h/day for this subject (sum of durationMinutes on a date should not wildly exceed that).
4) durationMinutes: 15–90 per row. Multiple rows on the same date are OK.
5) startTime: pick a time within the correct window for that calendar date’s day of week (weekday: ${workStart}–${workEnd}; weekend: ${wkndStart}–${wkndEnd}) (24h HH:MM).
6) If there are more topics than days, combine ONLY clearly related topics in one "topic" string (e.g. "Topic A + Topic B"); prefer more rows over one huge row.
7) Keep "topic" aligned with the input list so the student can track coverage.

Return raw JSON only:
{
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "topic": "string",
      "durationMinutes": 45,
      "startTime": "16:30",
      "sessionType": "study"
    }
  ],
  "summary": "one short sentence"
}`;

      try {
        const responseText = await generateText(prompt);
        const jsonText = extractJson(responseText);
        const parsed = safeJsonParseLoose<ExamPlanResponse>(jsonText);
        const rawPlan = Array.isArray(parsed?.plan) ? parsed.plan : [];
        const plan = sanitizeExamPlanRows(rawPlan, String(examDate), String(today));
        return NextResponse.json({
          success: true,
          examPlan: {
            plan,
            summary: String(parsed?.summary || '').trim() || 'Plan generated.',
          },
        });
      } catch {
        return NextResponse.json({
          success: true,
          examPlan: {
            plan: [],
            summary: 'Could not generate AI plan; the app will fall back to an even spread across your calendar.',
          },
        });
      }
    }

    const invalid = NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    return invalid;
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to process request';
    console.error('Error with AI API:', error);

    const isNetworkError =
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('network') ||
      message.includes('timeout');

    const errorResponse: { error: string; message?: string; networkIssue?: boolean } = {
      error: message,
    };

    if (isNetworkError) {
      errorResponse.networkIssue = true;
      errorResponse.message =
        'Network connection failed. This might be due to:\n' +
        '• School/work network blocking Google APIs\n' +
        '• Firewall restrictions\n' +
        '• Internet connectivity issues\n\n' +
        'Try:\n' +
        '• Using a VPN (if allowed)\n' +
        '• Connecting to a different network\n' +
        '• Checking if generativelanguage.googleapis.com is accessible';
    }

    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  } finally {
    // Best-effort release for actions that acquired queue slot
    // (safe even if no slot acquired due to internal guard in releaseAiSlot).
    if (acquiredSlot) releaseAiSlot();
  }
}
