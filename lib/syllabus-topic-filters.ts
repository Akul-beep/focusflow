/** Trim, drop empties, light de-dupe for syllabus/topic lines. */
export function filterTopicLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const UNIT_LIKE_RE = /^(unit|chapter|module|section|part)\s*[\w.\-]+$/i;

export function isStructuralHeadingOnly(topic: string): boolean {
  const t = String(topic || '').trim();
  if (!t) return true;
  if (t.length <= 40 && UNIT_LIKE_RE.test(t)) return true;
  if (/^unit\s*[:：]?\s*\d+/i.test(t) && t.length < 28) return true;
  return false;
}

export function shouldSkipAsSchedulableTopicTitle(topic: string): boolean {
  return isStructuralHeadingOnly(topic);
}

export function isBareCurriculumStrandBanner(topic: string): boolean {
  const t = String(topic || '').trim().toLowerCase();
  if (!t) return true;
  if (t.startsWith('strand:') || t.startsWith('objective:')) return true;
  return false;
}
