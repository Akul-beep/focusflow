/**
 * Terminal checks for scheduling helpers (no browser, no Arc, no your live data).
 * Run: npm run test:schedule
 */
import {
  extractWeekdayIndicesFromUserText,
  sanitizeWeeklyRepeatDaysFromUserText,
  extractEventTimeRangeFromUserText,
  extractSlotEarliestMinutesFromUserText,
  fixMisclassifiedRecurringActivityPlan,
  fixMisclassifiedWeeklyMeetingAsEvent,
  fixMisclassifiedRecurringWeekdayClockBlockAsEvent,
  looksLikeRecurringWeekdayClockBlock,
  stripSpuriousEventWeeklyRepeat,
  inferTomorrowForBarePastPaperIntent,
  buildFixedWallClockSlotForDueDay,
  reconcileTaskVsEventKindFromUserText,
} from '../lib/ai-task-text-parse';
import { format, isSameDay, startOfDay } from 'date-fns';
import {
  scheduleMicroTasksIntoTimesAdaptive,
  rebalanceAllTaskSchedules,
  scheduleMicroTasksIntoTimes,
} from '../lib/scheduler';
import type { Task, CalendarEvent, SchedulePreferences, MicroTask } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function mkPrefs(over: Partial<SchedulePreferences> = {}): SchedulePreferences {
  return {
    workStart: '16:00',
    workEnd: '21:00',
    defaultSessionMinutes: 30,
    breakMinutes: 10,
    bufferMinutes: 5,
    studyPace: 'balanced',
    ...over,
  };
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

function main() {
  console.log('— Text parsing (recurring events / times) —');
  assert(
    extractWeekdayIndicesFromUserText('soccer practice every wednesday').join(',') === '3',
    'single weekday → Wednesday = 3'
  );
  assert(
    sanitizeWeeklyRepeatDaysFromUserText('soccer every wednesday', [6, 1, 2, 3]).join(',') === '3',
    'sanitize kills bogus multi-day model output when user said Wednesday only'
  );
  assert(
    sanitizeWeeklyRepeatDaysFromUserText('meetings mon and thu', [0, 1, 2]).join(',') === '1,4',
    'two named weekdays preserved in order of mention'
  );
  const t5 = extractEventTimeRangeFromUserText('soccer every wednesday 5-6');
  assert(t5?.startHHMM === '17:00' && t5?.endHHMM === '18:00', '5-6 without am/pm → after-school PM');

  const t6 = extractEventTimeRangeFromUserText('Team standup Mon 9am weekly');
  assert(t6?.startHHMM === '09:00' && t6?.endHHMM === '10:00', '9am without colon → 09:00 start');

  const fixedMeet = fixMisclassifiedWeeklyMeetingAsEvent('Team standup Mon 9am weekly', {
    kind: 'task',
    sessionStyle: 'multi_step',
    title: 'Untitled Task',
  });
  assert(fixedMeet?.kind === 'event', 'weekly standup misclassified as task → event');

  const bioWeekly = 'Bio Tue/Thu 4–5pm weekly';
  assert(
    extractWeekdayIndicesFromUserText(bioWeekly).join(',') === '2,4',
    'Tue/Thu slash → Tuesday+Thursday (helps model-output sanitization)'
  );
  assert(looksLikeRecurringWeekdayClockBlock(bioWeekly), 'recurring weekday+clock shape');
  assert(
    looksLikeRecurringWeekdayClockBlock('Bio Tue/Thu 4–5pm weekly event'),
    'model title suffix "weekly event" still structural calendar'
  );
  const recurFix = fixMisclassifiedRecurringWeekdayClockBlockAsEvent(bioWeekly, {
    kind: 'task',
    title: 'Bio Tue/Thu 4-5pm weekly event',
    sessionStyle: 'multi_step',
  });
  assert(recurFix?.kind === 'event', 'task→event for recurring class block');
  assert(
    (recurFix as { eventType?: string }).eventType === 'class',
    'bio → class eventType'
  );
  assert(
    Array.isArray((recurFix as { repeat?: { daysOfWeek?: number[] } }).repeat?.daysOfWeek) &&
      (recurFix as { repeat: { daysOfWeek: number[] } }).repeat.daysOfWeek.join(',') === '2,4',
    'Tue+Thu repeat'
  );
  assert(
    (recurFix as { startTime?: string }).startTime === '16:00' &&
      (recurFix as { endTime?: string }).endTime === '17:00',
    '4–5pm local'
  );
  assert(
    Array.isArray((fixedMeet as { repeat?: { daysOfWeek?: number[] } }).repeat?.daysOfWeek) &&
      (fixedMeet as { repeat: { daysOfWeek: number[] } }).repeat.daysOfWeek.join(',') === '1',
    'standup repeat is Monday only'
  );

  const coerced = fixMisclassifiedRecurringActivityPlan(
    'soccer practice every wednesday 5-6pm',
    {
      kind: 'study_plan',
      summary: 'bad',
      tasks: [{ title: 'Soccer' }],
    }
  );
  assert(coerced?.kind === 'event', 'study_plan → event coercion for weekly sport');
  assert(
    Array.isArray((coerced as { repeat?: { daysOfWeek?: number[] } }).repeat?.daysOfWeek) &&
      (coerced as { repeat: { daysOfWeek: number[] } }).repeat.daysOfWeek.join(',') === '3',
    'coerced repeat is Wednesday only'
  );
  const explicit = reconcileTaskVsEventKindFromUserText('this is an event: alternate mondays bio prep 1 hour', {
    kind: 'task',
    title: 'Bio prep',
  });
  assert(explicit.kind === 'event', 'explicit "this is an event" should force event kind');

  console.log('— Scheduler: recurring event blocks one weekday —');
  const wedBlock: CalendarEvent = {
    id: 'ev-soccer',
    title: 'Soccer',
    start: new Date(2026, 3, 8, 17, 0, 0),
    end: new Date(2026, 3, 8, 18, 0, 0),
    allDay: false,
    eventType: 'event',
    color: '#000',
    repeat: { frequency: 'weekly', interval: 1, daysOfWeek: [3] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const due = new Date(2026, 3, 20);
  const micros = [
    mkMicro('m1', 't1', 45, 1),
    mkMicro('m2', 't1', 45, 2),
  ];
  const pack = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: micros,
    startDay: new Date(2026, 3, 6),
    dueDay: due,
    prefs: mkPrefs({ workStart: '08:30', workEnd: '20:00' }),
    calendarEvents: [wedBlock],
    existingTasks: [],
  });
  const all = [...pack.scheduled, ...pack.unscheduled];
  const soccerStartMin = 17 * 60;
  const soccerEndMin = 18 * 60;
  for (const mt of all) {
    const ss = mt.scheduledStart ? new Date(mt.scheduledStart) : null;
    const se = mt.scheduledEnd ? new Date(mt.scheduledEnd) : null;
    if (!ss || !se || ss.getDay() !== 3) continue;
    const a = ss.getHours() * 60 + ss.getMinutes();
    const b = se.getHours() * 60 + se.getMinutes();
    assert(!(a < soccerEndMin && b > soccerStartMin), 'no task overlap with weekly soccer (Wed 17:00–18:00)');
  }
  console.log('— Scheduler: biweekly interval respected —');
  const biweeklyMon: CalendarEvent = {
    id: 'ev-biweekly',
    title: 'Alt Monday Bio',
    start: new Date(2026, 3, 6, 17, 0, 0), // Monday
    end: new Date(2026, 3, 6, 18, 0, 0),
    allDay: false,
    eventType: 'event',
    color: '#000',
    repeat: { frequency: 'weekly', interval: 2, daysOfWeek: [1] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const biPack = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: [mkMicro('bm1', 'tb', 60, 1), mkMicro('bm2', 'tb', 60, 2)],
    startDay: new Date(2026, 3, 6),
    dueDay: new Date(2026, 3, 20),
    prefs: mkPrefs({ workStart: '16:00', workEnd: '20:00' }),
    calendarEvents: [biweeklyMon],
    existingTasks: [],
  });
  for (const mt of [...biPack.scheduled, ...biPack.unscheduled]) {
    const ss = mt.scheduledStart ? new Date(mt.scheduledStart) : null;
    const se = mt.scheduledEnd ? new Date(mt.scheduledEnd) : null;
    if (!ss || !se || ss.getDay() !== 1) continue;
    const isBlockedMonday = ss.getDate() === 6 || ss.getDate() === 20;
    if (!isBlockedMonday) continue;
    const a = ss.getHours() * 60 + ss.getMinutes();
    const b = se.getHours() * 60 + se.getMinutes();
    assert(!(a < 18 * 60 && b > 17 * 60), 'biweekly Monday event blocks only its interval weeks');
  }

  console.log('— Rebalance keeps scheduledDate, refreshes times —');
  const task: Task = {
    id: 't-exam',
    title: 'Rev: Algebra',
    dueDate: due,
    priority: 'high',
    completed: false,
    createdAt: new Date(),
    estimatedTotalMinutes: 60,
    microTasks: [
      {
        ...mkMicro('x1', 't-exam', 60, 1, {
          source: 'exam-planner',
          scheduledDate: new Date(2026, 3, 10),
          scheduledStart: new Date(2026, 3, 10, 10, 0),
          scheduledEnd: new Date(2026, 3, 10, 11, 0),
        }),
      },
    ],
  };
  const rebalanced = rebalanceAllTaskSchedules({
    tasks: [task],
    calendarEvents: [wedBlock],
    prefs: mkPrefs({ workStart: '08:30', workEnd: '20:00' }),
    from: new Date(2026, 3, 6),
  });
  const mt0 = rebalanced[0]!.microTasks[0]!;
  assert(!!mt0.scheduledDate, 'scheduledDate still set after rebalance');
  assert(!!mt0.scheduledStart && !!mt0.scheduledEnd, 'rebalance refills start/end after clear');

  console.log('— Strip bogus weekly repeat on one-off past paper event —');
  const stripped = stripSpuriousEventWeeklyRepeat('math past paper', {
    kind: 'event',
    repeat: { frequency: 'weekly', interval: 1, daysOfWeek: [3] },
  });
  assert(stripped.repeat == null, 'repeat stripped when user did not ask weekly');

  console.log('— after 5pm → slot earliest 17:00 —');
  assert(extractSlotEarliestMinutesFromUserText('after 5pm daily papers') === 17 * 60, 'after 5pm');

  console.log('— Bare past paper → tomorrow due —');
  const tmr = inferTomorrowForBarePastPaperIntent('Math past paper', new Date(2026, 3, 4));
  assert(
    tmr != null && tmr.getDate() === 5 && tmr.getMonth() === 3,
    'tomorrow April 5',
  );

  console.log('— No overlap: existing evening block + new 2h with after-5 constraint —');
  const april6 = new Date(2026, 3, 6);
  const existingBlock: Task = {
    id: 'busy-evening',
    title: 'Other',
    dueDate: april6,
    priority: 'medium',
    completed: false,
    createdAt: new Date(),
    estimatedTotalMinutes: 45,
    microTasks: [
      {
        id: 'b1',
        parentTaskId: 'busy-evening',
        title: 'Busy',
        estimatedMinutes: 45,
        completed: false,
        order: 1,
        scheduledStart: new Date(2026, 3, 6, 20, 30, 0),
        scheduledEnd: new Date(2026, 3, 6, 21, 15, 0),
      },
    ],
  };
  const packOverlap = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: [mkMicro('n1', 'new', 120, 1)],
    startDay: new Date(2026, 3, 6, 12, 0, 0),
    dueDay: new Date(2026, 3, 8),
    prefs: mkPrefs({ workStart: '16:00', workEnd: '21:30', breakMinutes: 10, bufferMinutes: 5 }),
    calendarEvents: [],
    existingTasks: [existingBlock],
    options: { slotEarliestMinutes: 17 * 60 },
  });
  const placed = packOverlap.scheduled[0]!;
  assert(!!placed.scheduledStart && !!placed.scheduledEnd, 'placed');
  const ps = placed.scheduledStart!.getTime();
  const pe = placed.scheduledEnd!.getTime();
  const bs = existingBlock.microTasks[0]!.scheduledStart!.getTime();
  const be = existingBlock.microTasks[0]!.scheduledEnd!.getTime();
  assert(!(ps < be && pe > bs), 'must not overlap existing block');
  assert(placed.scheduledStart!.getHours() >= 17, 'respects after-5 when same day');

  console.log('— Main packer: same-batch microtasks do not overlap —');
  const sameBatch = scheduleMicroTasksIntoTimes({
    microTasks: [mkMicro('s1', 't', 60, 1), mkMicro('s2', 't', 60, 2)],
    startDay: new Date(2026, 3, 10, 14, 0, 0),
    dueDay: new Date(2026, 3, 12),
    prefs: mkPrefs({ workStart: '16:00', workEnd: '21:00' }),
    calendarEvents: [],
    existingTasks: [],
  });
  assert(sameBatch.scheduled.length === 2, 'two placed');
  const a0 = sameBatch.scheduled[0]!;
  const a1 = sameBatch.scheduled[1]!;
  if (
    a0.scheduledStart &&
    a1.scheduledStart &&
    isSameDay(a0.scheduledStart, a1.scheduledStart)
  ) {
    const o =
      a0.scheduledStart! < a1.scheduledEnd! && a1.scheduledStart! < a0.scheduledEnd!;
    assert(!o, 'same-day microtasks must not overlap');
  }

  console.log('— buildFixedWallClockSlot: at 5pm + 2h paper → 17:00–19:00 —');
  const sat = new Date(2026, 3, 11);
  const slot = buildFixedWallClockSlotForDueDay('Chemistry past paper at 5pm, 2 hours', sat, 120);
  assert(slot != null, 'parses clock');
  assert(slot!.scheduledStart.getHours() === 17 && slot!.scheduledStart.getMinutes() === 0, 'starts 5pm');
  assert(slot!.scheduledEnd.getHours() === 19 && slot!.scheduledEnd.getMinutes() === 0, 'ends 7pm');

  const slotRange = buildFixedWallClockSlotForDueDay('Math paper 5pm–7pm Saturday', sat, 60);
  assert(slotRange != null, 'range parses');
  assert(
    slotRange!.scheduledEnd.getTime() - slotRange!.scheduledStart.getTime() === 120 * 60_000,
    'explicit 5–7 keeps 2h span'
  );

  assert(
    buildFixedWallClockSlotForDueDay('essay due Friday no time', new Date(2026, 3, 17), 120) == null,
    'no clock → null'
  );

  console.log('— Rebalance preserves fixedSlot; flexible packs around —');
  const dueMix = new Date(2026, 3, 14);
  const taskMix: Task = {
    id: 't-mix',
    title: 'Mixed',
    dueDate: dueMix,
    priority: 'medium',
    completed: false,
    createdAt: new Date(2026, 3, 10),
    estimatedTotalMinutes: 180,
    microTasks: [
      mkMicro('mfixed', 't-mix', 120, 1, {
        fixedSlot: true,
        scheduledStart: new Date(2026, 3, 11, 17, 0, 0),
        scheduledEnd: new Date(2026, 3, 11, 19, 0, 0),
        scheduledDate: new Date(2026, 3, 11),
      }),
      mkMicro('mflex', 't-mix', 60, 2),
    ],
  };
  const rbMix = rebalanceAllTaskSchedules({
    tasks: [taskMix],
    calendarEvents: [],
    prefs: mkPrefs({ workStart: '08:00', workEnd: '22:00' }),
    from: new Date(2026, 3, 10, 10, 0, 0),
  });
  const mFixed = rbMix[0]!.microTasks.find((m) => m.id === 'mfixed')!;
  const mFlex = rbMix[0]!.microTasks.find((m) => m.id === 'mflex')!;
  assert(mFixed.scheduledStart!.getHours() === 17 && mFixed.scheduledStart!.getMinutes() === 0, 'fixed 5pm');
  assert(mFixed.scheduledEnd!.getHours() === 19, 'fixed 2h end');
  assert(!!mFlex.scheduledStart && !!mFlex.scheduledEnd, 'flex placed');
  if (
    mFlex.scheduledStart &&
    mFlex.scheduledEnd &&
    isSameDay(mFlex.scheduledStart, mFixed.scheduledStart!)
  ) {
    const o =
      mFlex.scheduledStart < mFixed.scheduledEnd! && mFlex.scheduledEnd > mFixed.scheduledStart!;
    assert(!o, 'flex does not overlap fixed same day');
  }

  console.log('— Global fixed shadow: exam task packs around another task’s fixed 5–7pm —');
  const dPaper = new Date(2026, 3, 11);
  const tExamFlex: Task = {
    id: 't-exam-flex',
    title: 'Rev block',
    dueDate: new Date(2026, 3, 14),
    priority: 'high',
    completed: false,
    createdAt: new Date(2026, 3, 10),
    estimatedTotalMinutes: 60,
    microTasks: [
      mkMicro('rev1', 't-exam-flex', 60, 1, {
        source: 'exam-planner',
        scheduledDate: dPaper,
      }),
    ],
  };
  const tMathFixed: Task = {
    id: 't-math-fixed',
    title: 'Math paper',
    dueDate: new Date(2026, 3, 14),
    priority: 'high',
    completed: false,
    createdAt: new Date(2026, 3, 10),
    estimatedTotalMinutes: 120,
    microTasks: [
      mkMicro('mp1', 't-math-fixed', 120, 1, {
        fixedSlot: true,
        scheduledStart: new Date(2026, 3, 11, 17, 0, 0),
        scheduledEnd: new Date(2026, 3, 11, 19, 0, 0),
        scheduledDate: dPaper,
      }),
    ],
  };
  const rbGlobal = rebalanceAllTaskSchedules({
    tasks: [tExamFlex, tMathFixed],
    calendarEvents: [],
    prefs: mkPrefs({ workStart: '08:00', workEnd: '21:30' }),
    from: new Date(2026, 3, 10, 12, 0, 0),
  });
  const revMt = rbGlobal.find((t) => t.id === 't-exam-flex')!.microTasks[0]!;
  assert(!!revMt.scheduledStart && !!revMt.scheduledEnd, 'exam flex placed');
  if (isSameDay(revMt.scheduledStart!, dPaper)) {
    const rs = revMt.scheduledStart!.getHours() * 60 + revMt.scheduledStart!.getMinutes();
    const re = revMt.scheduledEnd!.getHours() * 60 + revMt.scheduledEnd!.getMinutes();
    const fixedStart = 17 * 60;
    const fixedEnd = 19 * 60;
    assert(!(rs < fixedEnd && re > fixedStart), 'exam revision must not overlap fixed paper same day');
  }

  console.log('— prefs.noTaskSchedulingDates respected on rebalance —');
  const blockedKey = '2026-04-05';
  const fromBlocked = new Date(2026, 3, 3);
  const taskBlocked: Task = {
    id: 't-blk',
    title: 'Blocked-day test',
    dueDate: new Date(2026, 3, 8),
    priority: 'medium',
    completed: false,
    createdAt: fromBlocked,
    estimatedTotalMinutes: 30,
    microTasks: [mkMicro('b1', 't-blk', 30, 1)],
  };
  const rbBlocked = rebalanceAllTaskSchedules({
    tasks: [taskBlocked],
    calendarEvents: [],
    prefs: mkPrefs({ noTaskSchedulingDates: [blockedKey] }),
    from: fromBlocked,
  });
  const placedBlk = rbBlocked[0]!.microTasks[0]!;
  assert(!!placedBlk.scheduledStart && !!placedBlk.scheduledEnd, 'blocked prefs: still get a slot');
  assert(
    format(startOfDay(placedBlk.scheduledStart!), 'yyyy-MM-dd') !== blockedKey,
    'rebalance avoids noTaskSchedulingDates'
  );

  console.log('\nAll scheduling e2e checks passed.');
}

main();
