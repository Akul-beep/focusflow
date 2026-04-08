import type { SchedulePreferences } from '@/types';

function parseHHMMToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || '0:0')
    .split(':')
    .map((v) => parseInt(v, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Local Saturday/Sunday (0 = Sun, 6 = Sat). */
export function isWeekendLocal(day: Date): boolean {
  const dow = day.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Effective HH:mm window for a calendar day (weekday vs weekend).
 * Missing weekend fields fall back to the weekday window.
 */
export function workWindowForLocalDay(prefs: SchedulePreferences, day: Date): { start: string; end: string } {
  const ws = prefs.workStart || '16:00';
  const we = prefs.workEnd || '21:30';
  if (isWeekendLocal(day)) {
    const wws = prefs.weekendWorkStart?.trim();
    const wwe = prefs.weekendWorkEnd?.trim();
    if (wws && wwe) return { start: wws, end: wwe };
  }
  return { start: ws, end: we };
}

export function workWindowMinutesForLocalDay(
  prefs: SchedulePreferences,
  day: Date
): { startMin: number; endMin: number } {
  const { start, end } = workWindowForLocalDay(prefs, day);
  return { startMin: parseHHMMToMinutes(start), endMin: parseHHMMToMinutes(end) };
}

/** Largest usable span in minutes across weekday and (if set) weekend windows — for soft daily caps. */
export function maxSchedulePrefsWindowMinutes(prefs: SchedulePreferences): number {
  const wk = Math.max(0, parseHHMMToMinutes(prefs.workEnd || '21:30') - parseHHMMToMinutes(prefs.workStart || '16:00'));
  const wws = prefs.weekendWorkStart?.trim();
  const wwe = prefs.weekendWorkEnd?.trim();
  let weSpan = wk;
  if (wws && wwe) {
    weSpan = Math.max(0, parseHHMMToMinutes(wwe) - parseHHMMToMinutes(wws));
  }
  return Math.max(30, wk, weSpan);
}

/** Returns usable hours between HH:mm work window (same day). */
export function workWindowHours(workStart: string, workEnd: string): number {
  const [sh, sm] = workStart.split(':').map((v) => parseInt(v, 10));
  const [eh, em] = workEnd.split(':').map((v) => parseInt(v, 10));
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  const diff = (end - start) / 60;
  return Math.max(0.5, diff);
}

/** Conservative cap per subject per day when juggling multiple exams. */
export function conservativeHoursPerSubject(workStart: string, workEnd: string, subjectCount: number): number {
  const windowH = workWindowHours(workStart, workEnd);
  const n = Math.max(1, subjectCount);
  return Math.min(3, Math.max(1, windowH / Math.max(2, n)));
}
