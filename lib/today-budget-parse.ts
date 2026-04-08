import type { CalendarEvent, SchedulePreferences } from '@/types';
import { workWindowForLocalDay } from '@/lib/work-window';

/** "Only 1 hour today" / "30 min today" — no AI required (matches AITaskInput). */
/** Natural-language “skip today” / “can’t work today” for adaptive reschedule (no API). */
export function parseSkipTodayScheduling(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/\b(can'?t|cannot)\s+work\s+(today|at all today)\b/.test(t)) return true;
  if (/\b(no\s+study\s+today|skip\s+today|day\s+off\s+today|nothing\s+today|not\s+studying\s+today)\b/.test(t))
    return true;
  if (/\b(clear|wipe)\s+(my\s+)?schedule\s+for\s+today\b/.test(t)) return true;
  return false;
}

export function parseTodayBudgetMinutes(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const budgetMatch =
    trimmed.match(/(?:only|just)\s+(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins)\s*(?:today)?/i) ||
    trimmed.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins)\s*(?:today)\b/i);
  if (!budgetMatch) return null;
  const qty = Number(budgetMatch[1]);
  const unit = String(budgetMatch[2] || '').toLowerCase();
  const minutes = unit.startsWith('h') ? Math.round(qty * 60) : Math.round(qty);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutes;
}

/**
 * Same busy block the store adds in `rebalanceWithTodayBudget`: only the first `minutesFree`
 * minutes of today's work window stay available; the rest is blocked as "Unavailable".
 */
export function calendarEventsForTodayBudgetBlock(
  minutesFree: number,
  prefs: SchedulePreferences,
  now: Date = new Date()
): CalendarEvent[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const parseTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
  };
  const { start: dayStart, end: dayEnd } = workWindowForLocalDay(prefs, now);
  const ws = parseTime(dayStart);
  const we = parseTime(dayEnd);
  const windowStart = new Date(startOfToday);
  windowStart.setHours(ws.h, ws.m, 0, 0);
  const windowEnd = new Date(startOfToday);
  windowEnd.setHours(we.h, we.m, 0, 0);
  const keepUntil = new Date(windowStart.getTime() + Math.max(0, Math.round(minutesFree)) * 60_000);
  const budgetClamp =
    keepUntil < windowStart ? windowStart : keepUntil > windowEnd ? windowEnd : keepUntil;
  if (budgetClamp >= windowEnd) return [];
  return [
    {
      id: `budget-block-test-${Date.now()}`,
      title: 'Unavailable',
      start: budgetClamp,
      end: windowEnd,
      allDay: false,
      eventType: 'other',
      color: '#141413',
      createdAt: now,
      updatedAt: now,
    },
  ];
}
