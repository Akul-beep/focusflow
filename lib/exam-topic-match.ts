/**
 * Map AI / plan labels (e.g. "Study: Kinematics", "Kinematics + vectors") to a canonical syllabus line from the exam.
 */

function stripSessionPrefix(label: string): string {
  return label.replace(/^(study|revision)\s*:\s*/i, '').trim();
}

/** Maps a label to a syllabus line in `canonicalTopics`, or null if no safe match. */
export function resolveExamTopicKey(canonicalTopics: string[], aiLabel: string): string | null {
  if (!canonicalTopics.length) return null;
  const stripped = stripSessionPrefix(aiLabel).trim();
  if (!stripped) return null;
  const sl = stripped.toLowerCase();

  for (const t of canonicalTopics) {
    if (t.toLowerCase() === sl) return t;
  }
  for (const t of canonicalTopics) {
    const tl = t.toLowerCase();
    if (sl.includes(tl) || tl.includes(sl)) return t;
  }

  const scored = canonicalTopics.map((t) => {
    const tl = t.toLowerCase();
    const a = new Set(sl.split(/[^a-z0-9]+/i).filter((x) => x.length > 1));
    const b = new Set(tl.split(/[^a-z0-9]+/i).filter((x) => x.length > 1));
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return { t, inter };
  });
  scored.sort((a, b) => b.inter - a.inter);
  if (scored[0] && scored[0].inter > 0) return scored[0].t;

  return null;
}
