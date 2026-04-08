/**
 * Automated coverage for the manual QA checklist (calendar, AI heuristics, today budget,
 * exam planner ×5 subjects, rebalance, edge packing). Run: npm run test:qa
 *
 * Skips live LLM calls (no Groq/Gemini). Use the in-app AI Task Creator to validate parseTask/chunkTask end-to-end.
 */
import { format, isSameDay, startOfDay } from 'date-fns';
import { pathToFileURL } from 'node:url';
import { MYP5_SYLLABI_ENTRIES } from './fixtures/myp5-syllabi';
import {
  extractWeekdayIndicesFromUserText,
  fixMisclassifiedRecurringActivityPlan,
  fixMisclassifiedRecurringWeeklyClassSlotAsEvent,
  inferTaskSessionStyle,
  normalizeSchedulingUserText,
  userAskedForWeeklyRecurrence,
  normalizeWeekdayMisspellings,
  ensureEventWeeklyRepeatFromUserText,
  inferCalendarDayFromUserText,
  inferOrdinalDeadlineDayFromUserText,
  resolveTitleFromUserText,
} from '../lib/ai-task-text-parse';
import { extractSyllabusTopicsHeuristic } from '../lib/exam-syllabus-extract';
import { planMultiSubjectExamPrep } from '../lib/exam-prep-schedule';
import { rebalanceAllTaskSchedules, scheduleMicroTasksIntoTimesAdaptive } from '../lib/scheduler';
import { calendarEventsForTodayBudgetBlock, parseTodayBudgetMinutes } from '../lib/today-budget-parse';
import { parseLocalDateKey } from '../lib/local-date';
import type { CalendarEvent, MicroTask, SchedulePreferences, Task } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function realishPrefs(over: Partial<SchedulePreferences> = {}): SchedulePreferences {
  return {
    workStart: '16:00',
    workEnd: '21:00',
    defaultSessionMinutes: 45,
    breakMinutes: 10,
    bufferMinutes: 5,
    studyPace: 'balanced',
    gradeLevel: '10',
    ...over,
  };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function collectMicroIds(tasks: Task[]): Set<string> {
  const s = new Set<string>();
  for (const t of tasks) for (const m of t.microTasks) s.add(m.id);
  return s;
}

function totalOpenMicros(tasks: Task[]): number {
  let n = 0;
  for (const t of tasks) {
    if (t.completed) continue;
    for (const m of t.microTasks) if (!m.completed) n++;
  }
  return n;
}

function mkMicro(
  id: string,
  parent: string,
  minutes: number,
  order: number,
  extras: Partial<MicroTask> = {}
): MicroTask {
  return {
    id,
    parentTaskId: parent,
    title: `Step ${order}`,
    estimatedMinutes: minutes,
    completed: false,
    order,
    ...extras,
  };
}

function section1_baselineCalendarInsideWorkWindow() {
  console.log('1. Baseline calendar — tasks avoid timed “School” inside work window');
  const prefs = realishPrefs({ workStart: '07:00', workEnd: '21:00' });
  const schoolDay = new Date(2026, 3, 10);
  const school: CalendarEvent = {
    id: 'ev-school',
    title: 'School',
    start: new Date(2026, 3, 10, 8, 0, 0),
    end: new Date(2026, 3, 10, 15, 0, 0),
    allDay: false,
    eventType: 'class',
    color: '#6A9BCC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const due = new Date(2026, 3, 24);
  const micros = [mkMicro('m1', 't1', 50, 1), mkMicro('m2', 't1', 50, 2), mkMicro('m3', 't1', 50, 3)];
  const pack = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: micros,
    startDay: new Date(2026, 3, 6),
    dueDay: due,
    prefs,
    calendarEvents: [school],
    existingTasks: [],
  });
  const placed = [...pack.scheduled, ...pack.unscheduled];
  for (const mt of placed) {
    const ss = mt.scheduledStart;
    const se = mt.scheduledEnd;
    if (!ss || !se) continue;
    if (isSameDay(ss, schoolDay)) {
      assert(
        !overlaps(ss, se, school.start, school.end),
        'task block overlaps School 8:00–15:00 on that day'
      );
    }
  }
}

