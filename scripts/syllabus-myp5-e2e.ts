/**
 * Full-pipeline check: real MYP5 syllabi → extract → multi-subject plan → calendar pack.
 * Run: npm run test:syllabus
 */
import { pathToFileURL } from 'node:url';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { MYP5_SYLLABI_ENTRIES } from './fixtures/myp5-syllabi';
import { extractSyllabusTopicsHeuristic } from '../lib/exam-syllabus-extract';
import { planMultiSubjectExamPrep, softDailyStudyCapMinutes, type SubjectPrepInput } from '../lib/exam-prep-schedule';
import { scheduleMicroTasksIntoTimesAdaptive } from '../lib/scheduler';
import type { CalendarEvent, MicroTask, SchedulePreferences, Task } from '../types';
import { parseLocalDateKey } from '../lib/local-date';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function mkPrefs(over: Partial<SchedulePreferences> = {}): SchedulePreferences {
  return {
    workStart: '08:00',
    workEnd: '22:00',
    defaultSessionMinutes: 45,
    breakMinutes: 10,
    bufferMinutes: 5,
    studyPace: 'balanced',
    gradeLevel: '10',
    ...over,
  };
}

const SYLLABI = MYP5_SYLLABI_ENTRIES;

function topicKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertTopicCoverage(rows: { topic: string }[], sessions: { topics: string[] }[], subject: string): void {
  const fromRows = new Set(rows.map((r) => topicKey(r.topic)));
  fromRows.delete('');
  const fromSessions = new Set<string>();
  for (const s of sessions) {
    for (const t of s.topics) {
      fromSessions.add(topicKey(t));
    }
  }
  const missing = [...fromRows].filter((k) => !fromSessions.has(k));
  assert(missing.length === 0, `${subject}: ${missing.length} topic(s) missing from plan: ${missing.slice(0, 5).join('; ')}`);
  assert(
    fromSessions.size >= fromRows.size,
    `${subject}: session topic count ${fromSessions.size} < row count ${fromRows.size}`
  );
}

function microsFromSessions(
  subject: string,
  taskId: string,
  examDay: Date,
  planned: { scheduledDate: Date; sectionTitle: string; topics: string[]; estimatedMinutes: number; order: number }[]
): MicroTask[] {
  const sessions = [...planned].sort((a, b) => a.order - b.order);
  return sessions.map((se, idx) => ({
    id: `${taskId}-m${idx}`,
    parentTaskId: taskId,
    title: `${subject} · ${format(startOfDay(se.scheduledDate), 'EEE MMM d')}${
      sessions.length > 1 ? ` (${idx + 1}/${sessions.length})` : ''
    }`,
    description: `${se.sectionTitle}\n${se.topics.map((t) => `- ${t}`).join('\n')}`,
    subtopics: se.topics,
    unitSectionLabel: se.sectionTitle,
    estimatedMinutes: se.estimatedMinutes,
    completed: false,
    order: idx + 1,
    source: 'exam-planner' as const,
    examId: '',
    examTopicKey: se.topics[0],
    scheduledDate: se.scheduledDate,
  }));
}

