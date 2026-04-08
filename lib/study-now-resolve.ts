import type { Task } from '@/types';
import { focusHrefFor, listOpenMicroTasksInFocusOrder } from '@/lib/focus-next-step';

export type RecommendCandidate = {
  microTaskId: string;
  taskId: string;
  microTaskTitle: string;
  taskTitle: string;
  subject: string;
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Open steps: today’s plan first, then same ordering as Focus “next step”. */
export function orderCandidatesForRecommendNow(
  tasks: Task[],
  remainingTodayMicroIds: string[]
): RecommendCandidate[] {
  const base = listOpenMicroTasksInFocusOrder(tasks, 48);
  const onToday = new Set(remainingTodayMicroIds);
  const first = base.filter((x) => onToday.has(x.microTask.id));
  const rest = base.filter((x) => !onToday.has(x.microTask.id));
  const merged = [...first, ...rest].slice(0, 24);
  return merged.map(({ task, microTask }) => ({
    microTaskId: microTask.id,
    taskId: task.id,
    microTaskTitle: microTask.title,
    taskTitle: task.title,
    subject: task.subject || 'General',
  }));
}

/**
 * Map AI output to a real focus URL. Returns null when there are no open steps.
 * Prefers exact microTaskId from the candidate list, then title fuzzy match — no invented ids.
 */
export function resolveStudyNowFocusHref(
  rec: { microTaskId?: string | null; task: string },
  candidates: RecommendCandidate[]
): string | null {
  if (candidates.length === 0) return null;
  const byId = new Map(candidates.map((c) => [c.microTaskId, c]));
  if (rec.microTaskId && byId.has(rec.microTaskId)) {
    const c = byId.get(rec.microTaskId)!;
    return focusHrefFor(c.taskId, c.microTaskId);
  }
  const rt = norm(rec.task || '');
  if (rt) {
    for (const c of candidates) {
      const mt = norm(c.microTaskTitle);
      const tt = norm(c.taskTitle);
      if (mt && (rt.includes(mt) || mt.includes(rt) || mt.split(' ').some((w) => w.length > 3 && rt.includes(w)))) {
        return focusHrefFor(c.taskId, c.microTaskId);
      }
      if (tt && (rt.includes(tt) || tt.includes(rt))) {
        return focusHrefFor(c.taskId, c.microTaskId);
      }
    }
  }
  return null;
}
