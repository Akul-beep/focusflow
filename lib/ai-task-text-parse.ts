/**
 * Fallback parsing from the user's raw message when the LLM omits minutes/title.
 */

/**
 * Fix common weekday misspellings so `extractWeekdayIndicesFromUserText` and the LLM see real day names.
 */
export function normalizeWeekdayMisspellings(input: string): string {
  let s = input;
  const repl = (pairs: Array<[RegExp, string]>) => {
    for (const [re, to] of pairs) s = s.replace(re, to);
  };
  repl([
    [/\bthrudays\b/gi, 'thursdays'],
    [/\bthruday\b/gi, 'thursday'],
    [/\bthrusdays\b/gi, 'thursdays'],
    [/\bthrusday\b/gi, 'thursday'],
    [/\bthurdays\b/gi, 'thursdays'],
    [/\bthurday\b/gi, 'thursday'],
    [/\bthursdayy\b/gi, 'thursday'],
    [/\brhsuday\b/gi, 'thursday'],
    [/\btusdays\b/gi, 'tuesdays'],
    [/\btusday\b/gi, 'tuesday'],
    [/\btusedays\b/gi, 'tuesdays'],
    [/\btuseday\b/gi, 'tuesday'],
    [/\btuesdy\b/gi, 'tuesday'],
    [/\bwensdays\b/gi, 'wednesdays'],
    [/\bwensday\b/gi, 'wednesday'],
    [/\bwedsdays\b/gi, 'wednesdays'],
    [/\bwedsday\b/gi, 'wednesday'],
    [/\bednesdays\b/gi, 'wednesdays'],
    [/\bednesday\b/gi, 'wednesday'],
    [/\bwedensdays\b/gi, 'wednesdays'],
    [/\bwedensday\b/gi, 'wednesday'],
    [/\bmondya\b/gi, 'monday'],
    [/\bmunday\b/gi, 'monday'],
    [/\bfirday\b/gi, 'friday'],
    [/\bsaterdays\b/gi, 'saturdays'],
    [/\bsaterday\b/gi, 'saturday'],
    [/\bsundayy\b/gi, 'sunday'],
  ]);
  return s;
}

/**
 * Light cleanup so **regex heuristics** (recurring class, standup, etc.) survive common typos and voice glitches.
 * The LLM still does most of the work for slang and messy phrasing — this is not a full spellchecker.
 */
export function normalizeSchedulingUserText(raw: string): string {
  let t = String(raw || '')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .replace(/\s+/g, ' ');

  if (!t) return t;

  t = normalizeWeekdayMisspellings(t);

  const lower = t.toLowerCase();

  /** Voice / fat-finger: "match lass" → math class */
  t = t.replace(/\bmatch\s+lass\b/gi, 'math class');

  /** "match" → "math" when it’s clearly the subject (not "rematch", "matching"). */
  t = t.replace(/\bmatch\b(?=\s+(class|every|on\b|at\b))/gi, 'math');

  /** "lass" as "class" when it clearly isn't "glass" (word-boundary `lass` only). */
  if (/\b(every|each|weekly|on)\b/i.test(lower) && extractWeekdayIndicesFromUserText(t).length > 0) {
    t = t.replace(/\blass\b/gi, 'class');
  }

  /** Casual time shorthands */
  t = t.replace(/\b2mrw\b/gi, 'tomorrow');
  t = t.replace(/\btmrw\b/gi, 'tomorrow');
  t = t.replace(/\btmr\b/gi, 'tomorrow');
  t = t.replace(/\b2moro\b/gi, 'tomorrow');
  /** Common recurrence typos */
  t = t.replace(/\bdail\b/gi, 'daily');
  t = t.replace(/\bdaiily\b/gi, 'daily');
  t = t.replace(/\bwekkly\b/gi, 'weekly');
  /** Light slang → phrasing the model + parsers already know */
  t = t.replace(/\bgotta\b/gi, 'have to');
  t = t.replace(/\bkinda\b/gi, 'kind of');
  t = t.replace(/\blemme\b/gi, 'let me');
  t = t.replace(/\bwanna\b/gi, 'want to');
  t = t.replace(/\bgonna\b/gi, 'going to');
  /** Casual openers — strip so weekday/recurrence regexes still hit. */
  t = t.replace(/\b(ok\s+so\s+like|yeah\s+so\s+like|so\s+like)\b/gi, ' ').replace(/\s+/g, ' ');

  /** Meta instructions to the app / Cursor (blows up LLM prompts + not scheduling content). */
  t = t
    .replace(/\s*[.,]?\s*I\s+need\s+you\s+to\s+\/plan\b[\s\S]*$/i, '')
    .replace(/\s*[.,]?\s*\/plan\s+the\s+AI\s+Task\s+Creator\b[\s\S]*$/i, '')
    .replace(/\s*,\s*and\s+execute[\s\S]*$/i, '')
    .replace(/\brest\s+are\s+all\s+good\.?\s*/gi, '')
    .replace(/\bvamos!\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return t.trim();
}

const WEEKDAY_WORDS: Array<{ word: string; dow: number }> = [
  { word: 'wednesday', dow: 3 },
  { word: 'thursday', dow: 4 },
  { word: 'tuesday', dow: 2 },
  { word: 'saturday', dow: 6 },
  { word: 'sunday', dow: 0 },
  { word: 'monday', dow: 1 },
  { word: 'friday', dow: 5 },
  { word: 'thurs', dow: 4 },
  { word: 'tues', dow: 2 },
  { word: 'wed', dow: 3 },
  { word: 'thu', dow: 4 },
  { word: 'sat', dow: 6 },
  { word: 'sun', dow: 0 },
  { word: 'mon', dow: 1 },
  { word: 'fri', dow: 5 },
  { word: 'tue', dow: 2 },
];

/** 0=Sun … 6=Sat, order of first mention in text. */
export function extractWeekdayIndicesFromUserText(text: string): number[] {
  /** "Tue/Thu" → treat slashes like spaces so each weekday token is found. */
  const t = text.replace(/[/／]/g, ' ').toLowerCase();
  const hits: { index: number; dow: number }[] = [];
  for (const { word, dow } of WEEKDAY_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      hits.push({ index: m.index, dow });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const out: number[] = [];
  for (const h of hits) {
    if (!out.includes(h.dow)) out.push(h.dow);
  }
  return out;
}

/** Weekday tokens for NL date rules (longest short-forms first where needed). */
const WEEKDAY_NAMES_FOR_DATE_RE =
  'monday|tuesday|wednesday|thursday|friday|saturday|sunday|thurs|thur|thu|tues|tue|weds|wed|mon|fri|sat|sun';

function pickNextCalendarDayOfMonth(dom: number, refMidnight: Date): Date | null {
  if (dom < 1 || dom > 31) return null;
  const base = new Date(refMidnight);
  base.setHours(0, 0, 0, 0);
  let y = base.getFullYear();
  let m0 = base.getMonth();
  for (let i = 0; i < 18; i++) {
    const cand = new Date(y, m0, dom, 0, 0, 0, 0);
    if (cand.getFullYear() === y && cand.getMonth() === m0 && cand.getDate() === dom && cand.getTime() >= base.getTime()) {
      return cand;
    }
    m0 += 1;
    if (m0 > 11) {
      m0 = 0;
      y += 1;
    }
  }
  return null;
}

/** "by the 19th", "due the 19th", "before the 19th", "by 19th" → next local calendar date on that day-of-month ≥ ref. */
export function inferOrdinalDeadlineDayFromUserText(text: string, ref: Date): Date | null {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return null;
  const tl = raw.toLowerCase();
  const hasDeadlineCue = /\b(by|before|until|till|due|deadline|no\s+later\s+than)\b/i.test(tl);
  let dom: number | null = null;

  const mByThe = tl.match(
    /\b(?:by|before|until|till|no\s+later\s+than)\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*century)/i
  );
  const mDueThe = tl.match(/\bdue\s+(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  const mTheOnly =
    hasDeadlineCue && tl.match(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b(?!\s*century)/i);
  const mBareOrd = tl.match(/\b(?:by|before|until|till|due)\s+(\d{1,2})(?:st|nd|rd|th)\b/i);

  if (mByThe) dom = parseInt(mByThe[1]!, 10);
  else if (mDueThe) dom = parseInt(mDueThe[1]!, 10);
  else if (mTheOnly) dom = parseInt(mTheOnly[1]!, 10);
  else if (mBareOrd) dom = parseInt(mBareOrd[1]!, 10);

  if (dom == null || dom < 1 || dom > 31) return null;

  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);
  return pickNextCalendarDayOfMonth(dom, base);
}

/**
 * Infer a **local calendar day** for one-off scheduling from relative phrases (today, tomorrow, named weekdays,
 * "this Thursday" vs "next Thursday", "in 3 days"). Uses `ref` as "now" (typically server `nowLocal`).
 *
 * **Weekday rules (one-off, not weekly recurrence):**
 * - **Plain** "Thursday", **"this Thursday"**, **"coming Thursday"** → the **soonest** matching weekday (0–6 days; **today** if it is that weekday).
 * - **"next Thursday"** (and **"next week"** + a weekday, any order) → **not** the imminent one: always **at least 7 days** after `ref`’s calendar day toward that weekday (`d0 + 7` where `d0` is the forward offset to the nearest occurrence).
 *
 * Returns `null` when nothing date-like is found, or when the text clearly describes **weekly recurrence**
 * (so the caller should use `repeat.daysOfWeek` + `nextOccurrenceForWeeklyRepeat` instead).
 */
export function inferCalendarDayFromUserText(text: string, ref: Date): Date | null {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return null;

  if (userAskedForWeeklyRecurrence(raw) && extractWeekdayIndicesFromUserText(raw).length >= 2) {
    return null;
  }

  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);

  const t = raw.toLowerCase();
  const orderedDows = extractWeekdayIndicesFromUserText(raw);

  if (orderedDows.length >= 1 && userAskedForWeeklyRecurrence(raw)) {
    return null;
  }

  if (orderedDows.length > 0) {
    const targetDow = orderedDows[0]!;
    const dowNow = base.getDay();
    const d0 = (targetDow - dowNow + 7) % 7;

    const explicitNextWeekday = new RegExp(
      `\\bnext\\s+(?!week\\b)(${WEEKDAY_NAMES_FOR_DATE_RE})\\b`,
      'i'
    ).test(raw);

    const hasWeekdayToken = new RegExp(`\\b(${WEEKDAY_NAMES_FOR_DATE_RE})\\b`, 'i').test(raw);
    const nextWeekWithWeekday = /\bnext\s+week\b/i.test(raw) && hasWeekdayToken;

    const strictNext = explicitNextWeekday || nextWeekWithWeekday;

    const delta = strictNext ? d0 + 7 : d0;

    const out = new Date(base);
    out.setDate(out.getDate() + delta);
    return out;
  }

  if (/\btoday\b/.test(t)) {
    return base;
  }
  if (/\b(tomorrow|tmrw|tmr|2mrw|2moro)\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\bday after tomorrow\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return d;
  }
  const inDays = t.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) {
    const n = parseInt(inDays[1]!, 10);
    if (Number.isFinite(n) && n >= 0) {
      const d = new Date(base);
      d.setDate(d.getDate() + n);
      return d;
    }
  }

  const ordinal = inferOrdinalDeadlineDayFromUserText(raw, ref);
  if (ordinal) return ordinal;

  return null;
}

