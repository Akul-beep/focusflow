/**
 * Fetches per-topic study minutes from the AI API (estimateTopicDurations),
 * batched for rate limits. Keys match normalizeExamTopicKey for the planner.
 */

import type { SchedulePreferences } from '@/types';
import { estimateMinutesHeuristic } from '@/lib/topic-duration-estimate';
import { examEffectiveGrade, scaleRawMinutesForExamTopic } from '@/lib/exam-prep-time-scale';

export function normalizeExamTopicKey(topic: string): string {
  return String(topic || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    return j.message || j.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

const BATCH_SIZE = 36;

function fallbackMinutes(topic: string, prefs: SchedulePreferences): number {
  const pace = (prefs.studyPace || 'balanced') as 'light' | 'balanced' | 'intensive';
  return estimateMinutesHeuristic(
    topic,
    Math.min(28, prefs.defaultSessionMinutes || 28),
    examEffectiveGrade(prefs),
    pace
  );
}

function applyBatchToMap(
  map: Map<string, number>,
  batch: string[],
  rows: Array<{ topic?: string; estimatedMinutes?: number }> | undefined,
  prefs: SchedulePreferences
): void {
  for (let j = 0; j < batch.length; j++) {
    const topic = batch[j]!;
    const row = Array.isArray(rows) && j < rows.length ? rows[j] : undefined;
    const raw = row?.estimatedMinutes;
    const mins =
      raw != null && Number.isFinite(Number(raw))
        ? Math.max(8, Math.min(28, Math.round(Number(raw) / 5) * 5))
        : scaleRawMinutesForExamTopic(fallbackMinutes(topic, prefs));
    map.set(normalizeExamTopicKey(topic), mins);
  }
}

/**
 * AI-backed minutes per topic. Throws on hard API errors (no key, 5xx after retries).
 * Malformed/empty AI rows for a batch → heuristic for that batch.
 */
export async function fetchTopicMinutesMap(
  subject: string,
  topics: string[],
  prefs: SchedulePreferences,
  onProgress?: (label: string) => void
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (topics.length === 0) return map;

  const pace = (prefs.studyPace || 'balanced') as 'light' | 'balanced' | 'intensive';
  const totalBatches = Math.max(1, Math.ceil(topics.length / BATCH_SIZE));

  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    const batch = topics.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    onProgress?.(`[${subject}] AI time estimates (${batchNum}/${totalBatches})…`);

    let done = false;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'estimateTopicDurations',
          sessionLengthMinutes: Math.min(28, prefs.defaultSessionMinutes || 28),
          gradeLevel: examEffectiveGrade(prefs),
          studentContext: `Study pace: ${pace}. Grade (year): ${examEffectiveGrade(prefs)}. EXAM PREP — SHORT minutes per syllabus line: active review / recall, not a full lesson. Target 10–20 min per row; cap at 25 except rare heavy items. Light recall lines 8–12.`,
          subjects: [{ name: subject, topics: batch }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data?.subjects?.[0]?.topics as
          | Array<{ topic?: string; estimatedMinutes?: number }>
          | undefined;
        applyBatchToMap(map, batch, rows, prefs);
        done = true;
        break;
      }

      if (res.status === 429 && attempt < 4) {
        const retryAfter = Number(res.headers.get('retry-after') || '1');
        await sleep(Math.max(1000, retryAfter * 1000));
        continue;
      }

      throw new Error(await readApiErrorMessage(res));
    }

    if (!done) {
      applyBatchToMap(map, batch, undefined, prefs);
    }

    if (batchNum < totalBatches) await sleep(400);
  }

  return map;
}
