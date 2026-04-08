import { isBefore, startOfDay } from 'date-fns';
import type { Task } from '@/types';

export type RecoveryBannerSignals = {
  showBanner: boolean;
  overdueIncompleteCount: number;
  skippedTodayCount: number;
};

function asSkipSet(skippedMicroTaskIdsToday: Set<string> | string[]): Set<string> {
  return skippedMicroTaskIdsToday instanceof Set
    ? skippedMicroTaskIdsToday
    : new Set(skippedMicroTaskIdsToday);
}

/** Banner when several skips and/or steps scheduled on past days are still open. */
export function getRecoveryBannerSignals(
  tasks: Task[],
  skippedMicroTaskIdsToday: Set<string> | string[]
): RecoveryBannerSignals {
  const skipSet = asSkipSet(skippedMicroTaskIdsToday);
  const skippedTodayCount = skipSet.size;
  const today = startOfDay(new Date());

  let overdueIncompleteCount = 0;
  for (const task of tasks) {
    if (task.completed) continue;
    for (const mt of task.microTasks) {
      if (mt.completed) continue;
      const start = mt.scheduledStart
        ? new Date(mt.scheduledStart)
        : mt.scheduledDate
          ? new Date(mt.scheduledDate)
          : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      if (isBefore(startOfDay(start), today)) overdueIncompleteCount++;
    }
  }

  const showBanner =
    skippedTodayCount >= 2 ||
    overdueIncompleteCount >= 2 ||
    (skippedTodayCount >= 1 && overdueIncompleteCount >= 1);

  return { showBanner, overdueIncompleteCount, skippedTodayCount };
}