/**
 * When the model returns too many `daysOfWeek` values, trust explicit weekday names in the user message.
 */
export function sanitizeWeeklyRepeatDaysFromUserText(userText: string, modelDays: number[]): number[] {
  const t = userText.toLowerCase();
  if (/\bweekdays\b|\bmonday\s*[-–]\s*friday\b|\bmon\s*[-–]\s*fri\b/i.test(t)) {
    return [1, 2, 3, 4, 5];
  }
  const fromUser = extractWeekdayIndicesFromUserText(userText);
  if (fromUser.length >= 1) {
    return fromUser;
  }
  const uniq = [...new Set(modelDays)].filter((d) => d >= 0 && d <= 6);
  uniq.sort((a, b) => a - b);
  return uniq;
}

/**
 * Resolve recurrence days for events from natural language.
 * Supports daily / every day / weekdays / weekends even when weekdays are not named.
 */
export function extractEventRepeatDaysFromUserText(userText: string, modelDays: number[] = []): number[] {
  const t = String(userText || '').toLowerCase();
  if (/\b(every\s+day|each\s+day|daily)\b/i.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/\bweekdays?\b|\b(mon(day)?\s*[-–]\s*fri(day)?)\b/i.test(t)) return [1, 2, 3, 4, 5];
  if (/\bweekends?\b|\b(sat(urday)?\s*(and|&)\s*sun(day)?)\b/i.test(t)) return [0, 6];
  return sanitizeWeeklyRepeatDaysFromUserText(userText, modelDays);
}

function pad2(n: number): string {
  return String(Math.max(0, Math.min(59, n))).padStart(2, '0');
}

function clockToHHMM(h: number, m: number): string {
  return `${String(Math.max(0, Math.min(23, h))).padStart(2, '0')}:${pad2(m)}`;
}

function applyAmPm(hour: number, ap?: string | null): number {
  const ap0 = ap?.toLowerCase();
  if (ap0 === 'pm' && hour < 12) return hour + 12;
  if (ap0 === 'am' && hour === 12) return 0;
  if (ap0 === 'am' && hour < 12) return hour;
  return hour;
}

/**
 * Pull start/end clock from natural phrasing so recurring practice doesn't fall back to "work start" only.
 */
