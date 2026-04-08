/**
 * Multi-subject exam prep: every prep day gets topics (even split).
 * Exactly ONE calendar block per subject per day; duration = capped sum of scaled (short) per-topic minutes.
 */

import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { SchedulePreferences } from '@/types';
import { parseLocalDateKey } from '@/lib/local-date';
import { maxSchedulePrefsWindowMinutes } from '@/lib/work-window';
import type { SyllabusTopicRow } from '@/lib/exam-syllabus-extract';
import { estimateMinutesHeuristic } from '@/lib/topic-duration-estimate';
import { normalizeExamTopicKey } from '@/lib/exam-topic-minutes';
import {
  examEffectiveGrade,
  scaleRawMinutesForExamTopic,
  capDailyExamBlockTotal,
  typicalBlockMinutesHint,
} from '@/lib/exam-prep-time-scale';

export { DEFAULT_EXAM_GRADE_LEVEL, typicalBlockMinutesHint } from '@/lib/exam-prep-time-scale';

/** @deprecated */
export function examPrepBlockMinutes(prefs: SchedulePreferences): number {
  return typicalBlockMinutesHint(prefs);
}

export type PrepSessionBlueprint = {
  id: string;
  subjectId: string;
  subjectName: string;
  sectionTitle: string;
  topics: string[];
  estimatedMinutes: number;
  order: number;
};

export type DatedPrepSession = PrepSessionBlueprint & { scheduledDate: Date };

export type SubjectPrepInput = {
  id: string;
  subject: string;
  examName: string;
  examDateKey: string;
  rows: SyllabusTopicRow[];
  topicMinutes?: Map<string, number>;
};

export function softDailyStudyCapMinutes(prefs: SchedulePreferences): number {
  const workWindowMin = maxSchedulePrefsWindowMinutes(prefs);
  const recoveryMin = prefs.breakMinutes + prefs.bufferMinutes;
  const capFactor =
    prefs.studyPace === 'light' ? 0.72 : prefs.studyPace === 'intensive' ? 0.9 : 0.82;
  return Math.max(35, Math.round(workWindowMin * capFactor) - recoveryMin);
}

function labelForSlice(slice: SyllabusTopicRow[]): string {
  const sections = [...new Set(slice.map((r) => (r.sectionTitle || 'General').trim() || 'General'))];
  if (sections.length === 1) return sections[0]!;
  if (sections.length === 2) return `${sections[0]} · ${sections[1]}`;
  return `${sections[0]} · +${sections.length - 1} parts`;
}

function dayKey(d: Date): string {
  return format(startOfDay(d), 'yyyy-MM-dd');
}

function rowLookupMinutes(row: SyllabusTopicRow, sub: SubjectPrepInput, prefs: SchedulePreferences): number {
  const pace = (prefs.studyPace || 'balanced') as 'light' | 'balanced' | 'intensive';
  const grade = examEffectiveGrade(prefs);
  const k = normalizeExamTopicKey(row.topic);
  const fromMap = sub.topicMinutes?.get(k);
  if (fromMap != null && Number.isFinite(fromMap) && fromMap > 0) {
    return Math.max(8, Math.min(28, Math.round(fromMap / 5) * 5));
  }
  const raw = estimateMinutesHeuristic(
    row.topic,
    Math.min(28, prefs.defaultSessionMinutes || 28),
    grade,
    pace
  );
  return scaleRawMinutesForExamTopic(raw);
}

/**
 * Put topics on **every** prep day as evenly as possible (consecutive syllabus order).
 */
function bucketRowsEvenChunks(rows: SyllabusTopicRow[], dayCount: number): SyllabusTopicRow[][] {
  const T = rows.length;
  const D = Math.max(1, dayCount);
  const buckets: SyllabusTopicRow[][] = Array.from({ length: D }, () => []);
  if (T === 0) return buckets;
  const base = Math.floor(T / D);
  const rem = T % D;
  let r = 0;
  for (let d = 0; d < D; d++) {
    const cnt = base + (d < rem ? 1 : 0);
    for (let k = 0; k < cnt && r < T; k++) {
      buckets[d]!.push(rows[r++]!);
    }
  }
  return buckets;
}

/** Exactly one session per non-empty day slice. */
function oneBlockFromDaySlice(
  slice: SyllabusTopicRow[],
  day: Date,
  subjectId: string,
  subjectName: string,
  sub: SubjectPrepInput,
  prefs: SchedulePreferences,
  dayIndex: number,
  orderRef: { n: number }
): DatedPrepSession {
  orderRef.n += 1;
  let sum = 0;
  for (const row of slice) {
    sum += rowLookupMinutes(row, sub, prefs);
  }
  const total = capDailyExamBlockTotal(sum, prefs);
  return {
    id: `${subjectId}-d${dayIndex}-day`,
    subjectId,
    subjectName,
    sectionTitle: labelForSlice(slice),
    topics: slice.map((r) => r.topic),
    estimatedMinutes: total,
    order: orderRef.n,
    scheduledDate: new Date(day),
  };
}

