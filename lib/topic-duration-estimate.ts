/** Keys used to match AI duration rows back to syllabus lines. */
export function topicDurationLookupKeys(topic: string): string[] {
  const t = String(topic || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!t) return [];
  const stripped = t
    .replace(/^(study|revision)\s*:\s*/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped && stripped !== t ? [t, stripped] : [t];
}

function gradeDifficultyOffset(gradeLevel: string): number {
  const g = String(gradeLevel || '').toLowerCase().trim();
  if (!g) return 0;
  if (/^(6|7|8|9)$/.test(g)) {
    const n = parseInt(g, 10);
    if (n <= 7) return -8;
    return -3;
  }
  if (g === '10' || /^year\s*10$/.test(g)) return 2;
  if (/(myp\s*[1-2]|middle school|grade\s*[6-7])/.test(g)) return -8;
  if (/(myp\s*[3-4]|grade\s*[8-9])/.test(g)) return -3;
  if (/(myp\s*5|grade\s*10|igcse)/.test(g)) return 2;
  if (/(ib dp|a-?level|ap|grade\s*11|grade\s*12|hl|university|college)/.test(g)) return 8;
  return 0;
}

export function estimateMinutesHeuristic(
  topic: string,
  defaultSession: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive' = 'balanced'
): number {
  const d = Number.isFinite(defaultSession) && defaultSession > 0 ? defaultSession : 35;
  const t = String(topic || '').toLowerCase();
  const g = String(gradeLevel || '').toLowerCase();

  let base = d;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words >= 12) base += 12;
  else if (words >= 8) base += 7;
  else if (words <= 3) base -= 4;

  // Complexity signal from topic wording.
  if (/(essay|evaluation|analy(s|z)e|synthesis|investigation|proof|deriv|extended|lab report|case study)/i.test(t)) {
    base += 20;
  } else if (/(solve|equation|kinematics|trig|calculus|stoichiometry|probability|graph|mechanics|forces)/i.test(t)) {
    base += 12;
  } else if (/(definitions?|terms?|flashcards?|vocab|recall|review|summary|outline)/i.test(t)) {
    base -= 8;
  }

  // Grade/program signal.
  base += gradeDifficultyOffset(g);

  // Pace signal.
  if (pace === 'light') base -= 6;
  if (pace === 'intensive') base += 8;

  return Math.min(180, Math.max(20, Math.round(base / 5) * 5));
}

export function learningPassFloorMinutes(
  topic: string,
  value: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive' = 'balanced'
): number {
  const t = String(topic || '').toLowerCase();
  const g = String(gradeLevel || '').toLowerCase();
  const v = Number(value);
  let floor = 28;
  if (/(essay|proof|investigation|lab|deriv|extended|analysis)/i.test(t)) floor = 45;
  else if (/(flashcards?|vocab|recall|quick review|summary)/i.test(t)) floor = 20;
  floor += Math.round(gradeDifficultyOffset(g) * 0.6);
  if (pace === 'light') floor -= 3;
  if (pace === 'intensive') floor += 3;
  if (!Number.isFinite(v)) return Math.max(15, floor);
  return Math.min(300, Math.max(Math.max(15, floor), Math.round(v)));
}

export function mergeDurationEstimate(
  topic: string,
  aiMins: number,
  heuristic: number,
  gradeLevel: string,
  pace: 'light' | 'balanced' | 'intensive' = 'balanced'
): number {
  const a = Number(aiMins);
  const h = Number(heuristic);
  const ai = Number.isFinite(a) && a > 0 ? a : NaN;
  const hh = Number.isFinite(h) && h > 0 ? h : 35;
  const blended = Number.isFinite(ai) ? ai * 0.4 + hh * 0.6 : hh;
  const floor = learningPassFloorMinutes(topic, hh, gradeLevel, pace);
  return Math.min(300, Math.max(floor, Math.round(blended / 5) * 5));
}