export function extractEventTimeRangeFromUserText(text: string): {
  startHHMM: string;
  endHHMM: string;
} | null {
  const t = text
    .trim()
    // Common speech-to-text / keyboard typo: "9:!5" -> "9:15"
    .replace(/(\d)\s*:\s*!\s*(\d)\b/g, '$1:1$2');
  const hasAmPm = /\b(am|pm)\b/i.test(t);

  let m = t.match(/\b(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\b/);
  if (m) {
    const h1 = parseInt(m[1]!, 10);
    const mi1 = parseInt(m[2]!, 10);
    const h2 = parseInt(m[3]!, 10);
    const mi2 = parseInt(m[4]!, 10);
    if (
      [h1, mi1, h2, mi2].every((x) => Number.isFinite(x)) &&
      h1 <= 23 &&
      h2 <= 23
    ) {
      return { startHHMM: clockToHHMM(h1, mi1), endHHMM: clockToHHMM(h2, mi2) };
    }
  }

  /** "5pm–7pm", "5 pm - 7:30 pm" — each side has its own am/pm (no space required before dash). */
  m = t.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );
  if (m) {
    let h1 = parseInt(m[1]!, 10);
    const mi1 = m[2] ? parseInt(m[2], 10) : 0;
    let h2 = parseInt(m[4]!, 10);
    const mi2 = m[5] ? parseInt(m[5], 10) : 0;
    h1 = applyAmPm(h1, m[3]);
    h2 = applyAmPm(h2, m[6]);
    return { startHHMM: clockToHHMM(h1, mi1), endHHMM: clockToHHMM(h2, mi2) };
  }

  m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    let h1 = parseInt(m[1]!, 10);
    const mi1 = m[2] ? parseInt(m[2], 10) : 0;
    let h2 = parseInt(m[3]!, 10);
    const mi2 = m[4] ? parseInt(m[4], 10) : 0;
    const ap = m[5];
    h1 = applyAmPm(h1, ap);
    h2 = applyAmPm(h2, ap);
    return { startHHMM: clockToHHMM(h1, mi1), endHHMM: clockToHHMM(h2, mi2) };
  }

  m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\b/i);
  if (m && !hasAmPm) {
    let h1 = parseInt(m[1]!, 10);
    const mi1 = m[2] ? parseInt(m[2], 10) : 0;
    let h2 = parseInt(m[3]!, 10);
    const mi2 = m[4] ? parseInt(m[4], 10) : 0;
    if (h1 <= 11 && h2 <= 11) {
      h1 += 12;
      h2 += 12;
    }
    return { startHHMM: clockToHHMM(h1, mi1), endHHMM: clockToHHMM(h2, mi2) };
  }

  m = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    const h1 = applyAmPm(parseInt(m[1]!, 10), m[3]);
    const mi1 = m[2] ? parseInt(m[2], 10) : 0;
    const start = new Date(2000, 0, 1, h1, mi1);
    start.setMinutes(start.getMinutes() + 60);
    return {
      startHHMM: clockToHHMM(h1, mi1),
      endHHMM: clockToHHMM(start.getHours(), start.getMinutes()),
    };
  }

  /** "Mon 9am", "9am weekly" (no colon before am/pm) */
  m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    const h1 = applyAmPm(parseInt(m[1]!, 10), m[3]);
    const mi1 = m[2] ? parseInt(m[2], 10) : 0;
    const start = new Date(2000, 0, 1, h1, mi1);
    start.setMinutes(start.getMinutes() + 60);
    return {
      startHHMM: clockToHHMM(h1, mi1),
      endHHMM: clockToHHMM(start.getHours(), start.getMinutes()),
    };
  }

  m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (m) {
    const h1 = applyAmPm(parseInt(m[1]!, 10), m[3]);
    const mi1 = parseInt(m[2]!, 10);
    const start = new Date(2000, 0, 1, h1, mi1);
    start.setMinutes(start.getMinutes() + 60);
    return {
      startHHMM: clockToHHMM(h1, mi1),
      endHHMM: clockToHHMM(start.getHours(), start.getMinutes()),
    };
  }

  return null;
}

function looksLikeWeeklyRecurringActivity(userText: string): boolean {
  const t = userText.toLowerCase();
  const weeklyCue =
    /\bevery\b|\beach\b|\bweekly\b/i.test(t) ||
    /\b(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i.test(t);
  if (!weeklyCue) return false;
  const sporty =
    /\b(soccer|football|basketball|volleyball|tennis|swimming|swim|practice|training|gym|rehearsal|band|orchestra|choir|lesson|club|game|match|scrimmage)\b/.test(
      t
    );
  const academic =
    /\b(paper|past paper|mock|exam|test|quiz|revise|revision|study session|homework|essay|assignment|topic|unit|chapter|syllabus|ib)\b/.test(
      t
    );
  return sporty && !academic && extractWeekdayIndicesFromUserText(userText).length >= 1;
}

/**
 * Structural: named weekday(s) + clock range + weekly recurrence (or 2+ days).
 * Catches "Bio Tue/Thu 4-5pm weekly" when the LLM wrongly returns task/study_plan → chunkTask invents fake steps.
 * Not keyed to subject vocabulary — only shape of the request.
 */
export function looksLikeRecurringWeekdayClockBlock(userText: string): boolean {
  const raw = userText.trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (/\b(past papers?|mock exams?|practice papers?|timed papers?|question papers?)\b/i.test(t)) return false;
  if (/\b(essay|dissertation|coursework)\b/i.test(t) && !/\b(class|lesson|lecture|lab)\b/i.test(t)) return false;
  if (/\b(every\s+day|each\s+day|daily)\b/i.test(t)) return false;
  if (/\b(alternate|every\s+other)\s+days?\b/i.test(t)) return false;
  if (/\b(until|till|before)\b.*\b(exam|test)\b/i.test(t)) return false;

  const times = extractEventTimeRangeFromUserText(raw);
  if (!times) return false;

  const days = extractWeekdayIndicesFromUserText(raw);
  if (days.length === 0) return false;

  const weeklyish =
    userAskedForWeeklyRecurrence(raw) ||
    /\bweekly\b|\beach\s+week\b|\bevery\s+week\b|\brecurring\b/i.test(t) ||
    days.length >= 2;

  /** Model echoed "weekly event" but still returned a task — treat as calendar. */
  const metaCalendar = /\bweekly\s+event\b|\bcalendar\s+event\b|\brecurring\s+event\b/i.test(t);

  if (!weeklyish && !metaCalendar) return false;
  return true;
}

function inferEventTypeForRecurringBlock(userText: string): 'class' | 'meeting' | 'event' {
  const t = userText.toLowerCase();
  if (/\b(standup|stand-up|sync|scrum|meeting|1:1|one[\s-]on[\s-]one|townhall|retro)\b/.test(t)) return 'meeting';
  if (/\b(class|lesson|lecture|lab|seminar|period|block)\b/.test(t)) return 'class';
  if (
    /\b(bio|biology|chem|chemistry|physics|math|maths|calculus|algebra|english|history|geography|science|econ|psychology|spanish|french|mandarin)\b/.test(
      t
    )
  )
    return 'class';
  return 'event';
}

/**
 * Force calendar event when the model classified a recurring weekday+time block as task or study_plan.
 */
export function fixMisclassifiedRecurringWeekdayClockBlockAsEvent(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  if (parsed.kind === 'event') return null;
  if (!looksLikeRecurringWeekdayClockBlock(userText)) return null;
  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;

  const times = extractEventTimeRangeFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess =
    typeof parsed.title === 'string'
      ? parsed.title
      : tasks?.[0]?.title != null
        ? String(tasks[0]!.title)
        : null;

  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess),
    description:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : typeof parsed.description === 'string'
          ? parsed.description
          : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : 60,
    allDay: false,
    eventType: inferEventTypeForRecurringBlock(userText),
    repeat: { frequency: 'weekly', interval: 1, daysOfWeek: days },
  };
}

