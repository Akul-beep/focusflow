/**
 * Format-agnostic syllabus → ordered sections + atomic topics for exam prep.
 * Handles paragraph-style lists (semicolon-separated), unit headings, and line-based syllabi.
 */

import { filterTopicLines, isStructuralHeadingOnly, shouldSkipAsSchedulableTopicTitle } from '@/lib/syllabus-topic-filters';

export type SyllabusTopicRow = {
  sectionTitle: string;
  topic: string;
  order: number;
};

export type SyllabusSection = {
  title: string;
  topics: string[];
};

/** Split before the next major heading (space or "; " so semicolon-lists stay intact). */
const SECTION_HEAD_SPLIT =
  /(?:\s+|;\s*)(?=(?:Unit\s+\d+\s*(?:[–—\-]|:)|Task\s+\d+\s*[–—\-]|Extended\s*\(|Algebra:|Trigonometry:|Geometry:|Statistics:|Calculus:|Probability:|Mechanics:|Organic\s+chemistry:))/gi;

/** Strip leading "SUBJECT NAME:" / "EXTENDED MATH:" banner at blob start or short first line. */
function stripSubjectBanner(text: string, subjectHint?: string): string {
  let t = text.trim();
  t = t.replace(/^(?:subject|course)\s*:\s*[^\n]+\n?/i, '').trim();
  const banner =
    /^(?:EXTENDED\s+)?[A-Z][A-Za-z0-9 &/'’-]{2,48}:\s*/.exec(t)?.[0] ?? '';
  if (banner) {
    const head = banner.replace(/:\s*$/, '').trim();
    if (
      !subjectHint ||
      head.toLowerCase().includes(subjectHint.toLowerCase().slice(0, 5)) ||
      /^extended\b/i.test(head)
    ) {
      t = t.slice(banner.length).trim();
    }
  }
  const firstLine = t.split(/\r?\n/)[0]?.trim() ?? '';
  if (/^[\w\s/&'’-]+:\s*\S/.test(firstLine) && firstLine.length < 100) {
    const head = firstLine.split(':')[0].trim();
    if (!subjectHint || head.toLowerCase().includes(subjectHint.toLowerCase().slice(0, 5))) {
      const rest = t.slice(firstLine.length).trim();
      if (rest.length > 0) t = rest;
    }
  }
  return t;
}

function segmentChunks(raw: string): string[] {
  let t = raw.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines.flatMap((line) => subSegmentLine(line));
  }
  return subSegmentLine(t.replace(/\n/g, ' ').trim());
}

/** Split a single long line into coarse sections using heading markers. */
function subSegmentLine(line: string): string[] {
  if (!line) return [];
  const chunks: string[] = [];
  let last = 0;
  const re = new RegExp(SECTION_HEAD_SPLIT.source, SECTION_HEAD_SPLIT.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) chunks.push(line.slice(last, m.index).trim());
    last = m.index;
  }
  if (last < line.length) chunks.push(line.slice(last).trim());
  return chunks.filter(Boolean);
}

/** Split on `;` not inside () or [] — keeps “(a; b)” chemistry-style parentheticals intact. */
function splitOnSemicolonsOutsideParens(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) {
      const t = cur.trim();
      if (t.length >= 2) parts.push(t);
      cur = '';
      continue;
    }
    cur += c;
  }
  const t = cur.trim();
  if (t.length >= 2) parts.push(t);
  return parts.length ? parts : [s];
}

/** Split on commas not inside () or [] so PDF/paste lists become separate topics. */
function splitOnCommasOutsideParens(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      const t = cur.trim();
      if (t.length >= 2) parts.push(t);
      cur = '';
      continue;
    }
    cur += c;
  }
  const t = cur.trim();
  if (t.length >= 2) parts.push(t);
  return parts.length >= 2 ? parts : [s];
}

function refineClauseIntoTopics(clause: string): string[] {
  const trimmed = clause
    .replace(/^[\s•\-–—\d.)\]]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (trimmed.length < 2) return [];

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0 && colonIdx < 90) {
    const subHead = trimmed.slice(0, colonIdx).trim();
    const subBody = trimmed.slice(colonIdx + 1).trim();
    if (subBody.length > 0 && !trimmed.includes(';')) {
      const pieces = splitOnCommasOutsideParens(subBody);
      if (pieces.length >= 2) {
        return pieces.map((p) => `${subHead}: ${p.trim()}`.replace(/\s+/g, ' ').trim());
      }
    }
  }

  if (!trimmed.includes(';') && trimmed.length > 45 && trimmed.includes(',')) {
    const pieces = splitOnCommasOutsideParens(trimmed);
    if (pieces.length >= 2) return pieces.map((p) => p.replace(/\s+/g, ' ').trim());
  }

  return [trimmed];
}

function splitTopicClauses(body: string): string[] {
  return splitOnSemicolonsOutsideParens(body)
    .flatMap((x) => refineClauseIntoTopics(x))
    .filter((x) => x.length >= 2);
}