function main() {
  const planStart = new Date(2026, 3, 4);
  const prefs = mkPrefs();
  const dailyCap = softDailyStudyCapMinutes(prefs);

  console.log('— Syllabus extraction —');
  const queued = SYLLABI.map((s) => {
    const rows = extractSyllabusTopicsHeuristic(s.text, s.subject);
    console.log(`  ${s.subject}: ${rows.length} topics`);
    assert(rows.length > 0, `${s.subject}: no topics extracted`);
    return { ...s, rows };
  });

  const inputs: SubjectPrepInput[] = queued.map((s) => ({
    id: s.id,
    subject: s.subject,
    examName: `${s.subject} exam`,
    examDateKey: s.examDateKey,
    rows: s.rows,
  }));

  console.log('\n— Multi-subject plan —');
  const planned = planMultiSubjectExamPrep(inputs, prefs, planStart);
  assert(planned.length > 0, 'plan empty');

  const bySubject = new Map<string, typeof planned>();
  for (const p of planned) {
    if (!bySubject.has(p.subjectId)) bySubject.set(p.subjectId, []);
    bySubject.get(p.subjectId)!.push(p);
  }

  for (const s of queued) {
    const subsessions = bySubject.get(s.id) || [];
    subsessions.sort((a, b) => a.order - b.order);
    assert(subsessions.length > 0, `${s.subject}: no sessions`);
    assertTopicCoverage(s.rows, subsessions, s.subject);

    const examDay = startOfDay(parseLocalDateKey(s.examDateKey));
    const lastPrep =
      differenceInCalendarDays(examDay, startOfDay(planStart)) + 1 >= 3 ? startOfDay(addDays(examDay, -1)) : examDay;
    for (const se of subsessions) {
      const d = startOfDay(se.scheduledDate);
      assert(d.getTime() <= lastPrep.getTime(), `${s.subject}: session on ${format(d, 'yyyy-MM-dd')} after last prep`);
      assert(d.getTime() >= startOfDay(planStart).getTime(), `${s.subject}: session before plan start`);
    }
  }

  const byDay = new Map<string, number>();
  for (const p of planned) {
    const k = format(startOfDay(p.scheduledDate), 'yyyy-MM-dd');
    byDay.set(k, (byDay.get(k) ?? 0) + p.estimatedMinutes);
  }
  let overload = 0;
  for (const [k, load] of byDay) {
    if (load > dailyCap * 1.36) {
      overload++;
      console.warn(`  Heavy day ${k}: ${load} min (soft cap ~${dailyCap})`);
    }
  }
  assert(overload <= 3, `too many overloaded days: ${overload}`);

  console.log('\n— Per-subject calendar pack (sequential tasks, empty calendar) —');
  const todayStart = startOfDay(planStart);
  let createdTasks: Task[] = [];
  let totalUnscheduled = 0;

  for (const s of queued) {
    const subsessions = (bySubject.get(s.id) || []).sort((a, b) => a.order - b.order);
    const examDay = startOfDay(parseLocalDateKey(s.examDateKey));
    const lastSchedDay =
      differenceInCalendarDays(examDay, todayStart) + 1 >= 3 ? startOfDay(addDays(examDay, -1)) : examDay;
    const taskId = `task-${s.id}`;
    const microTasks = microsFromSessions(s.subject, taskId, examDay, subsessions);

    const pack = scheduleMicroTasksIntoTimesAdaptive({
      microTasks,
      startDay: todayStart,
      dueDay: examDay,
      prefs,
      calendarEvents: [],
      existingTasks: createdTasks,
    });

    totalUnscheduled += pack.unscheduled.length;
    const allPlaced = [...pack.scheduled, ...pack.unscheduled];
    assert(
      allPlaced.length >= microTasks.length,
      `${s.subject}: lost microtasks (${allPlaced.length} vs ${microTasks.length})`
    );

    const task: Task = {
      id: taskId,
      title: `${s.subject} exam prep`,
      dueDate: examDay,
      priority: 'high',
      subject: s.subject,
      microTasks: allPlaced.map((mt, idx) => ({ ...mt, order: idx + 1 })),
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: allPlaced.reduce((a, m) => a + m.estimatedMinutes, 0),
    };
    createdTasks = [...createdTasks, task];

    for (const mt of allPlaced) {
      if (mt.scheduledStart && mt.scheduledEnd) {
        const d = startOfDay(mt.scheduledStart);
        assert(d.getTime() <= lastSchedDay.getTime(), `${s.subject}: block after last sched day`);
      }
    }
    console.log(
      `  ${s.subject}: ${pack.scheduled.length} timed, ${pack.unscheduled.length} unscheduled, expanded=${pack.expanded}`
    );
  }

  assert(totalUnscheduled === 0, `unscheduled blocks remain: ${totalUnscheduled}`);

  console.log('\n— Reset / second pass (simulate delete all & re-import) —');
  createdTasks = [];
  totalUnscheduled = 0;
  const planned2 = planMultiSubjectExamPrep(inputs, prefs, planStart);
  assert(planned2.length === planned.length, 'second plan length mismatch');

  for (const s of queued) {
    const subsessions = planned2.filter((p) => p.subjectId === s.id).sort((a, b) => a.order - b.order);
    assertTopicCoverage(s.rows, subsessions, s.subject + ' (pass 2)');
    const examDay = startOfDay(parseLocalDateKey(s.examDateKey));
    const taskId = `task2-${s.id}`;
    const microTasks = microsFromSessions(s.subject, taskId, examDay, subsessions);
    const pack = scheduleMicroTasksIntoTimesAdaptive({
      microTasks,
      startDay: todayStart,
      dueDay: examDay,
      prefs,
      calendarEvents: [],
      existingTasks: createdTasks,
    });
    totalUnscheduled += pack.unscheduled.length;
    const allPlaced = [...pack.scheduled, ...pack.unscheduled];
    createdTasks.push({
      id: taskId,
      title: `${s.subject} exam prep`,
      dueDate: examDay,
      priority: 'high',
      subject: s.subject,
      microTasks: allPlaced.map((mt, idx) => ({ ...mt, order: idx + 1 })),
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: allPlaced.reduce((a, m) => a + m.estimatedMinutes, 0),
    });
  }
  assert(totalUnscheduled === 0, `pass 2 unscheduled: ${totalUnscheduled}`);

  console.log('\n— Messy multi-line chemistry (user-style paste) —');
  const messyChem = `Chemistry: Periodic table (metals and nonmetals; transition metals, noble
gases, trends, periods, groups)
• International Union of Pure and
Applied Chemistry (IUPAC
naming and classification of:
alkanes, alkenes, alcohols,
carboxylic acids and esters;
structural formulas)
• The atmosphere (characteristics of gases; atmospheric composition,
testing and treatment; extraction,
emission and environmental implications)`;
  const messyRows = extractSyllabusTopicsHeuristic(messyChem, 'Chemistry');
  assert(messyRows.length >= 4, `messy chemistry: expected ≥4 topics, got ${messyRows.length}`);

  console.log('\n— Exam pack with weekly calendar conflict (Wed soccer) —');
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
  const eng = queued.find((q) => q.subject === 'English')!;
  const engSessions = (bySubject.get(eng.id) || []).sort((a, b) => a.order - b.order);
  const engExam = startOfDay(parseLocalDateKey(eng.examDateKey));
  const engMicros = microsFromSessions('English', 'task-wed-test', engExam, engSessions);
  const wedPack = scheduleMicroTasksIntoTimesAdaptive({
    microTasks: engMicros,
    startDay: todayStart,
    dueDay: engExam,
    prefs,
    calendarEvents: [wedBlock],
    existingTasks: [],
  });
  const soccerStartMin = 17 * 60;
  const soccerEndMin = 18 * 60;
  for (const mt of [...wedPack.scheduled, ...wedPack.unscheduled]) {
    const ss = mt.scheduledStart;
    const se = mt.scheduledEnd;
    if (!ss || !se || ss.getDay() !== 3) continue;
    const a = ss.getHours() * 60 + ss.getMinutes();
    const b = se.getHours() * 60 + se.getMinutes();
    const overlapsSoccer = a < soccerEndMin && b > soccerStartMin;
    assert(!overlapsSoccer, 'English prep must not overlap weekly soccer (Wed 17:00–18:00)');
  }

  console.log('\nAll MYP5 syllabus e2e checks passed.');
}

function isExecutedDirectly(): boolean {
  try {
    const a = import.meta.url;
    const b = pathToFileURL(process.argv[1] ?? '').href;
    return a === b;
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) main();