/**
 * LLMs sometimes return study_plan for "soccer every Wednesday" — rewrite as a single weekly calendar event.
 */
function looksLikeWeeklyMeetingOrStandup(userText: string): boolean {
  const t = userText.toLowerCase();
  if (extractWeekdayIndicesFromUserText(userText).length === 0) return false;
  const weeklyOrNamedDay =
    /\bweekly\b|\bevery\b|\beach\b/i.test(t) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i.test(
      t
    );
  if (!weeklyOrNamedDay) return false;
  const meetingish =
    /\b(standup|stand-up|stand up|sync|meeting|scrum|all-?hands|townhall|1:1|one[\s-]on[\s-]one|check-?in|retro(spective)?)\b/.test(
      t
    ) || /\bteam\b.*\b(stand|sync|meet)\b/i.test(t);
  if (!meetingish) return false;
  if (/\b(past papers?|mock exams?|exam prep|revision every|study every|homework every)\b/i.test(t)) return false;
  return true;
}

/**
 * Groq often returns task/multi_step or study_plan for "Team standup Mon 9am weekly" — must be one calendar event.
 */
export function fixMisclassifiedWeeklyMeetingAsEvent(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  if (parsed.kind === 'event') return null;
  if (!looksLikeWeeklyMeetingOrStandup(userText)) return null;
  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;

  const times = extractEventTimeRangeFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess =
    typeof parsed.title === 'string'
      ? parsed.title
      : tasks?.[0]?.title != null
        ? String(tasks[0]!.title)
        : null;

  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess),
    description: typeof parsed.summary === 'string' ? parsed.summary : typeof parsed.description === 'string' ? parsed.description : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : 30,
    allDay: false,
    eventType: 'meeting',
    repeat: { frequency: 'weekly', interval: 1, daysOfWeek: days },
  };
}

/**
 * Recurring **timetable slot** (class / lesson / lab on a weekday) without explicit clock times.
 * `looksLikeRecurringWeekdayClockBlock` only fires when start/end times exist — this catches
 * "math class every Wednesday" before the model returns task+multi_step or study_plan+7 fake steps.
 */
export function looksLikeRecurringWeeklyClassSlot(userText: string): boolean {
  const raw = userText.trim();
  if (!raw) return false;
  const t = raw.toLowerCase();

  if (looksLikeRecurringWeekdayClockBlock(raw)) return false;

  if (
    /\b(past papers?|mock exams?|practice papers?|timed papers?|essay|dissertation|coursework|assignment\s+due|due\s+(mon|tue|wed|thu|fri|sat|sun|next))\b/i.test(
      t
    )
  ) {
    return false;
  }
  if (/\b(study|revise|revision|prep|practice)\s+\w+\s+every\b/i.test(t)) return false;
  if (/\bhomework\b|\bassignments?\s+every\b/i.test(t)) return false;
  if (/\b(every\s+day|each\s+day|daily)\b/.test(t) && !/\b(class|lesson|lecture|lab|period)\b/.test(t)) {
    return false;
  }

  const days = extractWeekdayIndicesFromUserText(raw);
  if (days.length === 0) return false;

  const weeklyish =
    userAskedForWeeklyRecurrence(raw) ||
    /\b(every|each)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      t
    ) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b/i.test(t) ||
    /\bweekly\b|\brecurring\b/i.test(t);

  if (!weeklyish) return false;

  const subjectCue =
    /\b(bio|biology|chem|chemistry|physics|math|maths|algebra|geometry|calculus|statistics|stats|english|lit|literature|history|geography|economics|econ|psychology|psych|spanish|french|german|latin|mandarin|cs|comp(?:uter)?\s*sci|computer science|drama|music|art|pe|phys ed|design|technology)\b/i.test(
      t
    );

  const classSlot =
    /\b(class|lesson|lecture|lab|labs|seminar|period|tutorial|workshop|timetable)\b/.test(t) ||
    (/\b(have|got|attend)\b/i.test(t) && subjectCue && !/\b(have|got)\s+to\s+(study|revise|finish|complete|write)\b/i.test(t)) ||
    (subjectCue &&
      /\b(every|each|weekly|alternate|every\s+other|every\s+second|2nd)\b/i.test(t) &&
      !/\b(study|revise|revision|homework|assignment|essay|paper|practice\s+paper)\b/i.test(t));

  if (!classSlot) return false;

  return true;
}

/**
 * Coerce task / study_plan → weekly calendar **event** for recurring class-style phrasing (often no HH:mm in text).
 */
export function fixMisclassifiedRecurringWeeklyClassSlotAsEvent(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  if (parsed.kind === 'event') return null;
  const k = String(parsed.kind || '');
  if (k !== 'task' && k !== 'study_plan') return null;
  if (!looksLikeRecurringWeeklyClassSlot(userText)) return null;

  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;

  const times = extractEventTimeRangeFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess =
    typeof parsed.title === 'string'
      ? parsed.title
      : tasks?.[0]?.title != null
        ? String(tasks[0]!.title)
        : null;

  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess),
    description:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : typeof parsed.description === 'string'
          ? parsed.description
          : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : 60,
    allDay: false,
    eventType: inferEventTypeForRecurringBlock(userText),
    repeat: { frequency: 'weekly', interval: inferWeeklyRepeatIntervalFromUserText(userText), daysOfWeek: days },
  };
}

export function fixMisclassifiedRecurringActivityPlan(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  if (parsed.kind !== 'study_plan') return null;
  if (!looksLikeWeeklyRecurringActivity(userText)) return null;
  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;

  const times = extractEventTimeRangeFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess = tasks?.[0]?.title;

  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess != null ? String(titleGuess) : null),
    description: typeof parsed.summary === 'string' ? parsed.summary : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : 60,
    allDay: false,
    eventType: 'event',
    repeat: { frequency: 'weekly', interval: inferWeeklyRepeatIntervalFromUserText(userText), daysOfWeek: days },
  };
}

/**
 * "every second Sunday update blog" — recurring on a named weekday with interval 2/3, but **not** a class/sports slot.
 * The class-slot heuristic only fires when "class" / subject+every pattern matches; this catches chores, admin, content cadences.
 */