function parseChunk(chunk: string, defaultSection: string): { section: string; topics: string[] }[] {
  const colon = chunk.indexOf(':');
  if (colon === -1) {
    const topics = splitTopicClauses(chunk);
    return topics.length ? [{ section: defaultSection, topics }] : [];
  }

  const head = chunk.slice(0, colon).trim();
  const body = chunk.slice(colon + 1).trim();

  const headLooksLikeSection =
    /^unit\s+\d+/i.test(head) ||
    /^extended\b/i.test(head) ||
    /^(algebra|trigonometry|geometry|statistics|calculus|probability|mechanics)\b/i.test(head) ||
    (head.length <= 90 && head.length >= 3);

  if (!headLooksLikeSection || !body) {
    const topics = splitTopicClauses(chunk);
    return topics.length ? [{ section: defaultSection, topics }] : [];
  }

  const topics = splitTopicClauses(body);
  const section = head.length > 120 ? `${head.slice(0, 117)}…` : head;
  return topics.length ? [{ section, topics }] : [];
}

function normalizeTopic(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const topicKey = (s: string) =>
  normalizeTopic(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Heuristic extraction — works for semicolon-heavy paragraphs and mixed formats.
 */
export function extractSyllabusTopicsHeuristic(raw: string, subjectHint?: string): SyllabusTopicRow[] {
  const stripped = stripSubjectBanner(raw, subjectHint);
  const chunks = segmentChunks(stripped);
  const out: SyllabusTopicRow[] = [];
  let order = 1;
  let currentSection = 'General';

  for (const chunk of chunks) {
    const parsed = parseChunk(chunk, currentSection);
    if (parsed.length === 0) continue;
    for (const block of parsed) {
      currentSection = block.section;
      for (const t of block.topics) {
        const topic = normalizeTopic(t);
        if (!topic) continue;
        if (isStructuralHeadingOnly(topic) || shouldSkipAsSchedulableTopicTitle(topic)) continue;
        if (/^(paper|exam code|specification|syllabus code)\b/i.test(topic)) continue;
        if (/^(extended\s+)?math\s*:?\s*$/i.test(topic)) continue;
        if (/^[a-z\s]{3,50}:\s*$/i.test(topic)) continue;
        out.push({ sectionTitle: currentSection, topic, order: order++ });
      }
    }
  }

  return dedupeRows(out);
}

function dedupeRows(rows: SyllabusTopicRow[]): SyllabusTopicRow[] {
  const seen = new Set<string>();
  const next: SyllabusTopicRow[] = [];
  let o = 1;
  for (const r of rows) {
    const k = topicKey(r.topic);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    next.push({ ...r, order: o++ });
  }
  return next;
}

/** Collapse rows into sections (preserves order of first occurrence of each section). */
export function rowsToSections(rows: SyllabusTopicRow[]): SyllabusSection[] {
  const order: string[] = [];
  const byTitle = new Map<string, string[]>();
  for (const r of rows) {
    const t = r.sectionTitle.trim() || 'General';
    if (!byTitle.has(t)) {
      byTitle.set(t, []);
      order.push(t);
    }
    byTitle.get(t)!.push(r.topic);
  }
  return order.map((title) => ({
    title,
    topics: filterTopicLines(byTitle.get(title) || []),
  }));
}

export type AiSyllabusGroup = { title: string; topics: string[] };
export type AiSyllabusSubject = {
  name: string;
  units?: string[];
  groups?: AiSyllabusGroup[];
};

/**
 * Prefer AI structure when present; fill gaps from heuristics. Preserves topic order where possible.
 */
export function mergeHeuristicAndAiStructure(
  heuristicRows: SyllabusTopicRow[],
  ai: AiSyllabusSubject | null,
  subjectName: string
): SyllabusTopicRow[] {
  if (!ai || (!ai.groups?.length && !ai.units?.length)) return heuristicRows;

  const fromAi: SyllabusTopicRow[] = [];
  let order = 1;
  const pushTopics = (sectionTitle: string, topics: string[]) => {
    const clean = filterTopicLines(topics.map((t) => String(t).trim()).filter(Boolean));
    for (const topic of clean) {
      if (isStructuralHeadingOnly(topic) || shouldSkipAsSchedulableTopicTitle(topic)) continue;
      fromAi.push({ sectionTitle: sectionTitle || 'General', topic, order: order++ });
    }
  };

  if (ai.groups && ai.groups.length > 0) {
    for (const g of ai.groups) {
      const title = String(g.title || 'Section').trim() || 'Section';
      const topics = Array.isArray(g.topics) ? g.topics : [];
      pushTopics(title, topics);
    }
  } else if (ai.units && ai.units.length > 0) {
    pushTopics(subjectName.trim() || 'Syllabus', ai.units);
  }

  const aiDeduped = dedupeRows(fromAi);
  if (aiDeduped.length === 0) return heuristicRows;

  const hKeys = new Set(heuristicRows.map((r) => topicKey(r.topic)));
  const merged: SyllabusTopicRow[] = [...aiDeduped];
  let o = merged.length + 1;
  for (const r of heuristicRows) {
    const k = topicKey(r.topic);
    if (hKeys.has(k) && merged.some((m) => topicKey(m.topic) === k)) continue;
    if (merged.some((m) => topicKey(m.topic) === k)) continue;
    merged.push({ ...r, order: o++ });
  }
  merged.sort((a, b) => a.order - b.order);
  return dedupeRows(merged.map((r, i) => ({ ...r, order: i + 1 })));
}
