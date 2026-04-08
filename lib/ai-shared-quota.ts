/** UTC calendar date YYYY-MM-DD — must match Postgres `consume_shared_ai_slot` (UTC). */
export function utcTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Max shared (server-key) AI operations per signed-in user per UTC day.
 * Set `AI_SHARED_DAILY_LIMIT=0` to disable counting (not recommended for production).
 */
export function getAiSharedDailyLimit(): number {
  const raw = process.env.AI_SHARED_DAILY_LIMIT;
  if (raw === undefined || raw === '') return 5;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(500, Math.floor(n)));
}
