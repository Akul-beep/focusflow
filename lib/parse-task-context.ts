import type { Exam, Task } from '@/types';
import { format } from 'date-fns';

/** Small payload for parseTask — limits tokens (exams/topics/tasks lists). */
export function buildParseTaskScheduleContext(exams: Exam[], tasks: Task[]) {
  return {
    exams: exams.slice(0, 6).map((e) => ({
      name: e.name.slice(0, 48),
      subject: e.subject.slice(0, 32),
      examDate: e.examDate,
      topics: e.topics.slice(0, 8).map((x) => x.slice(0, 36)),
    })),
    activeTasks: tasks
      .filter((t) => !t.completed)
      .slice(0, 10)
      .map((t) => ({
        title: t.title.trim().slice(0, 44),
        subject: t.subject?.trim().slice(0, 28),
        dueDate: format(t.dueDate, 'yyyy-MM-dd'),
        openSteps: t.microTasks.filter((m) => !m.completed).length,
      })),
  };
}