function section2_aiHeuristicsNoLiveApi() {
  console.log('2. AI Task Creator — local heuristics (API /parseTask not called here)');
  const paper = inferTaskSessionStyle('2 hour Math past paper this Saturday', {
    title: 'Math',
    sessionStyle: undefined,
  });
  assert(paper === 'single_block', 'past paper + duration → single_block');

  const essay = inferTaskSessionStyle('2000-word essay due next Friday', {
    title: 'Essay',
    sessionStyle: undefined,
  });
  assert(essay === 'multi_step', 'essay → multi_step');

  const coerced = fixMisclassifiedRecurringActivityPlan('soccer practice every wednesday 5-6pm', {
    kind: 'study_plan',
    summary: 'bad',
    tasks: [{ title: 'Soccer' }],
  });
  assert(coerced?.kind === 'event', 'weekly sport misclassified as study_plan → event');

  const classWeekly = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(
    'I have math class every Wednesday',
    { kind: 'task', title: 'Math', sessionStyle: 'multi_step' }
  );
  assert(classWeekly?.kind === 'event', 'weekly class without clock times → event, not task');
  assert(
    Array.isArray((classWeekly as { repeat?: { daysOfWeek?: number[] } })?.repeat?.daysOfWeek) &&
      (classWeekly as { repeat: { daysOfWeek: number[] } }).repeat.daysOfWeek.includes(3),
    'Wednesday → dow 3 in repeat'
  );

  const classNoClockStudyPlan = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(
    'Bio lesson every Tuesday',
    { kind: 'study_plan', summary: 'x', tasks: [{ title: 'x', microTasks: [] }] }
  );
  assert(classNoClockStudyPlan?.kind === 'event', 'study_plan weekly lesson → coerced to event');

  const normalizedTypo = normalizeSchedulingUserText('i gotta match lass every wednesday');
  assert(
    /\bmath class\b/i.test(normalizedTypo) && /\bhave to\b/i.test(normalizedTypo),
    'normalize: slang + voice typo → math class / have to'
  );
  const fromNorm = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(normalizedTypo, {
    kind: 'task',
    title: 'x',
    sessionStyle: 'multi_step',
  });
  assert(fromNorm?.kind === 'event', 'after normalize, weekly class heuristic still fires');

  assert(userAskedForWeeklyRecurrence('math every tuesday'), 'every + full weekday name counts as weekly');
  assert(!userAskedForWeeklyRecurrence('math on tuesday only'), 'single on tuesday is not “every” weekly cue');
  const typoDays = extractWeekdayIndicesFromUserText(
    normalizeWeekdayMisspellings('every tusday and thruday at 6pm')
  );
  assert(typoDays.includes(2) && typoDays.includes(4), 'typo weekdays normalize to Tue+Thu');
  const ensured = ensureEventWeeklyRepeatFromUserText(
    normalizeSchedulingUserText('math every tusday and thruday at 6pm'),
    { kind: 'event', title: 'x', repeat: null }
  ) as { repeat?: { daysOfWeek?: number[] } };
  assert(
    Boolean(ensured.repeat?.daysOfWeek?.includes(2) && ensured.repeat?.daysOfWeek?.includes(4)),
    'ensureEventWeeklyRepeat rebuilds days from user text'
  );

  const standupDays = extractWeekdayIndicesFromUserText('Team standup Mon 9am weekly');
  assert(standupDays.includes(1), 'standup text mentions Monday → dow 1 (expect API kind:event)');
  console.log('   (Standup / study_plan rows need parseTask via /api/gemini — verify in UI when GROQ_API_KEY is set.)');

  const wed = new Date(2026, 3, 8, 14, 0, 0);
  const nextThuFromWed = inferCalendarDayFromUserText('I have meeting next thursday', wed);
  assert(
    nextThuFromWed != null && format(nextThuFromWed, 'yyyy-MM-dd') === '2026-04-16',
    'Wed ref → “next thursday” skips imminent Thu → following week’s Thursday'
  );
  const thisThuFromWed = inferCalendarDayFromUserText('dentist this thursday', wed);
  assert(
    thisThuFromWed != null && format(thisThuFromWed, 'yyyy-MM-dd') === '2026-04-09',
    'Wed ref → “this thursday” = soonest Thursday'
  );
  const bareThuFromWed = inferCalendarDayFromUserText('dentist thursday', wed);
  assert(
    bareThuFromWed != null && format(bareThuFromWed, 'yyyy-MM-dd') === '2026-04-09',
    'Wed ref → bare “thursday” = soonest Thursday'
  );
  const nextWeekPhrase = inferCalendarDayFromUserText('meet next week on thursday', wed);
  assert(
    nextWeekPhrase != null && format(nextWeekPhrase, 'yyyy-MM-dd') === '2026-04-16',
    '“next week” + weekday → same as “next thursday” (not imminent)'
  );
  const thuRef = new Date(2026, 3, 9, 10, 0, 0);
  const nextWeekThu = inferCalendarDayFromUserText('meeting next thursday', thuRef);
  assert(
    nextWeekThu != null && format(nextWeekThu, 'yyyy-MM-dd') === '2026-04-16',
    'Thu ref + explicit “next thursday” → following week'
  );
  const thisThu = inferCalendarDayFromUserText('dentist thursday', thuRef);
  assert(
    thisThu != null && format(thisThu, 'yyyy-MM-dd') === '2026-04-09',
    'Thu ref + bare “thursday” → same day'
  );
  assert(
    inferCalendarDayFromUserText('math every tuesday', wed) === null,
    'weekly recurrence + weekday → null (caller uses repeat)'
  );
  assert(
    normalizeWeekdayMisspellings('rhsuday').toLowerCase().includes('thursday'),
    'rhsuday typo → thursday'
  );
  const meetTitle = resolveTitleFromUserText(
    'I have meeting next thursday',
    'I have meeting next thursday'
  );
  assert(meetTitle === 'Meeting', 'strip NL filler + weekday tail → short title');

  const apr5 = new Date(2026, 3, 5, 12, 0, 0);
  const by19 = inferOrdinalDeadlineDayFromUserText('finish all by the 19th', apr5);
  assert(by19 != null && format(by19, 'yyyy-MM-dd') === '2026-04-19', 'ordinal “by the 19th” → correct month');

}