export function fixMisclassifiedRecurringNthWeekdaySlotAsEvent(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  if (parsed.kind !== 'task' && parsed.kind !== 'study_plan') return null;
  if (!hasEveryNthWeekdayRecurrencePattern(userText)) return null;
  if (looksLikeTimedExamStyleSitting(userText)) return null;
  if (looksLikeRecurringWeeklyClassSlot(userText)) return null;
  if (looksLikeWeeklyRecurringActivity(userText)) return null;

  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;

  const times = extractEventTimeRangeFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess =
    typeof parsed.title === 'string'
      ? parsed.title
      : tasks?.[0]?.title != null
        ? String(tasks[0]!.title)
        : null;

  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');
  const dur = extractDurationMinutesFromUserText(userText);

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess),
    description:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : typeof parsed.description === 'string'
          ? parsed.description
          : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : Math.max(15, Math.min(8 * 60, dur ?? 45)),
    allDay: false,
    eventType: inferEventTypeForRecurringBlock(userText),
    repeat: { frequency: 'weekly', interval: inferWeeklyRepeatIntervalFromUserText(userText), daysOfWeek: days },
  };
}

/**
 * "alternate mondays bio prep 1 hour" should usually be a recurring calendar slot,
 * not a study_plan/task, unless the user clearly frames it as deadline-driven prep work.
 */
export function fixMisclassifiedAlternatingWeekdayPlanAsEvent(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  const kind = String(parsed.kind || '');
  if (kind !== 'task' && kind !== 'study_plan') return null;
  if (!hasAlternatingNamedWeekdayPattern(userText)) return null;
  const t = normalizeSchedulingUserText(userText).toLowerCase();
  if (/\b(due|by|before|until\s+(the\s+)?exam|deadline|submit|assignment|essay|coursework|homework)\b/i.test(t)) {
    return null;
  }

  const days = sanitizeWeeklyRepeatDaysFromUserText(userText, []);
  if (days.length === 0) return null;
  const times = extractEventTimeRangeFromUserText(userText);
  const duration = extractDurationMinutesFromUserText(userText);
  const tasks = parsed.tasks as Array<{ title?: string }> | undefined;
  const titleGuess =
    typeof parsed.title === 'string'
      ? parsed.title
      : tasks?.[0]?.title != null
        ? String(tasks[0]!.title)
        : null;
  const y = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  const da = String(new Date().getDate()).padStart(2, '0');

  return {
    kind: 'event',
    title: resolveTitleFromUserText(userText, titleGuess),
    description:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : typeof parsed.description === 'string'
          ? parsed.description
          : null,
    startDate: `${y}-${mo}-${da}`,
    startTime: times?.startHHMM ?? null,
    endTime: times?.endHHMM ?? null,
    durationMinutes: times ? null : Math.max(15, Math.min(8 * 60, Math.round(duration ?? 60))),
    allDay: false,
    eventType: inferEventTypeForRecurringBlock(userText),
    repeat: { frequency: 'weekly', interval: 2, daysOfWeek: days },
  };
}

export function extractDurationMinutesFromUserText(text: string): number | null {
  const t = String(text || '').toLowerCase();
  const hMatch = t.match(/\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  if (hMatch) {
    const h = parseFloat(hMatch[1]!);
    if (Number.isFinite(h) && h > 0) return Math.round(h * 60);
  }
  const mMatch = t.match(/\b(\d+)\s*(min|mins|minute|minutes)\b/);
  if (mMatch) {
    const m = parseInt(mMatch[1]!, 10);
    if (Number.isFinite(m) && m > 0) return m;
  }
  return null;
}

/** Model often returns exactly "Untitled Task" / "Untitled Event". */
const UNTITLED_MODEL = /^untitled(\s+(task|event))?$/i;

/**
 * When the model omits sessionStyle, infer single focused sitting vs multi-step work.
 * (Used by the unified AI route `app/api/gemini/route.ts` — Groq or Gemini per env — and terminal QA.)
 */
/** User explicitly asked for a repeating calendar pattern (not just naming one weekday once). */
export function userAskedForWeeklyRecurrence(text: string): boolean {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  if (/\bweekly\b|\bevery\s+week\b|\bonce\s+a\s+week\b/.test(t)) return true;
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b/.test(t)) return true;
  if (/\b(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/.test(t)) return true;
  if (/\beach\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/.test(t)) return true;
  if (/\beach\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t)) return true;
  /** "every tuesday", "every thursday" — full names (short `tues` cannot match inside "tuesday"). */
  if (/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t)) return true;
  if (
    /\bevery\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|day|weekday|morning|afternoon|evening|night)\b/.test(t)
  )
    return true;
  if (/\bevery\s+(other\s+)?day\b/.test(t)) return true;
  if (/\balternate\s+days?\b/.test(t)) return true;
  if (
    /\b(every\s+other|alternate)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(
      t
    )
  )
    return true;
  if (
    /\bevery\s+(second|2nd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(
      t
    )
  )
    return true;
  if (
    /\b(second|2nd|third|3rd|fourth|4th)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      t
    )
  )
    return true;
  return false;
}

/** "alternate mondays", "every other tuesday", "every second sunday" -> every N weeks. */
function inferWeeklyRepeatIntervalFromUserText(text: string): number {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  if (
    /\b(every\s+third|every\s+3rd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(
      t
    )
  ) {
    return 3;
  }
  if (
    /\b(every\s+other|alternate|every\s+second|every\s+2nd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(
      t
    )
  ) {
    return 2;
  }
  if (
    /\b(second|2nd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      t
    )
  ) {
    return 2;
  }
  if (
    /\b(third|3rd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      t
    )
  ) {
    return 3;
  }
  return 1;
}

function hasAlternatingNamedWeekdayPattern(text: string): boolean {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  return /\b(every\s+other|alternate)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(
    t
  );
}

/**
 * Models often invent `repeat.weekly` for a one-off "Math past paper". Strip unless the user asked to repeat.
 */
export function stripSpuriousEventWeeklyRepeat(text: string, parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.kind !== 'event') return parsed;
  const rep = parsed.repeat as { frequency?: string; daysOfWeek?: number[] } | null | undefined;
  if (!rep?.daysOfWeek?.length) return parsed;
  if (userAskedForWeeklyRecurrence(text)) return parsed;
  return { ...parsed, repeat: null };
}

/**
 * If the model returned **event** but omitted `repeat` or used wrong `daysOfWeek`, rebuild from the user’s
 * weekday tokens (after normalization). Keeps one-off events when there’s only a single weekday and no weekly cue.
 */
export function ensureEventWeeklyRepeatFromUserText(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> {
  if (String(parsed.kind) !== 'event') return parsed;

  const fromUser = extractWeekdayIndicesFromUserText(userText);
  const rep = parsed.repeat as { frequency?: string; interval?: number; daysOfWeek?: number[] } | null | undefined;
  const modelDays = Array.isArray(rep?.daysOfWeek) ? rep.daysOfWeek : [];

  const wantsWeekly =
    userAskedForWeeklyRecurrence(userText) ||
    fromUser.length >= 2 ||
    modelDays.length > 0 ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b/i.test(userText);

  if (!wantsWeekly && fromUser.length <= 1 && modelDays.length === 0) {
    return parsed;
  }

  const daysOfWeek = sanitizeWeeklyRepeatDaysFromUserText(userText, modelDays);

  if (daysOfWeek.length === 0) return parsed;

  return {
    ...parsed,
    repeat: {
      frequency: 'weekly',
      interval: inferWeeklyRepeatIntervalFromUserText(userText),
      daysOfWeek,
    },
  };
}

/**
 * Short "past paper" with no date in text → default due **tomorrow** (local) so packing stays near-term.
 */
export function inferTomorrowForBarePastPaperIntent(text: string, today?: Date): Date | null {
  const raw = text.trim();
  if (raw.length > 140) return null;
  const tl = raw.toLowerCase();
  const looksPastPaper =
    /\b(past papers?|practice papers?|question papers?|timed papers?|mock\s+exams?|mock\s+papers?)\b/i.test(tl) ||
    /\bmock\b.*\b(paper|exam)\b/i.test(tl);
  if (!looksPastPaper) return null;
  if (/\b(every|daily|weekly|alternate|until\s+exam|until\s+the)\b/i.test(tl)) return null;
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/.test(tl)) return null;
  if (/\bnext\s+\w+day\b/.test(tl)) return null;
  if (/\b\d{1,2}\s*(am|pm)\b/.test(tl)) return null;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(tl)) return null;
  const base = today ? new Date(today) : new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + 1);
  return base;
}

