import { isSameDay } from 'date-fns';
import type { MicroTask, Task } from '@/types';
import { parseCalendarDate } from '@/lib/local-date';

/**
 * Next micro-task for Focus mode: prefers today / soonest scheduled, then priority + due date + step order.
 */
export function getNextFocusMicroTask(taskList: Task[]): { task: Task; microTask: MicroTask } | null {
  const allMicroTasks: Array<{ task: Task; microTask: MicroTask; when: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = taskList
    .filter((t) => !t.completed)
    .map((task) => ({
      ...task,
      dueDate: parseCalendarDate(task.dueDate),
    }))
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  sortedTasks.forEach((task) => {
    task.microTasks
      .filter((mt) => !mt.completed)
      .sort((a, b) => a.order - b.order)
      .forEach((microTask) => {
        const scheduledStart = microTask.scheduledStart ? new Date(microTask.scheduledStart) : null;
        const scheduledDate = microTask.scheduledDate ? new Date(microTask.scheduledDate) : null;
        const isTodayTask =
          (scheduledStart && isSameDay(scheduledStart, today)) ||
          (!scheduledStart && scheduledDate && isSameDay(scheduledDate, today));
        const when = scheduledStart
          ? scheduledStart.getTime()
          : isTodayTask
            ? today.getTime()
            : Number.MAX_SAFE_INTEGER;
        allMicroTasks.push({ task, microTask, when });
      });
  });

  const pr = { high: 3, medium: 2, low: 1 } as const;
  allMicroTasks.sort((a, b) => {
    if (a.when !== b.when) return a.when - b.when;
    if (pr[b.task.priority] !== pr[a.task.priority]) return pr[b.task.priority] - pr[a.task.priority];
    const da = parseCalendarDate(a.task.dueDate).getTime();
    const db = parseCalendarDate(b.task.dueDate).getTime();
    if (da !== db) return da - db;
    return a.microTask.order - b.microTask.order;
  });

  const first = allMicroTasks[0];
  return first ? { task: first.task, microTask: first.microTask } : null;
}

/** All incomplete steps in the same order Focus uses for “next” (for AI pick lists, etc.). */
export function listOpenMicroTasksInFocusOrder(
  taskList: Task[],
  limit = 40
): Array<{ task: Task; microTask: MicroTask }> {
  const allMicroTasks: Array<{ task: Task; microTask: MicroTask; when: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = taskList
    .filter((t) => !t.completed)
    .map((task) => ({
      ...task,
      dueDate: parseCalendarDate(task.dueDate),
    }))
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  sortedTasks.forEach((task) => {
    task.microTasks
      .filter((mt) => !mt.completed)
      .sort((a, b) => a.order - b.order)
      .forEach((microTask) => {
        const scheduledStart = microTask.scheduledStart ? new Date(microTask.scheduledStart) : null;
        const scheduledDate = microTask.scheduledDate ? new Date(microTask.scheduledDate) : null;
        const isTodayTask =
          (scheduledStart && isSameDay(scheduledStart, today)) ||
          (!scheduledStart && scheduledDate && isSameDay(scheduledDate, today));
        const when = scheduledStart
          ? scheduledStart.getTime()
          : isTodayTask
            ? today.getTime()
            : Number.MAX_SAFE_INTEGER;
        allMicroTasks.push({ task, microTask, when });
      });
  });

  const pr = { high: 3, medium: 2, low: 1 } as const;
  allMicroTasks.sort((a, b) => {
    if (a.when !== b.when) return a.when - b.when;
    if (pr[b.task.priority] !== pr[a.task.priority]) return pr[b.task.priority] - pr[a.task.priority];
    const da = parseCalendarDate(a.task.dueDate).getTime();
    const db = parseCalendarDate(b.task.dueDate).getTime();
    if (da !== db) return da - db;
    return a.microTask.order - b.microTask.order;
  });

  return allMicroTasks.slice(0, limit).map(({ task, microTask }) => ({ task, microTask }));
}

export function focusHrefFor(taskId: string, microTaskId: string): string {
  return `/focus?task=${encodeURIComponent(taskId)}&micro=${encodeURIComponent(microTaskId)}`;
}