function buildDatedSessionsForSubject(
  sub: SubjectPrepInput,
  prepDays: Date[],
  prefs: SchedulePreferences
): DatedPrepSession[] {
  if (sub.rows.length === 0 || prepDays.length === 0) return [];

  const buckets = bucketRowsEvenChunks(sub.rows, prepDays.length);
  const orderRef = { n: 0 };
  const out: DatedPrepSession[] = [];

  for (let d = 0; d < prepDays.length; d++) {
    const slice = buckets[d]!;
    if (slice.length === 0) continue;
    const day = prepDays[d]!;
    out.push(oneBlockFromDaySlice(slice, day, sub.id, sub.subject, sub, prefs, d, orderRef));
  }

  return out;
}

function lastPrepDay(examDay: Date): Date {
  const e0 = startOfDay(examDay);
  const today = startOfDay(new Date());
  const span = differenceInCalendarDays(e0, today) + 1;
  return span >= 3 ? addDays(e0, -1) : e0;
}

function enumeratePrepDays(prepStart: Date, prepEnd: Date): Date[] {
  const a = startOfDay(prepStart);
  const b = startOfDay(prepEnd);
  if (a.getTime() > b.getTime()) return [a];
  const out: Date[] = [];
  for (let d = new Date(a); d.getTime() <= b.getTime(); d = addDays(d, 1)) {
    out.push(new Date(d));
  }
  return out;
}

function interleaveSubjectsPerDay(dated: DatedPrepSession[]): DatedPrepSession[] {
  const byDay = new Map<string, DatedPrepSession[]>();
  const dayOrder: string[] = [];
  for (const s of dated) {
    const k = dayKey(s.scheduledDate);
    if (!byDay.has(k)) {
      byDay.set(k, []);
      dayOrder.push(k);
    }
    byDay.get(k)!.push(s);
  }
  dayOrder.sort();

  const out: DatedPrepSession[] = [];
  for (const k of dayOrder) {
    const bucket = byDay.get(k) || [];
    const bySubject = new Map<string, DatedPrepSession[]>();
    for (const s of bucket) {
      if (!bySubject.has(s.subjectId)) bySubject.set(s.subjectId, []);
      bySubject.get(s.subjectId)!.push(s);
    }
    for (const q of bySubject.values()) q.sort((a, b) => a.order - b.order);

    const queues = [...bySubject.values()];
    let i = 0;
    let guard = 0;
    while (queues.some((q) => q.length > 0) && guard < 10_000) {
      guard++;
      const q = queues[i % queues.length];
      i++;
      if (q.length === 0) continue;
      out.push(q.shift()!);
    }
  }
  return out;
}

function rebalanceOverload(
  dated: DatedPrepSession[],
  dailyCap: number,
  subjectLastPrep: Map<string, Date>
): DatedPrepSession[] {
  const byDay = new Map<string, DatedPrepSession[]>();
  for (const s of dated) {
    const k = dayKey(s.scheduledDate);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }

  const maxIter = dated.length * 12;
  let iter = 0;

  while (iter < maxIter) {
    iter++;
    let overloadedKey: string | null = null;
    for (const [k, bucket] of byDay) {
      const load = bucket.reduce((a, s) => a + s.estimatedMinutes, 0);
      if (load > dailyCap) {
        overloadedKey = k;
        break;
      }
    }
    if (!overloadedKey) break;

    const bucket = byDay.get(overloadedKey)!;
    const movable = [...bucket].sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);
    let moved = false;

    for (const s of movable) {
      const last = subjectLastPrep.get(s.subjectId);
      if (!last) continue;
      const cur = parseLocalDateKey(overloadedKey);
      const next = addDays(cur, 1);
      if (startOfDay(next).getTime() > startOfDay(last).getTime()) continue;

      const nk = dayKey(next);
      const nextBucket = byDay.get(nk) ?? [];
      const nextLoad = nextBucket.reduce((a, x) => a + x.estimatedMinutes, 0);
      if (nextLoad + s.estimatedMinutes > dailyCap * 1.35) continue;

      const nb = bucket.filter((x) => x.id !== s.id);
      byDay.set(overloadedKey, nb);
      s.scheduledDate = next;
      nextBucket.push(s);
      byDay.set(nk, nextBucket);
      moved = true;
      break;
    }

    if (!moved) break;
  }

  const flat: DatedPrepSession[] = [];
  const keys = [...byDay.keys()].sort();
  for (const k of keys) {
    flat.push(...(byDay.get(k) || []));
  }
  return interleaveSubjectsPerDay(flat);
}

export function planMultiSubjectExamPrep(
  subjects: SubjectPrepInput[],
  prefs: SchedulePreferences,
  planStart: Date = new Date()
): DatedPrepSession[] {
  const today = startOfDay(planStart);
  const dailyCap = softDailyStudyCapMinutes(prefs);

  const subjectLastPrep = new Map<string, Date>();
  const dated: DatedPrepSession[] = [];

  for (const sub of subjects) {
    const examDay = startOfDay(parseLocalDateKey(sub.examDateKey));
    const prepEnd = lastPrepDay(examDay);
    subjectLastPrep.set(sub.id, prepEnd);
    const prepDays = enumeratePrepDays(today, prepEnd);
    dated.push(...buildDatedSessionsForSubject(sub, prepDays, prefs));
  }

  const interleaved = interleaveSubjectsPerDay(dated);
  return rebalanceOverload(interleaved, dailyCap, subjectLastPrep);
}