/**
 * "after 5pm", "evening" → earliest slot minute-of-day for the packer.
 */
export function extractSlotEarliestMinutesFromUserText(text: string): number | null {
  const t = text.toLowerCase();
  const m1 = t.match(/\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(pm|am)\b/);
  if (m1) {
    let h = parseInt(m1[1]!, 10);
    const mn = m1[2] ? parseInt(m1[2], 10) : 0;
    const ap = m1[3]!.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!Number.isFinite(h) || h > 23) return null;
    return h * 60 + (Number.isFinite(mn) ? mn : 0);
  }
  const m2 = t.match(/\bstarting\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)\b/);
  if (m2) {
    let h = parseInt(m2[1]!, 10);
    const mn = m2[2] ? parseInt(m2[2], 10) : 0;
    const ap = m2[3]!.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + (Number.isFinite(mn) ? mn : 0);
  }
  if (/\bnoon\b/.test(t)) return 12 * 60;
  if (/\b(evenings?|after\s+school|after\s+work)\b/.test(t)) return 17 * 60;
  return null;
}

export function inferTaskSessionStyle(text: string, parsed: Record<string, unknown>): 'single_block' | 'multi_step' {
  const raw = text.trim();
  const tl = raw.toLowerCase();
  const repeatedSessionCue = (() => {
    const countMatch =
      /\b(\d{1,3})\s*x\b/i.test(tl) ||
      /\b(\d{1,3})\s+times?\b/i.test(tl) ||
      /\b(\d{1,3})\s+(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?)\b/i.test(tl) ||
      /\bhave\s+\d{1,3}\b/i.test(tl);
    const perItem =
      /\b(each|every|per)\b/i.test(tl) ||
      /\bone\s+by\s+one\b/i.test(tl) ||
      /\b(one\s+go|one\s+sitting|single\s+sitting)\b/i.test(tl);
    return countMatch && perItem;
  })();
  /** Last line of defense if server heuristics lag; still wrong as a task but avoids 7 fake chunk steps. */
  if (looksLikeRecurringWeeklyClassSlot(raw)) return 'single_block';

  const shortPastPaper =
    raw.length < 220 &&
    /\b(past papers?|practice papers?|question papers?|timed papers?|mock\s+exams?|mock\s+papers?)\b/i.test(tl) &&
    !/\b(essay|project|dissertation|coursework|every\s+day|weekly|each\s+day)\b/i.test(tl);
  if (repeatedSessionCue) return 'multi_step';
  if (shortPastPaper) return 'single_block';

  const s = parsed.sessionStyle;
  if (s === 'single_block' || s === 'multi_step') return s;
  const blob = `${text} ${String(parsed.title || '')} ${String(parsed.description || '')}`.toLowerCase();
  const hasDuration =
    /\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i.test(blob) ||
    /\b(\d+)\s*(min|mins|minute|minutes)\b/i.test(blob);
  const blockCue =
    /\b(papers?|past papers?|mock|timed|exam conditions|full paper|practice papers?|mock exams?|question papers?|qp|ms|section [ab])\b/i.test(
      blob
    );
  const multiCue =
    /\b(essay|dissertation|project|coursework|research paper|revise everything|all units|all topics|break into|outline|draft)\b/i.test(
      blob
    );
  if (hasDuration && blockCue && !multiCue) return 'single_block';
  return 'multi_step';
}

/**
 * Timed **exam-style sitting** (mock paper, past paper, “do not break into steps”) — packs as a **task** block,
 * not a calendar “appointment”, even when clock times are present.
 */
export function looksLikeTimedExamStyleSitting(userText: string): boolean {
  const t = normalizeSchedulingUserText(userText).toLowerCase();
  if (
    /\b(mock\s+exam|mock\s+paper|past\s+papers?|practice\s+papers?|question\s+papers?|timed\s+papers?|exam\s+conditions)\b/i.test(
      t
    )
  )
    return true;
  if (/\b(full\s+paper|in\s+one\s+sitting|one\s+go|single\s+block|do\s+not\s+break)\b/i.test(t)) return true;
  return false;
}

/**
 * Comma-separated clauses like "one day Physics, one day English" describe **one** rotating schedule
 * (different themes on consecutive days), not two independent calendar asks.
 */
export function hasTwoSubjectOneDayRotationPattern(text: string): boolean {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return false;
  /** "physics one day then english next day", "X then Y the next day" — no commas required. */
  if (
    /\b[a-z][\w\s]{0,40}?\s+one\s+day\s+then\s+[a-z][\w\s]{0,40}?\s+next\s+day\b/i.test(raw)
  )
    return true;
  if (/\b[a-z][\w\s]{0,40}?\s+then\s+[a-z][\w\s]{0,40}?\s+(?:the\s+)?next\s+day\b/i.test(raw)) return true;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let oneDayClauses = 0;
  for (const p of parts) {
    if (/^\s*one\s+day\s+\S+/i.test(p)) oneDayClauses++;
  }
  return oneDayClauses >= 2;
}

/**
 * One **combined** study pattern (do not split on "and" or treat as a batch).
 * Covers "physics one day then English next day…" and "physics and English alternating till…".
 */
export function isSinglePlanAlternatingSubjectsCue(text: string): boolean {
  if (hasTwoSubjectOneDayRotationPattern(text)) return true;
  const raw = normalizeSchedulingUserText(text);
  if (!raw) return false;
  return /\b\w+(?:\s+\w+){0,2}\s+and\s+\w+(?:\s+\w+){0,2}\s+(alt(?:ernating|ernate)|rotat\w*|cycling)\b/i.test(
    raw
  );
}