function section3_todayBudget() {
  console.log('3. Today budget — parse + no work in “Unavailable” tail of today');
  assert(parseTodayBudgetMinutes('only 1 hour today') === 60, 'only 1 hour today');
  assert(parseTodayBudgetMinutes('just 90 min today') === 90, 'just 90 min today');

  const prefs = realishPrefs();
  const now = new Date(2026, 3, 10, 12, 0, 0);
  const budgetEvents = calendarEventsForTodayBudgetBlock(60, prefs, now);
  assert(budgetEvents.length === 1, 'budget adds one blocking event');

  const due = new Date(2026, 3, 20);
  const micros = Array.from({ length: 8 }, (_, i) => mkMicro(`b${i}`, 'tb', 40, i + 1));
  const task: Task = {
    id: 'tb',
    title: 'Spread load',
    dueDate: due,
    priority: 'medium',
    completed: false,
    createdAt: now,
    estimatedTotalMinutes: 320,
    microTasks: micros,
  };
  const rebalanced = rebalanceAllTaskSchedules({
    tasks: [task],
    calendarEvents: budgetEvents,
    prefs,
    from: now,
  });
  const block = budgetEvents[0]!;
  const today0 = startOfDay(now);
  for (const mt of rebalanced[0]!.microTasks) {
    const ss = mt.scheduledStart;
    const se = mt.scheduledEnd;
    if (!ss || !se || !isSameDay(ss, today0)) continue;
    assert(
      se.getTime() <= block.start.getTime(),
      'today sessions must fit in the free slice before Unavailable (end ≤ block.start)'
    );
  }
}

