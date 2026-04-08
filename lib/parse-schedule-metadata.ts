/**
 * Compact **AI-first** scheduling intent from parseTask JSON.
 * Groq fills `scheduleMetadata`; the server trusts it before regex heuristics.
 */

export type ScheduleMetadataPattern =
  | 'pack'
  | 'rotate_daily'
  | 'daily_series'
  | 'every_other_day'
  | 'weekly'
  | 'every_nth_week'
  | 'once'
  | 'fixed_clock'
  | 'unknown';

export type ParsedScheduleMetadata = {
  pattern: ScheduleMetadataPattern;
  /** Rotation order (e.g. Physics → English → Physics). */
  cycle: string[];
  /** For recurring events: 2 = every second week, 3 = every third. */
  everyNWeeks: number;
  sessionsPerDay: number;
};

const ALIAS: Record<string, ScheduleMetadataPattern> = {
  pack: 'pack',
  pack_flex: 'pack',
  flexible: 'pack',
  flexible_pack: 'pack',
  task_pack: 'pack',
  rotate_daily: 'rotate_daily',
  rotating: 'rotate_daily',
  rotation: 'rotate_daily',
  alternate_subjects: 'rotate_daily',
  alternating: 'rotate_daily',
  ab_alternate: 'rotate_daily',
  daily_series: 'daily_series',
  same_daily: 'daily_series',
  every_other_day: 'every_other_day',
  alternate_days: 'every_other_day',
  weekly: 'weekly',
  weekly_repeat: 'weekly',
  every_nth_week: 'every_nth_week',
  biweekly: 'every_nth_week',
  fortnight: 'every_nth_week',
  once: 'once',
  single: 'once',
  one_off: 'once',
  fixed_clock: 'fixed_clock',
  appointment: 'fixed_clock',
  unknown: 'unknown',
};

function normalizePattern(raw: string): ScheduleMetadataPattern {
  const k = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').trim();
  if (!k) return 'unknown';
  return ALIAS[k] ?? 'unknown';
}

/**
 * **Prompt appendix** (keep in sync with parseTask JSON shapes).
 * Short so Groq uses few output tokens.
 */
export const SCHEDULE_METADATA_PROMPT_SNIPPET = `
## scheduleMetadata (required on every item)

Add next to \`kind\` (same object). Use **your judgment** on messy/casual text.

\`scheduleMetadata\`: {
  "pattern": "pack" | "rotate_daily" | "daily_series" | "every_other_day" | "weekly" | "every_nth_week" | "once" | "fixed_clock",
  "cycle": string[] | [],
  "everyNWeeks": 1 | 2 | 3,
  "sessionsPerDay": 1
}

- **rotate_daily**: subjects/themes **alternate each calendar day** until a deadline → set **cycle** to names in order (e.g. \`["Physics","English"]\`); **sessionsPerDay** 1.
- **every_nth_week**: "every second/2nd Sunday", "every third Monday" → set **everyNWeeks** 2 or 3; usually **kind** \`event\` with \`repeat\`.
- **pack**: flexible work the app packs; no fixed day pattern → **cycle** [].
- **fixed_clock**: must show up at a time → **kind** usually \`event\`.
- **daily_series**: same kind of work **each day** until deadline (not alternating subjects) → **cycle** [].
Use **everyNWeeks** 1 when not biweekly/triweekly.
`;

/** Ultra-compact variant for token-limited Groq parseTask prompts (same semantics). */
export const SCHEDULE_METADATA_PROMPT_MICRO = `scheduleMetadata on every root: {"pattern":"pack"|"rotate_daily"|"daily_series"|"every_other_day"|"weekly"|"every_nth_week"|"once"|"fixed_clock","cycle":string[],"everyNWeeks":1|2|3,"sessionsPerDay":1}. rotate_daily=alternate subjects by day→cycle order; every_nth_week=every 2nd/3rd weekday→everyNWeeks+often event; pack=[]; fixed_clock=timed slot; daily_series=same work each day.`;

export function parseScheduleMetadata(root: Record<string, unknown>): ParsedScheduleMetadata | null {
  const sm = root.scheduleMetadata;
  if (sm == null || typeof sm !== 'object' || Array.isArray(sm)) return null;
  const o = sm as Record<string, unknown>;

  const patternRaw = String(o.pattern ?? (o as { p?: unknown }).p ?? '').trim();
  let pattern = normalizePattern(patternRaw);

  const cycleRaw = o.cycle ?? (o as { c?: unknown }).c ?? o.subjects ?? (o as { sub?: unknown }).sub;
  const cycle = Array.isArray(cycleRaw)
    ? cycleRaw
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0 && s.length < 80)
        .slice(0, 8)
    : [];

  const nRaw = o.everyNWeeks ?? (o as { n?: unknown }).n ?? 1;
  let everyNWeeks = Math.round(Number(nRaw));
  if (!Number.isFinite(everyNWeeks)) everyNWeeks = 1;
  everyNWeeks = Math.max(1, Math.min(12, everyNWeeks));

  const spdRaw = o.sessionsPerDay ?? (o as { spd?: unknown }).spd ?? 1;
  let sessionsPerDay = Math.round(Number(spdRaw));
  if (!Number.isFinite(sessionsPerDay)) sessionsPerDay = 1;
  sessionsPerDay = Math.max(1, Math.min(8, sessionsPerDay));

  if (!patternRaw && cycle.length === 0 && everyNWeeks === 1 && sessionsPerDay === 1) return null;

  /** Model sometimes sends only `cycle` — infer rotating daily subjects. */
  if (pattern === 'unknown' && cycle.length >= 2) {
    pattern = 'rotate_daily';
  }

  return { pattern, cycle, everyNWeeks, sessionsPerDay };
}

/**
 * Apply model intent to parsed **event** repeat interval when Groq set `scheduleMetadata.everyNWeeks` or pattern `every_nth_week`.
 */
export function overlayScheduleMetadataOnEvent(
  parsed: Record<string, unknown>,
  meta: ParsedScheduleMetadata
): Record<string, unknown> {
  if (String(parsed.kind) !== 'event') return parsed;

  const repIn = parsed.repeat;
  if (repIn == null || typeof repIn !== 'object' || Array.isArray(repIn)) return parsed;

  const rep = { ...(repIn as Record<string, unknown>) };
  const cur = Math.max(1, Math.round(Number(rep.interval)) || 1);

  let next = cur;
  if (meta.pattern === 'every_nth_week') {
    next = Math.max(2, meta.everyNWeeks);
  } else if (meta.everyNWeeks >= 2 && meta.pattern !== 'pack' && meta.pattern !== 'rotate_daily' && meta.pattern !== 'daily_series') {
    next = meta.everyNWeeks;
  }

  if (next === cur) return parsed;
  return { ...parsed, repeat: { ...rep, frequency: rep.frequency ?? 'weekly', interval: next } };
}