/** "every second sunday", "every 2nd Monday" — recurring, not the same as "every other day". */
export function hasEveryNthWeekdayRecurrencePattern(text: string): boolean {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  return /\b(every\s+second|every\s+2nd|every\s+third|every\s+3rd)\s+(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i.test(
    t
  );
}

/**
 * Natural language describes **flexible work** the packer should place — not a fixed “I’m busy then” hold.
 */
export function userTextIndicatesFlexibleTask(text: string): boolean {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return false;
  const t = raw.toLowerCase();

  if (looksLikeTimedExamStyleSitting(raw)) return true;

  if (hasTwoSubjectOneDayRotationPattern(raw)) return true;
  if (
    /\b(each|every)\s+day\b/i.test(t) &&
    /\b(till|until)\b/i.test(t) &&
    extractDurationMinutesFromUserText(raw) != null
  )
    return true;

  if (/\b(study\s+plan|spread\s+over|sessions?\s+to\s+pack|chunk(\s+into)?|break\s+into\s+steps)\b/i.test(t)) return true;
  if (/\b(essay|dissertation|coursework|lab\s+report)\b/i.test(t) && /\b(due|by|before|hand\s*in|submit)\b/i.test(t))
    return true;
  if (
    /\b(homework|assignment|problem\s+set|pset|worksheet)\b/i.test(t) &&
    /\b(due|by|before|for\s+next|hand\s*in)\b/i.test(t)
  )
    return true;
  if (
    /\b(revise|revision|prep)\b/i.test(t) &&
    /\b(every\s+day|daily|alternate|each\s+day|every\s*weekday|weekdays|until\s+(the\s+)?exam)\b/i.test(t) &&
    !hasAlternatingNamedWeekdayPattern(raw)
  )
    return true;
  if (/\b(read(ing)?|finish)\b.*\bchapter\b/i.test(t)) return true;
  if (/\b(outline|draft|edit|research)\b/i.test(t) && /\b(essay|project|report|paper)\b/i.test(t) && !/\b(call|meeting)\b/i.test(t))
    return true;
  if (/\b(\d{1,2}\s+)?past\s+papers?\b/i.test(t) && /\b(by|before|each|per|in\s+one)\b/i.test(t)) return true;

  return false;
}

/**
 * Natural language describes a **calendar hold** — fixed or recurring clock time, appointment, class slot, trip, etc.
 */
export function userTextIndicatesCalendarEvent(text: string): boolean {
  const raw = normalizeSchedulingUserText(text).trim();
  if (!raw) return false;
  const t = raw.toLowerCase();

  if (looksLikeTimedExamStyleSitting(raw)) {
    if (
      looksLikeWeeklyMeetingOrStandup(raw) ||
      looksLikeRecurringWeeklyClassSlot(raw) ||
      looksLikeRecurringWeekdayClockBlock(raw)
    ) {
      /* recurring class-like slot */
    } else {
      return false;
    }
  }

  if (looksLikeRecurringWeekdayClockBlock(raw)) return true;
  if (looksLikeWeeklyMeetingOrStandup(raw)) return true;
  if (looksLikeRecurringWeeklyClassSlot(raw)) return true;
  if (looksLikeWeeklyRecurringActivity(raw)) return true;
  if (hasAlternatingNamedWeekdayPattern(raw)) {
    // Treat alternating weekday cadence as a recurring calendar slot by default.
    return true;
  }
  if (hasEveryNthWeekdayRecurrencePattern(raw) && extractWeekdayIndicesFromUserText(raw).length > 0) {
    return true;
  }

  if (/\ball[\s-]day\b|\bwhole\s+day\b|\bblock\s+(the\s+)?(whole\s+)?day\b|\bfull\s+day(\s+off)?\b/i.test(t)) return true;
  if (/\b(day\s+off|pto|public\s+holiday)\b/i.test(t)) return true;
  if (/\b(trip|travel|flight|vacation|away)\b/i.test(t) && !/\b(write|essay|draft|due)\b/i.test(t)) return true;

  const range = extractEventTimeRangeFromUserText(raw);
  if (range && !looksLikeTimedExamStyleSitting(raw)) {
    return true;
  }

  if (/\b(at|from)\s+\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(t)) return true;
  if (
    /\b\d{1,2}\s*(:\d{2})?\s*(am|pm)\b/i.test(t) &&
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight)\b/i.test(t)
  )
    return true;

  if (
    /\b(appointment|dentist|doctor|physio|therapy|vet|haircut|interview)\b/i.test(t) ||
    /\b(team\s+)?(sync|standup|stand-up|scrum)\b/i.test(t) ||
    /\b(meeting|townhall|all-?hands|1:1|one[\s-]on[\s-]one)\b/i.test(t) ||
    /\b(shift|on\s+call|coverage)\b/i.test(t)
  ) {
    return true;
  }

  if (/\b(soccer|football|basketball|volleyball|tennis|swim(?:ming)?|rehearsal|piano|violin|lesson)\b/i.test(t)) {
    if (/\bpast\s+paper|practice\s+paper|question\s+paper|mock\s+exam\b/i.test(t)) return false;
    if (extractWeekdayIndicesFromUserText(raw).length > 0 || /\b(at|from)\s+\d|\d\s*(am|pm)\b/i.test(t)) return true;
  }

  if (
    /\b(class|lecture|lab|period|seminar|workshop|timetable)\b/i.test(t) &&
    (userAskedForWeeklyRecurrence(raw) || extractEventTimeRangeFromUserText(raw))
  )
    return true;

  return false;
}

/**
 * When the model picks **task** vs **event** wrong, nudge from the user’s actual words (after other fix-ups).
 */
