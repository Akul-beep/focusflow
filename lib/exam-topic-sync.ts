import type { MicroTask } from '@/types';

/**
 * Topic strings on the exam syllabus to mark covered/uncovered when a step completes.
 * Prefer `subtopics` (syllabus lines); otherwise `examTopicKey` or `title`.
 */
export function examSyllabusTopicsFromMicroTask(mt: MicroTask): string[] {
  if (!mt.examId) return [];
  if (Array.isArray(mt.subtopics) && mt.subtopics.length > 0) {
    return mt.subtopics.map((s) => String(s).trim()).filter(Boolean);
  }
  const key = (mt.examTopicKey ?? mt.title ?? '').trim();
  return key ? [key] : [];
}