function section4_examPlannerFiveSubjectsAndConflict() {
  console.log('4. Exam planner — all 5 MYP5 syllabi + heavy same-week event → still full coverage');
  const planStart = new Date(2026, 3, 4);
  const prefs = realishPrefs({ workStart: '08:00', workEnd: '22:00' });

  const queued = MYP5_SYLLABI_ENTRIES.map((s) => ({
    ...s,
    rows: extractSyllabusTopicsHeuristic(s.text, s.subject),
  }));
  for (const q of queued) assert(q.rows.length > 0, `${q.subject}: extract`);

  const inputs = queued.map((s) => ({
    id: s.id,
    subject: s.subject,
    examName: `${s.subject} exam`,
    examDateKey: s.examDateKey,
    rows: s.rows,
  }));

  const heavyWeek = new Date(2026, 4, 12);
  const heavy: CalendarEvent = {
    id: 'ev-trip',
    title: 'Trip',
    start: heavyWeek,
    end: heavyWeek,
    allDay: true,
    eventType: 'other',
    color: '#ccc',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const planned = planMultiSubjectExamPrep(inputs, prefs, planStart);
  assert(planned.length > 0, 'plan non-empty');

  let created: Task[] = [];
  const todayStart = startOfDay(planStart);
  for (const s of queued) {
    const examDay = startOfDay(parseLocalDateKey(s.examDateKey));
    const sessions = planned.filter((p) => p.subjectId === s.id).sort((a, b) => a.order - b.order);
    assert(sessions.length > 0, `${s.subject} sessions`);
    const taskId = `exam-${s.id}`;
    const microTasks: MicroTask[] = sessions.map((se, idx) => ({
      id: `${taskId}-m${idx}`,
      parentTaskId: taskId,
      title: `${s.subject} · ${format(startOfDay(se.scheduledDate), 'MMM d')}`,
      estimatedMinutes: se.estimatedMinutes,
      completed: false,
      order: idx + 1,
      source: 'exam-planner',
      examId: 'x',
      scheduledDate: se.scheduledDate,
    }));
    const pack = scheduleMicroTasksIntoTimesAdaptive({
      microTasks,
      startDay: todayStart,
      dueDay: examDay,
      prefs,
      calendarEvents: [heavy],
      existingTasks: created,
    });
    const all = [...pack.scheduled, ...pack.unscheduled];
    created.push({
      id: taskId,
      title: `${s.subject} prep`,
      dueDate: examDay,
      priority: 'high',
      subject: s.subject,
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: all.reduce((a, m) => a + m.estimatedMinutes, 0),
      microTasks: all.map((m, i) => ({ ...m, order: i + 1 })),
    });
  }

  const before = totalOpenMicros(created);
  const after1 = rebalanceAllTaskSchedules({
    tasks: created,
    calendarEvents: [heavy],
    prefs,
    from: planStart,
  });
  const after2 = rebalanceAllTaskSchedules({
    tasks: after1,
    calendarEvents: [heavy],
    prefs,
    from: planStart,
  });
  assert(totalOpenMicros(after2) === before, 're-run scheduling: no microtasks vanish');
  assert(
    collectMicroIds(after1).size === collectMicroIds(after2).size,
    'same microtask ids after second rebalance'
  );

  const regular: Task = {
    id: 'regular-chore',
    title: 'Chores',
    dueDate: new Date(2026, 4, 18),
    priority: 'medium',
    completed: false,
    createdAt: new Date(),
    estimatedTotalMinutes: 120,
    microTasks: [mkMicro('r1', 'regular-chore', 60, 1), mkMicro('r2', 'regular-chore', 60, 2)],
  };
  const mixed = rebalanceAllTaskSchedules({
    tasks: [...after2, regular],
    calendarEvents: [heavy],
    prefs,
    from: planStart,
  });
  const examStill = mixed.find((t) => t.id.startsWith('exam-'));
  assert(
    !!(examStill && examStill.microTasks.some((m) => m.scheduledStart)),
    'exam-linked task still timed'
  );
}

function section5_rebalanceTwiceIdsStable() {
  console.log('5. Rebalance sanity — explicit double pass (also covered in §4)');
  const prefs = realishPrefs();
  const tasks: Task[] = [
    {
      id: 'a',
      title: 'A',
      dueDate: new Date(2026, 5, 1),
      priority: 'low',
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: 100,
      microTasks: [mkMicro('a1', 'a', 50, 1), mkMicro('a2', 'a', 50, 2)],
    },
    {
      id: 'b',
      title: 'B',
      dueDate: new Date(2026, 5, 2),
      priority: 'high',
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: 80,
      microTasks: [mkMicro('b1', 'b', 40, 1), mkMicro('b2', 'b', 40, 2)],
    },
  ];
  const ids0 = collectMicroIds(tasks);
  const once = rebalanceAllTaskSchedules({ tasks, calendarEvents: [], prefs, from: new Date(2026, 3, 1) });
  const twice = rebalanceAllTaskSchedules({ tasks: once, calendarEvents: [], prefs, from: new Date(2026, 3, 1) });
  assert(collectMicroIds(twice).size === ids0.size, 'micro id count stable');
  assert(totalOpenMicros(twice) === totalOpenMicros(tasks), 'open micro count stable');
}

function section6_edgeDueTomorrow() {
  console.log('6. Edge — due soon + almost no space → adaptive still assigns times');
  const prefs = realishPrefs({ workStart: '09:00', workEnd: '10:00' });
  const startDay = new Date(2026, 3, 14);
  const dueDay = new Date(2026, 3, 15);
  const allDayBlock: CalendarEvent = {
    id: 'busy',
    title: 'Busy',
    start: startDay,
    end: startDay,
    allDay: true,
    eventType: 'other',
    color: '#000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const micros = [mkMicro('e1', 'edge', 45, 1)];
  const pack = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: micros,
    startDay,
    dueDay,
    prefs,
    calendarEvents: [allDayBlock],
    existingTasks: [],
  });
  const all = [...pack.scheduled, ...pack.unscheduled];
  assert(all.length === 1, 'one microtask output');
  const mt = all[0]!;
  assert(
    !!((mt.scheduledStart && mt.scheduledEnd) || mt.scheduledDate),
    'either timed block or at least a scheduledDate (no silent drop)'
  );
  assert(
    pack.unscheduled.length === 0,
    'adaptive force path leaves no permanent unscheduled in this engine'
  );
}

function main() {
  section1_baselineCalendarInsideWorkWindow();
  section2_aiHeuristicsNoLiveApi();
  section3_todayBudget();
  section4_examPlannerFiveSubjectsAndConflict();
  section5_rebalanceTwiceIdsStable();
  section6_edgeDueTomorrow();
  console.log('\nAll QA checklist automation passed.');
  console.log(
    '\nManual (browser) still recommended: Calendar view, AI Task Creator (Groq) four example phrases, Settings → Re-run scheduling.'
  );
}

function isExecutedDirectly(): boolean {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) main();

export { main as runQaChecklistE2e };
