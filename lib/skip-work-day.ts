import { format, startOfDay } from 'date-fns';
import type { Exam, MicroTask, Task } from '@/types';
import { makeId } from '@/lib/ids';
import { parseLocalDateKey } from '@/lib/local-date';
import { resolveExamTopicKey } from '@/lib/exam-topic-match';

const MIN_SPLIT_MINUTES = 10;

/** Map a free-text label to a canonical `exam.topics` entry, or null if none matches. */
export function resolveTopicKeyForExam(label: string, exam: Exam): string | null {
  return resolveExamTopicKey(exam.topics || [], label);
}

/** Local calendar day key (yyyy-MM-dd) for where this step is scheduled, if known. */
export function microTaskScheduledDayKey(mt: MicroTask): string | null {
  const rawStart = mt.scheduledStart;
  if (rawStart != null) {
    const ss = rawStart instanceof Date ? rawStart : new Date(rawStart);
    if (!Number.isNaN(ss.getTime())) return format(startOfDay(ss), 'yyyy-MM-dd');
  }
  const sd = mt.scheduledDate;
  if (sd == null) return null;
  let d: Date;
  if (sd instanceof Date) d = sd;
  else {
    const s = String(sd).trim();
    d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseLocalDateKey(s) : new Date(s);
  }
  if (Number.isNaN(d.getTime())) return null;
  return format(startOfDay(d), 'yyyy-MM-dd');
}

function transformMicroTaskForSkippedDay(
  mt: MicroTask,
  dayKeys: Set<string>,
  parentTaskId: string,
  examById: Map<string, Exam>
): MicroTask[] {
  if (mt.completed) return [mt];
  const k = microTaskScheduledDayKey(mt);
  if (!k || !dayKeys.has(k)) return [mt];

  const subs = (mt.subtopics || []).filter((s) => String(s).trim());
  const exam = mt.examId ? examById.get(mt.examId) : undefined;

  if (mt.source === 'exam-planner' && subs.length >= 2) {
    const baseTotal = Math.max(
      MIN_SPLIT_MINUTES * subs.length,
      Math.round(Number(mt.estimatedMinutes) || subs.length * 25)
    );
    const per = Math.max(MIN_SPLIT_MINUTES, Math.floor(baseTotal / subs.length));
    let remainder = baseTotal - per * (subs.length - 1);
    remainder = Math.max(MIN_SPLIT_MINUTES, remainder);

    return subs.map((st, i) => {
      const label = String(st);
      const topicKey = exam ? resolveTopicKeyForExam(label, exam) ?? label : label;
      const mins = i === subs.length - 1 ? remainder : per;
      return {
        ...mt,
        id: makeId('micro'),
        parentTaskId,
        title: label.slice(0, 200),
        subtopics: [topicKey],
        examTopicKey: topicKey,
        estimatedMinutes: mins,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        scheduledDate: undefined,
        fixedSlot: false,
      };
    });
  }

  return [
    {
      ...mt,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      scheduledDate: undefined,
      fixedSlot: false,
    },
  ];
}

/**
 * For microtasks scheduled on any of `dayKeys`, strip clock placement so rebalance can repack.
 * Multi-topic exam-planner rows are split into one step per subtopic when possible.
 */
export function fragmentTasksAfterSkippingDays(tasks: Task[], dayKeys: Set<string>, exams: Exam[]): Task[] {
  if (dayKeys.size === 0) return tasks;
  const examById = new Map(exams.map((e) => [e.id, e]));
  return tasks.map((task) => {
    if (task.completed) return task;
    const micros = task.microTasks.flatMap((mt) =>
      transformMicroTaskForSkippedDay(mt, dayKeys, task.id, examById)
    );
    const withOrder = micros.map((mt, i) => ({ ...mt, order: i + 1 }));
    const sum = withOrder.reduce((a, m) => a + (Number(m.estimatedMinutes) || 0), 0);
    return {
      ...task,
      microTasks: withOrder,
      estimatedTotalMinutes: sum > 0 ? sum : task.estimatedTotalMinutes,
    };
  });
}
