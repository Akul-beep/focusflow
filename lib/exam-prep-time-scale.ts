/**
 * Exam planner: default grade, shorter per-topic minutes, daily block cap (one block per subject per day).
 */

import type { SchedulePreferences } from '@/types';
import { maxSchedulePrefsWindowMinutes } from '@/lib/work-window';

/** Default when Settings → Grade is empty */
export const DEFAULT_EXAM_GRADE_LEVEL = '10';

export function examEffectiveGrade(prefs: SchedulePreferences): string {
  const g = prefs.gradeLevel?.trim();
  return g || DEFAULT_EXAM_GRADE_LEVEL;
}

function workWindowMinutes(prefs: SchedulePreferences): number {
  return maxSchedulePrefsWindowMinutes(prefs);
}

/**
 * AI/heuristic minutes are tuned for “full first pass”; exam prep lines are shorter daily-review chunks.
 */
export function scaleRawMinutesForExamTopic(rawMinutes: number): number {
  const r = Number(rawMinutes);
  if (!Number.isFinite(r) || r <= 0) return 15;
  const scaled = r * 0.48;
  return Math.max(8, Math.min(28, Math.round(scaled / 5) * 5));
}

/**
 * Single daily block for one subject: cap so totals stay short and fit a typical evening.
 */
export function capDailyExamBlockTotal(sumMinutes: number, prefs: SchedulePreferences): number {
  const sumRounded = Math.max(10, Math.round(sumMinutes / 5) * 5);
  const windowMin = workWindowMinutes(prefs);
  const fromWindow = Math.round(windowMin * 0.88);
  return Math.min(sumRounded, fromWindow, 95);
}

/** UI hint — typical ceiling for one subject’s daily exam block after capping. */
export function typicalBlockMinutesHint(prefs: SchedulePreferences): number {
  return Math.min(95, Math.round(workWindowMinutes(prefs) * 0.88));
}