export function reconcileTaskVsEventKindFromUserText(
  userText: string,
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const kind = String(parsed.kind || '');
  if (kind === 'study_plan') return parsed;
  const norm = normalizeSchedulingUserText(userText).toLowerCase();
  const explicitEvent =
    /\b(this|it)\s+is\s+an?\s+event\b/.test(norm) ||
    /\bas\s+an?\s+event\b/.test(norm) ||
    /\btreat\s+(this|it)\s+as\s+an?\s+event\b/.test(norm);
  const explicitTask =
    /\b(this|it)\s+is\s+a\s+task\b/.test(norm) ||
    /\bas\s+a\s+task\b/.test(norm) ||
    /\btreat\s+(this|it)\s+as\s+a\s+task\b/.test(norm);
  if (explicitEvent && !explicitTask) return { ...parsed, kind: 'event' };
  if (explicitTask && !explicitEvent) return { ...parsed, kind: 'task' };

  /** Mock / past / practice papers with clock times are **tasks**, not calendar appointments. */
  if (kind === 'event' && looksLikeTimedExamStyleSitting(userText)) {
    if (
      !looksLikeWeeklyMeetingOrStandup(userText) &&
      !looksLikeRecurringWeeklyClassSlot(userText) &&
      !looksLikeRecurringWeekdayClockBlock(userText)
    ) {
      const next: Record<string, unknown> = { ...parsed, kind: 'task' };
      if (next.dueDate == null && next.startDate != null) next.dueDate = next.startDate;
      if (next.sessionStyle == null) next.sessionStyle = inferTaskSessionStyle(userText, next);
      if (next.estimatedHours == null && next.sessionStyle !== 'single_block') next.estimatedHours = 2;
      return next;
    }
  }

  const cal = userTextIndicatesCalendarEvent(userText);
  const flex = userTextIndicatesFlexibleTask(userText);

  if (kind === 'task' && (hasAlternatingNamedWeekdayPattern(userText) || hasEveryNthWeekdayRecurrencePattern(userText))) {
    return { ...parsed, kind: 'event' };
  }

  if (kind === 'task' && cal && !flex) {
    return { ...parsed, kind: 'event' };
  }

  if (kind === 'event' && flex && !cal) {
    const next: Record<string, unknown> = { ...parsed, kind: 'task' };
    if (next.dueDate == null && next.startDate != null) next.dueDate = next.startDate;
    if (next.sessionStyle == null) next.sessionStyle = inferTaskSessionStyle(userText, next);
    if (next.estimatedHours == null && next.sessionStyle !== 'single_block') next.estimatedHours = 2;
    return next;
  }

  if (kind === 'task' && cal && flex) {
    if (extractEventTimeRangeFromUserText(userText) || /\ball[\s-]day\b/i.test(userText.toLowerCase())) {
      return { ...parsed, kind: 'event' };
    }
  }

  if (kind === 'event' && cal && flex) {
    if (
      looksLikeTimedExamStyleSitting(userText) ||
      (/\b(essay|homework|assignment|lab\s+report|due\s+next|past\s+paper|practice\s+paper)\b/i.test(
        userText.toLowerCase()
      ) &&
        !extractEventTimeRangeFromUserText(userText))
    ) {
      const next: Record<string, unknown> = { ...parsed, kind: 'task' };
      if (next.dueDate == null && next.startDate != null) next.dueDate = next.startDate;
      if (next.sessionStyle == null) next.sessionStyle = inferTaskSessionStyle(userText, next);
      return next;
    }
  }

  return parsed;
}

/**
 * If the user gave explicit clock times in natural language, return that block on `dueDay` (local).
 * Duration uses the longer of (end−start from text) and `durationMinutes` so "at 5pm" + "2 hour paper" → 5–7pm.
 * Returns null when no usable clock range was found (caller should use the normal packer).
 */
export function buildFixedWallClockSlotForDueDay(
  taskText: string,
  dueDay: Date,
  durationMinutes: number
): { scheduledStart: Date; scheduledEnd: Date } | null {
  const range = extractEventTimeRangeFromUserText(taskText);
  if (!range) return null;

  const [sh, sm] = range.startHHMM.split(':').map((v) => parseInt(v, 10));
  const [eh, em] = range.endHHMM.split(':').map((v) => parseInt(v, 10));
  if (!Number.isFinite(sh) || !Number.isFinite(sm)) return null;

  const day0 = new Date(dueDay);
  day0.setHours(0, 0, 0, 0);

  const start = new Date(day0);
  start.setHours(sh, sm, 0, 0);

  let spanMin = 0;
  if (Number.isFinite(eh) && Number.isFinite(em)) {
    spanMin = eh * 60 + em - (sh * 60 + sm);
  }
  const d = Math.max(10, Math.min(8 * 60, Math.round(Number(durationMinutes)) || 60));
  const durMin = spanMin >= 30 ? Math.max(spanMin, d) : d;

  const end = new Date(start.getTime() + durMin * 60_000);
  if (end.getTime() <= start.getTime()) return null;
  return { scheduledStart: start, scheduledEnd: end };
}

function heuristicSchedulingSubjectTitle(userText: string): string | null {
  const line = String(userText || '')
    .trim()
    .split(/\n/)[0]!
    .trim();
  if (!line) return null;
  let s = normalizeSchedulingUserText(line);
  s = s.replace(/^(i|i'?ve|we|we'?ve)\s+(have|has|had|got|need|needs)\s+(a\s+|an\s+|the\s+)?/i, '').trim();
  s = s.replace(/^(i|we)\s+am\s+|\b(i|we)\'?m\s+having\s+(a\s+|an\s+|the\s+)?/i, '').trim();
  s = s.replace(/^(don'?t forget to|remember to|please|kindly)\s+(to\s+)?/i, '').trim();
  s = s.replace(/\s*\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/i, '').trim();
  s = s.replace(
    /\s*\b(next|this|coming)\s+(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b\s*$/i,
    ''
  ).trim();
  s = s.replace(/\s*\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/i, '').trim();
  s = s.replace(/\s*\bon\s+(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b\s*$/i, '').trim();
  s = s.replace(/\s*\b(tomorrow|today|tonight)\s*$/i, '').trim();
  s = s.replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '').trim();
  s = s.replace(/\s+@\s+\d{1,2}\b/gi, '').trim();
  const parts = s.split(/\s+every\s+/i);
  const head = parts[0]?.trim() ?? s;
  const out = head.replace(/\s+/g, ' ').trim();
  if (out.length < 1 || out.length > 100) return null;
  const cap = out.charAt(0).toUpperCase() + out.slice(1);
  return cap.slice(0, 100);
}

function modelSchedulingTitleLooksBroken(title: string): boolean {
  const t = title.toLowerCase();
  if (/\b(tusday|tusdays|thruday|thrudays|thurday|thurdays|thrusday|thrusdays)\b/.test(t)) return true;
  if (/\bmatch\s+class\b/.test(t) && /\bevery\b/.test(t)) return true;
  if ((t.match(/\bevery\b/gi) ?? []).length >= 2) return true;
  if (/^i\s+(have|had|ve|'?ve)\s+/i.test(t) || /^we\s+(have|had)\s+/i.test(t)) return true;
  if (/\bnext\s+(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t)) {
    return true;
  }
  return false;
}

export function resolveTitleFromUserText(
  userText: string,
  modelTitle: string | undefined | null
): string {
  const raw = String(modelTitle || '').trim();
  const hint = heuristicSchedulingSubjectTitle(userText);
  const line = String(userText || '')
    .trim()
    .split(/\n/)[0]!
    .trim()
    .slice(0, 120);

  const rawL = raw.toLowerCase().replace(/\s+/g, ' ');
  const lineL = line.toLowerCase().replace(/\s+/g, ' ');
  const modelEchoesUserSentence =
    raw.length > 12 &&
    lineL.length > 12 &&
    (rawL === lineL || (lineL.startsWith(rawL.slice(0, Math.min(24, raw.length))) && rawL.length >= lineL.length * 0.65));

  if (
    hint &&
    (!raw || UNTITLED_MODEL.test(raw) || modelSchedulingTitleLooksBroken(raw) || modelEchoesUserSentence)
  ) {
    return hint;
  }
  if (raw && !UNTITLED_MODEL.test(raw)) return raw.slice(0, 200);
  return line || 'Study session';
}
