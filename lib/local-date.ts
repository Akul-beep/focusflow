/** Calendar / planner date keys in the user's local timezone (never use toISOString().split('T')[0] for this). */

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local midnight (same as `<input type="date">` + local day). */
export function parseLocalDateKey(key: string): Date {
  const [y, mo, da] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (mo || 1) - 1, da || 1, 0, 0, 0, 0);
}

/**
 * Due dates and calendar-day fields from `<input type="date">` or APIs as `YYYY-MM-DD`.
 * `new Date("YYYY-MM-DD")` parses as UTC midnight and shifts the local calendar day — avoid that.
 */
export function parseCalendarDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalDateKey(s);
  return new Date(s);
}

export type PlanStartPreference = 'auto' | 'today' | 'tomorrow';

/** Auto: after 22:00 local, first session day is tomorrow; otherwise today. */
export function resolvePlanStartKey(pref: PlanStartPreference, now = new Date()): string {
  if (pref === 'tomorrow') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return localDateKey(t);
  }
  if (pref === 'today') {
    return localDateKey(now);
  }
  if (pref === 'auto' && now.getHours() >= 22) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return localDateKey(t);
  }
  return localDateKey(now);
}
