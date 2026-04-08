import type { Task } from '@/types';

/** Tasks created from the exam planner / syllabus flow (grouped on the dashboard). */
export function isExamSyllabusTask(task: Task): boolean {
  return task.microTasks.some(
    (mt) =>
      mt.source === 'exam-planner' ||
      (typeof mt.examId === 'string' && mt.examId.trim() !== '')
  );
}

export function partitionExamSyllabusTasks(tasks: Task[]): { exam: Task[]; other: Task[] } {
  const exam: Task[] = [];
  const other: Task[] = [];
  for (const t of tasks) {
    (isExamSyllabusTask(t) ? exam : other).push(t);
  }
  return { exam, other };
}
