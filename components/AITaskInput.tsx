'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, X, Check, HelpCircle, MessageSquareWarning } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task, MicroTask, CalendarEvent, SchedulePreferences } from '@/types';
import { useFeedback } from '@/components/FeedbackProvider';
import { mergeSchedulePackOptions, scheduleMicroTasksIntoTimesAdaptive } from '@/lib/scheduler';
import { makeId } from '@/lib/ids';
import { parseCalendarDate, parseLocalDateKey } from '@/lib/local-date';
import {
  buildFixedWallClockSlotForDueDay,
  extractDurationMinutesFromUserText,
  extractSlotEarliestMinutesFromUserText,
  resolveTitleFromUserText,
  normalizeSchedulingUserText,
} from '@/lib/ai-task-text-parse';
import { parseSkipTodayScheduling, parseTodayBudgetMinutes } from '@/lib/today-budget-parse';

import type { ParsedScheduleMetadata } from '@/lib/parse-schedule-metadata';
import { workWindowMinutesForLocalDay } from '@/lib/work-window';

interface AITaskInputProps {
  onTaskCreated?: () => void;
  /** Slim chrome for sidebar / drawer: icon-only help & report. */
  variant?: 'default' | 'nav';
}

type ParsedTaskResponse =
  | {
    success: boolean;
    kind: 'task';
    /** Groq-first scheduling intent; echoed when the API returns it. */
    scheduleMetadata?: ParsedScheduleMetadata;
    sourceSpan?: string;
    title: string;
    description?: string | null;
    dueDate: string; // YYYY-MM-DD
    priority: 'low' | 'medium' | 'high';
    subject?: string | null;
    estimatedHours: number;
    sessionStyle: 'single_block' | 'multi_step';
    sessionMinutes?: number;
    sessionCount?: number;
    minutesPerSession?: number;
  }
  | {
    success: boolean;
    kind: 'event';
    scheduleMetadata?: ParsedScheduleMetadata;
    sourceSpan?: string;
    title: string;
    description?: string | null;
    startDate: string; // YYYY-MM-DD
    startTime: string | null; // HH:mm
    endTime: string | null; // HH:mm
    durationMinutes?: number | null;
    allDay: boolean;
    eventType: CalendarEvent['eventType'];
    repeat: null | {
      frequency: 'weekly';
      interval: number;
      daysOfWeek: number[];
      endDate?: string;
    };
  }
  | {
    success: boolean;
    kind: 'study_plan';
    scheduleMetadata?: ParsedScheduleMetadata;
    sourceSpan?: string;
    /** Server-derived cadence hint for the heuristic packer (daily, alternate, custom_cycle, specific_days, unspecified). */
    schedulePattern?: string;
    patternCycleLength?: number | null;
    /** Model-supplied subject cycle when the plan rotates themes by day. */
    rotationSubjects?: string[];
    summary: string;
    truncated?: boolean;
    tasks: Array<{
      title: string;
      description?: string | null;
      subject?: string | null;
      dueDate: string;
      priority: 'low' | 'medium' | 'high';
      microTasks: Array<{
        title: string;
        description?: string;
        estimatedMinutes: number;
        scheduledDate: string;
      }>;
      estimatedTotalMinutes?: number;
    }>;
  };

type ParseTaskMeta = {
  modelRoot?: unknown | null;
  normalizedCount?: number;
};

type ParsedTaskApiEnvelope =
  | (ParsedTaskResponse & { _meta?: ParseTaskMeta })
  | { success: true; batch: true; items: ParsedTaskResponse[]; _meta?: ParseTaskMeta };


type PreviewPlanTask = {
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  subject?: string;
  microTasks: MicroTask[];
  estimatedTotalMinutes: number;
};

const AI_CREATOR_DRAFT_KEY = 'focusflow-ai-creator-draft';

// ── Smart task breakdown: workflow-aware step generation ──

type WorkflowType = 'writing' | 'stem' | 'creative' | 'reading' | 'language' | 'generic';

function inferWorkflowType(title: string, description: string): WorkflowType {
  const blob = `${title} ${description}`.toLowerCase();
  if (/\b(essay|report|lab[\s-]?report|paper|dissertation|coursework|article|write[\s-]?up|thesis|narrative|analysis essay|comparative|argumentative|persuasive|expository)\b/.test(blob)) return 'writing';
  if (/\b(math|maths|physics|chemistry|biology|calcul|equation|problem[\s-]?set|exercise|formula|proof|theorem|integration|differentiation|algebra|geometry|trigonometry|statistics|vectors|mechanics|kinematics|stoichiometr|titration|concepts?|understand|chapter|unit|topic|theory|revise)\b/.test(blob)) return 'stem';
  if (/\b(project|presentation|poster|prototype|build|design|experiment|model|portfolio|artwork|composition|film|video|animation|coding|programming|app|website)\b/.test(blob)) return 'creative';
  if (/\b(read|chapter|novel|textbook|reading|annotate|notes?\s+on|summary|summarize|review\s+chapter)\b/.test(blob)) return 'reading';
  if (/\b(french|spanish|german|mandarin|arabic|hindi|japanese|korean|italian|portuguese|vocabulary|grammar|conjugat|translation|oral|speaking|listening|comprehension|language)\b/.test(blob)) return 'language';
  return 'generic';
}

type WorkflowPhase = { title: string; description?: string; minutes: number };

function compactTaskTitle(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(?:by|before|until|till|due)\b[\s\S]*$/i, '')
    .replace(/\s+(?:have\s+to|need\s+to)\b[\s\S]*$/i, '')
    .replace(/^\s*\d+\s+/i, '')
    .trim();
  if (!cleaned) return raw.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

type RepeatedSessionConstraint = {
  count: number;
  minutesPerSession: number;
  oneGo: boolean;
};

function inferRepeatedSessionConstraint(text: string): RepeatedSessionConstraint | null {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  const mins = extractDurationMinutesFromUserText(t);
  if (mins == null || mins < 10) return null;

  const wordToCount = (s: string): number | null => {
    const map: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      dozen: 12,
      couple: 2,
      few: 3,
    };
    const k = s.trim().toLowerCase();
    return map[k] ?? null;
  };

  const countPatterns = [
    /\b(\d{1,3})\s*x\b/i,
    /\b(\d{1,3})\s+times?\b/i,
    /\b(\d{1,3})\s+(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?|exams?|questions?|problems?)\b/i,
    /\b(\d{1,3})\s+(?:\w+\s+){0,4}?(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?|exams?|questions?|problems?)\b/i,
    /\bhave\s+(\d{1,3})\b/i,
  ] as const;
  let count: number | null = null;
  for (const p of countPatterns) {
    const m = t.match(p);
    if (!m) continue;
    const n = Math.round(Number(m[1]));
    if (Number.isFinite(n) && n >= 2 && n <= 200) {
      count = n;
      break;
    }
  }
  if (count == null) {
    const wordCountPatterns = [
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|couple|few)\s+(?:x|times?)\b/i,
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|couple|few)\s+(?:\w+\s+){0,4}?(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?|exams?|questions?|problems?)\b/i,
    ] as const;
    for (const p of wordCountPatterns) {
      const m = t.match(p);
      if (!m) continue;
      const n = wordToCount(m[1] || '');
      if (n != null && n >= 2 && n <= 200) {
        count = n;
        break;
      }
    }
  }
  if (count == null) return null;

  const perItemCue = /\b(each|every|per)\b/i.test(t) || /\bone\s+by\s+one\b/i.test(t);
  const oneGo = /\b(one\s+go|one\s+sitting|single\s+sitting|in\s+one\s+shot|uninterrupted)\b/i.test(t);
  const hasDeadlineCue = /\b(by|before|until|due|deadline|no\s+later\s+than)\b/i.test(t);
  if (!hasDeadlineCue || (!perItemCue && !oneGo)) return null;

  return {
    count,
    minutesPerSession: Math.max(10, Math.min(8 * 60, Math.round(mins))),
    oneGo,
  };
}

function inferRepeatedUnitLabel(text: string): string {
  const t = normalizeSchedulingUserText(text).toLowerCase();
  if (/\bpapers?\b/.test(t)) return 'Paper';
  if (/\bquestions?\b/.test(t)) return 'Question set';
  if (/\bproblems?\b/.test(t)) return 'Problem set';
  if (/\bexams?\b/.test(t)) return 'Exam session';
  if (/\bessay|essays|report|reports|coursework\b/.test(t)) return 'Writing session';
  return 'Session';
}

function getWorkflowPhases(
  workflow: WorkflowType,
  totalMinutes: number,
  sessionPref: number
): WorkflowPhase[] {
  const clamp = (min: number, val: number, max: number) => Math.max(min, Math.min(max, Math.round(val)));

  // Phase templates with relative weights (proportional time allocation)
  const templates: Record<WorkflowType, Array<{ title: string; desc?: string; weight: number }>> = {
    writing: [
      { title: 'Research & gather sources', desc: 'Find key references and evidence', weight: 0.20 },
      { title: 'Build outline', desc: 'Structure argument / thesis', weight: 0.12 },
      { title: 'Write first draft', desc: 'Get ideas down, do not edit yet', weight: 0.32 },
      { title: 'Revise & refine', desc: 'Strengthen argument flow, fill gaps', weight: 0.20 },
      { title: 'Edit & proofread', desc: 'Grammar, citations, formatting', weight: 0.16 },
    ],
    stem: [
      { title: 'Review concepts & theory', desc: 'Re-read notes / textbook section', weight: 0.20 },
      { title: 'Work through examples', desc: 'Follow worked solutions step by step', weight: 0.20 },
      { title: 'Practice problems', desc: 'Independent problem-solving', weight: 0.30 },
      { title: 'Review mistakes', desc: 'Check answers, understand errors', weight: 0.15 },
      { title: 'Timed drill', desc: 'Exam-speed problem set', weight: 0.15 },
    ],
    creative: [
      { title: 'Plan & brainstorm', desc: 'Define scope, gather inspiration', weight: 0.15 },
      { title: 'Build core work', desc: 'Create the main deliverable', weight: 0.35 },
      { title: 'Develop details', desc: 'Complete remaining sections', weight: 0.25 },
      { title: 'Test & iterate', desc: 'Review, fix issues, get feedback', weight: 0.15 },
      { title: 'Polish & finalize', desc: 'Final touches and submission prep', weight: 0.10 },
    ],
    reading: [
      { title: 'Active reading pass', desc: 'Read and highlight key points', weight: 0.40 },
      { title: 'Take notes', desc: 'Summarize main ideas in own words', weight: 0.30 },
      { title: 'Review & connect', desc: 'Link to prior knowledge, answer questions', weight: 0.30 },
    ],
    language: [
      { title: 'Vocabulary review', desc: 'Flashcards / key terms', weight: 0.20 },
      { title: 'Grammar practice', desc: 'Exercises on target structures', weight: 0.25 },
      { title: 'Reading / listening', desc: 'Comprehension practice', weight: 0.25 },
      { title: 'Writing / speaking', desc: 'Produce output in target language', weight: 0.30 },
    ],
    generic: [
      { title: 'Plan the work', desc: 'Review requirements, set goals', weight: 0.12 },
      { title: 'Focused work block 1', weight: 0.30 },
      { title: 'Focused work block 2', weight: 0.30 },
      { title: 'Review & improve', desc: 'Check quality, fill gaps', weight: 0.15 },
      { title: 'Finalize', desc: 'Final check and submit', weight: 0.13 },
    ],
  };

  const template = templates[workflow];

  // For very short tasks (< 40 min), use fewer steps
  if (totalMinutes < 40) {
    return [{ title: template[0]!.title, minutes: Math.round(totalMinutes * 0.4) },
    { title: template[template.length - 1]!.title, minutes: Math.round(totalMinutes * 0.6) }]
      .filter(p => p.minutes >= 10);
  }

  // For medium tasks, maybe skip some steps
  let phases = [...template];
  if (totalMinutes < 80 && phases.length > 3) {
    // Keep first, middle, last
    phases = [phases[0]!, phases[Math.floor(phases.length / 2)]!, phases[phases.length - 1]!];
    const w = 1 / phases.length;
    phases = phases.map(p => ({ ...p, weight: w }));
  }

  // Distribute minutes proportionally
  const totalWeight = phases.reduce((s, p) => s + p.weight, 0);
  const result: WorkflowPhase[] = phases.map(p => ({
    title: p.title,
    description: p.desc,
    minutes: clamp(10, (p.weight / totalWeight) * totalMinutes, totalMinutes * 0.5),
  }));

  // Normalize so they sum to totalMinutes
  const sum = result.reduce((s, p) => s + p.minutes, 0);
  if (sum !== totalMinutes && result.length > 0) {
    const diff = totalMinutes - sum;
    // Add/subtract from the largest phase
    const largest = result.reduce((a, b) => a.minutes >= b.minutes ? a : b);
    largest.minutes = Math.max(10, largest.minutes + diff);
  }

  return result;
}

function contextualizeWorkflowPhases(
  title: string,
  workflow: WorkflowType,
  phases: WorkflowPhase[]
): WorkflowPhase[] {
  const short = compactTaskTitle(title).slice(0, 80);
  if (!short) return phases;
  if (workflow === 'writing') {
    return phases.map((p) => {
      if (/research/i.test(p.title)) return { ...p, title: `Research sources for ${short}` };
      if (/outline/i.test(p.title)) return { ...p, title: `Build outline for ${short}` };
      if (/first draft|write/i.test(p.title)) return { ...p, title: `Write draft of ${short}` };
      if (/revise|refine/i.test(p.title)) return { ...p, title: `Revise ${short}` };
      if (/edit|proofread/i.test(p.title)) return { ...p, title: `Edit and proofread ${short}` };
      return p;
    });
  }
  if (workflow === 'generic') {
    return phases.map((p) => {
      if (/focused work block/i.test(p.title)) return { ...p, title: `${p.title}: ${short}` };
      if (/finalize/i.test(p.title)) return { ...p, title: `Finalize ${short}` };
      return p;
    });
  }
  return phases;
}

function buildPreviewStudyPlan(
  plan: Extract<ParsedTaskResponse, { kind: 'study_plan' }>,
  schedulePreferences: SchedulePreferences,
  calendarEvents: CalendarEvent[],
  baseTasks: Task[],
  userInstruction?: string
): { summary: string; truncated?: boolean; tasks: PreviewPlanTask[] } {
  const slotEarliest =
    userInstruction != null ? extractSlotEarliestMinutesFromUserText(userInstruction) : null;
  const packOptions = mergeSchedulePackOptions(
    schedulePreferences,
    slotEarliest != null ? { slotEarliestMinutes: slotEarliest } : undefined
  );
  let existing = [...baseTasks];
  const built: PreviewPlanTask[] = [];

  for (const t of plan.tasks) {
    const dueDay = parseCalendarDate(t.dueDate);
    const previewMicroTasks: MicroTask[] = t.microTasks.map((m, idx) => ({
      id: `preview-${idx}`,
      parentTaskId: 'preview',
      title: m.title,
      description: m.description,
      estimatedMinutes: Math.max(10, Math.min(480, Math.round(Number(m.estimatedMinutes)) || 45)),
      completed: false,
      order: idx + 1,
      scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(String(m.scheduledDate || ''))
        ? parseLocalDateKey(m.scheduledDate)
        : undefined,
    }));

    const scheduledTimes = scheduleMicroTasksIntoTimesAdaptive({
      microTasks: previewMicroTasks,
      startDay: new Date(),
      dueDay,
      prefs: schedulePreferences,
      calendarEvents,
      existingTasks: existing,
      options: packOptions,
    });

    const previewWithTimes: MicroTask[] = [
      ...scheduledTimes.scheduled,
      ...scheduledTimes.unscheduled,
    ].map((mt, i) => ({
      ...mt,
      order: mt.order ?? i + 1,
      scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
    }));

    const sumMin = previewWithTimes.reduce((a, m) => a + m.estimatedMinutes, 0);
    const tempId = makeId('preview-synth');
    const collisionTask: Task = {
      id: tempId,
      title: t.title,
      description: t.description ?? undefined,
      dueDate: dueDay,
      priority: t.priority,
      subject: t.subject ?? undefined,
      microTasks: previewWithTimes.map((mt) => ({ ...mt, parentTaskId: tempId })),
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: sumMin,
    };
    existing.push(collisionTask);

    built.push({
      title: t.title,
      description: t.description ?? undefined,
      dueDate: dueDay,
      priority: t.priority,
      subject: t.subject ?? undefined,
      microTasks: previewWithTimes,
      estimatedTotalMinutes: sumMin,
    });
  }

  return { summary: plan.summary, truncated: plan.truncated, tasks: built };
}

function previewPlanTaskToShadowTask(pt: PreviewPlanTask): Task {
  const taskId = makeId('shadow-plan');
  return {
    id: taskId,
    title: pt.title,
    description: pt.description,
    dueDate: pt.dueDate,
    priority: pt.priority,
    subject: pt.subject,
    microTasks: pt.microTasks.map((mt, idx) => ({
      ...mt,
      id: makeId(`shadow-m-${idx}`),
      parentTaskId: taskId,
      order: idx + 1,
      completed: false,
    })),
    completed: false,
    createdAt: new Date(),
    estimatedTotalMinutes: pt.estimatedTotalMinutes,
  };
}

function singleBlockPreviewToShadowTask(
  preview: {
    title: string;
    description?: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
    microTasks: MicroTask[];
    estimatedTotalMinutes: number;
  }
): Task {
  const taskId = makeId('shadow-task');
  return {
    id: taskId,
    title: preview.title,
    description: preview.description,
    dueDate: preview.dueDate,
    priority: preview.priority,
    subject: preview.subject,
    microTasks: preview.microTasks.map((mt, idx) => ({
      ...mt,
      id: makeId(`shadow-tm-${idx}`),
      parentTaskId: taskId,
      order: idx + 1,
      completed: false,
    })),
    completed: false,
    createdAt: new Date(),
    estimatedTotalMinutes: preview.estimatedTotalMinutes,
  };
}

type BatchPreviewTaskEntry = {
  type: 'task';
  preview: {
    title: string;
    description?: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
    microTasks: MicroTask[];
    estimatedTotalMinutes: number;
    sessionStyle?: 'single_block' | 'multi_step';
  };
  sourceSpan: string;
};

type BatchPreviewStudyPlanEntry = {
  type: 'study_plan';
  summary: string;
  truncated?: boolean;
  tasks: PreviewPlanTask[];
  sourceSpan: string;
};

type BatchPreviewEventEntry = {
  type: 'event';
  parsed: Extract<ParsedTaskResponse, { kind: 'event' }>;
  taskText: string;
  sourceSpan: string;
};

type BatchPreviewEntry = BatchPreviewTaskEntry | BatchPreviewStudyPlanEntry | BatchPreviewEventEntry;

function aiParsedEventTimes(
  parsed: Extract<ParsedTaskResponse, { kind: 'event' }>,
  schedulePreferences: SchedulePreferences
): { start: Date; end: Date; allDay: boolean; repeat?: CalendarEvent['repeat'] } {
  const startDate = parseLocalDateKey(parsed.startDate);
  const workStartMin = workWindowMinutesForLocalDay(schedulePreferences, startDate).startMin;
  const toDateTime = (d: Date, hhmm: string | null, fallbackMinutesFromMidnight: number) => {
    const base = new Date(d);
    base.setHours(0, 0, 0, 0);
    if (!hhmm) {
      base.setHours(0, 0, 0, 0);
      base.setMinutes(fallbackMinutesFromMidnight);
      return base;
    }
    const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
    base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    return base;
  };

  const start = parsed.allDay
    ? parseLocalDateKey(parsed.startDate)
    : toDateTime(
      startDate,
      parsed.startTime && parsed.startTime.trim() ? parsed.startTime : null,
      workStartMin
    );

  let end: Date;
  if (parsed.allDay) {
    end = parseLocalDateKey(parsed.startDate);
  } else if (parsed.endTime && parsed.endTime.trim()) {
    end = toDateTime(startDate, parsed.endTime, workStartMin + 60);
  } else if (parsed.durationMinutes != null && parsed.durationMinutes > 0) {
    end = new Date(start.getTime() + parsed.durationMinutes * 60_000);
  } else {
    end = new Date(start.getTime() + 60 * 60_000);
  }
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 60 * 60_000);
  }

  const repeatEnd =
    parsed.repeat?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.repeat.endDate)
      ? parseLocalDateKey(parsed.repeat.endDate)
      : undefined;

  const repeat: CalendarEvent['repeat'] | undefined = parsed.repeat
    ? {
      frequency: 'weekly',
      interval: parsed.repeat.interval ?? 1,
      daysOfWeek: parsed.repeat.daysOfWeek,
      ...(repeatEnd ? { endDate: repeatEnd } : {}),
    }
    : undefined;

  return { start, end, allDay: parsed.allDay, repeat };
}

function shadowCalendarEventFromParsed(
  parsed: Extract<ParsedTaskResponse, { kind: 'event' }>,
  schedulePreferences: SchedulePreferences,
  id: string
): CalendarEvent {
  const { start, end, allDay, repeat } = aiParsedEventTimes(parsed, schedulePreferences);
  const now = new Date();
  return {
    id,
    title: parsed.title || 'Event',
    description: parsed.description ?? undefined,
    start,
    end,
    allDay,
    eventType: parsed.eventType || 'class',
    color: '#B0AEA5',
    repeat,
    createdAt: now,
    updatedAt: now,
  };
}

function pushCalendarEventFromParsed(
  parsed: Extract<ParsedTaskResponse, { kind: 'event' }>,
  schedulePreferences: SchedulePreferences,
  taskText: string,
  sourceSpan: string,
  addCalendarEvent: (e: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void
) {
  const { start, end, allDay, repeat } = aiParsedEventTimes(parsed, schedulePreferences);

  addCalendarEvent({
    title: resolveTitleFromUserText(sourceSpan || taskText, parsed.title),
    description: parsed.description ?? undefined,
    start,
    end,
    allDay,
    eventType: parsed.eventType || 'class',
    color:
      parsed.eventType === 'class'
        ? '#6A9BCC'
        : parsed.eventType === 'meeting'
          ? '#141413'
          : parsed.eventType === 'study'
            ? '#788C5D'
            : '#D97757',
    repeat,
    location: undefined,
  });
}

export default function AITaskInput({ onTaskCreated, variant = 'default' }: AITaskInputProps) {
  const { openFeedback } = useFeedback();
  const {
    tasks,
    exams,
    addTask,
    calendarEvents,
    addCalendarEvent,
    schedulePreferences,
    rebalanceWithTodayBudget,
    rebalanceSchedule,
    skipWorkDaysAndRebalance,
  } = useStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [sharedAiMeta, setSharedAiMeta] = useState<{
    limit: number;
    used: number;
    byok: boolean;
  } | null>(null);
  const [previewTask, setPreviewTask] = useState<{
    title: string;
    description?: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
    microTasks: MicroTask[];
    estimatedTotalMinutes: number;
    sessionStyle?: 'single_block' | 'multi_step';
  } | null>(null);
  const [previewPlan, setPreviewPlan] = useState<{
    summary: string;
    truncated?: boolean;
    tasks: PreviewPlanTask[];
  } | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchPreviewEntry[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshGeminiHealth = useCallback(() => {
    void fetch('/api/gemini', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(
        (d: {
          configured?: boolean;
          message?: string;
          sharedAi?: { limit: number; used: number; byok: boolean } | null;
        }) => {
          setApiConfigured(!!d.configured);
          setApiMessage(d.message || null);
          setSharedAiMeta(d.sharedAi ?? null);
        }
      )
      .catch(() => {
        setApiConfigured(false);
        setApiMessage("We couldn't verify the AI connection. Check your network or try again.");
        setSharedAiMeta(null);
      });
  }, []);

  useEffect(() => {
    refreshGeminiHealth();
  }, [refreshGeminiHealth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(AI_CREATOR_DRAFT_KEY);
    if (saved) setInput(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!input.trim()) {
      window.sessionStorage.removeItem(AI_CREATOR_DRAFT_KEY);
      return;
    }
    window.sessionStorage.setItem(AI_CREATOR_DRAFT_KEY, input);
  }, [input]);

  const parseNaturalLanguage = async (text: string) => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parseTask',
          text,
        }),
      });

      if (!response.ok) {
        let msg = 'Failed to parse task';
        let code: string | undefined;
        try {
          const errJson = (await response.json()) as {
            error?: string;
            message?: string;
            code?: string;
          };
          if (errJson?.message) msg = errJson.message;
          else if (errJson?.error) msg = errJson.error;
          code = errJson?.code;
        } catch {
          // ignore
        }
        const err = new Error(msg) as Error & { code?: string };
        if (code) err.code = code;
        throw err;
      }

      const data = (await response.json()) as ParsedTaskApiEnvelope;
      return data;
    } catch (error) {
      console.error('Error parsing task:', error);
      throw error;
    }
  };

  async function handleSubmit(text?: string) {
    const taskText = normalizeSchedulingUserText(text || input.trim());
    if (!taskText) return;

    const budgetMinutes = parseTodayBudgetMinutes(taskText);
    if (budgetMinutes != null) {
      rebalanceWithTodayBudget(budgetMinutes);
      alert(
        `Done — about ${budgetMinutes} minutes kept free for you today. The rest of your open tasks were reshuffled around your calendar.`
      );
      setInput('');
      return;
    }

    if (parseSkipTodayScheduling(taskText)) {
      skipWorkDaysAndRebalance([new Date()]);
      alert(
        'Today is marked as a no-study day for scheduling. Open steps that were on today were cleared and repacked on other days before their deadlines.'
      );
      setInput('');
      return;
    }

    if (apiConfigured !== true) {
      return;
    }

    setIsProcessing(true);
    setInput('');
    setBatchPreview(null);
    setPreviewPlan(null);
    setPreviewTask(null);

    try {
      const rawApi = await parseNaturalLanguage(taskText);
      let items: ParsedTaskResponse[];
      if ('batch' in rawApi && rawApi.batch && Array.isArray(rawApi.items)) {
        items = rawApi.items;
      } else {
        const full = { ...(rawApi as Record<string, unknown>) };
        delete full._meta;
        // Server is now the single source of truth — no client-side heuristic overrides
        items = [{ ...full, success: true } as ParsedTaskResponse];
      }

      let shadowTasks = [...tasks];
      let shadowCal = [...calendarEvents];
      const entries: BatchPreviewEntry[] = [];

      for (const parsed of items) {
        const span = (parsed.sourceSpan && parsed.sourceSpan.trim()) || taskText;

        if (parsed.kind === 'study_plan') {
          const built = buildPreviewStudyPlan(parsed, schedulePreferences, shadowCal, shadowTasks, span);
          for (const pt of built.tasks) {
            shadowTasks.push(previewPlanTaskToShadowTask(pt));
          }
          entries.push({
            type: 'study_plan',
            summary: built.summary,
            truncated: built.truncated,
            tasks: built.tasks,
            sourceSpan: span,
          });
          continue;
        }

        if (parsed.kind === 'event') {
          entries.push({ type: 'event', parsed, taskText, sourceSpan: span });
          shadowCal.push(shadowCalendarEventFromParsed(parsed, schedulePreferences, makeId('shadow-cal')));
          continue;
        }

        // ── TASK (single_block or multi_step) ──
        const slotEarliestPack = extractSlotEarliestMinutesFromUserText(span);
        const taskPackOptions = mergeSchedulePackOptions(
          schedulePreferences,
          slotEarliestPack != null ? { slotEarliestMinutes: slotEarliestPack } : undefined
        );

        const aiSessionCount = Number((parsed as Extract<ParsedTaskResponse, { kind: 'task' }>).sessionCount);
        const aiMinutesPerSession = Number((parsed as Extract<ParsedTaskResponse, { kind: 'task' }>).minutesPerSession);
        const repeatedConstraintFromAI =
          Number.isFinite(aiSessionCount) && aiSessionCount > 1
            ? {
              count: Math.round(aiSessionCount),
              minutesPerSession: Math.max(
                10,
                Math.min(
                  8 * 60,
                  Number.isFinite(aiMinutesPerSession) && aiMinutesPerSession > 0
                    ? Math.round(aiMinutesPerSession)
                    : Math.round((parsed.estimatedHours || 2) * 60 / Math.round(aiSessionCount))
                )
              ),
              oneGo: true,
            }
            : null;
        const repeatedConstraint = repeatedConstraintFromAI ?? inferRepeatedSessionConstraint(span);
        if (parsed.sessionStyle === 'single_block' && repeatedConstraint) {
          const dueDay = parseCalendarDate(parsed.dueDate);
          const baseTitle = compactTaskTitle(resolveTitleFromUserText(span, parsed.title));
          const unitBase = inferRepeatedUnitLabel(span);
          const previewMicroTasks: MicroTask[] = Array.from({ length: repeatedConstraint.count }, (_, idx) => ({
            id: `preview-${idx}`,
            parentTaskId: 'preview',
            title: `${unitBase} ${idx + 1}`,
            description: repeatedConstraint.oneGo
              ? `Complete in one sitting (${repeatedConstraint.minutesPerSession} min).`
              : `Focused session (${repeatedConstraint.minutesPerSession} min).`,
            estimatedMinutes: repeatedConstraint.minutesPerSession,
            completed: false,
            order: idx + 1,
          }));
          const scheduledTimes = scheduleMicroTasksIntoTimesAdaptive({
            microTasks: previewMicroTasks,
            startDay: new Date(),
            dueDay,
            prefs: schedulePreferences,
            calendarEvents: shadowCal,
            existingTasks: shadowTasks,
            options: taskPackOptions,
          });
          const previewWithTimes: MicroTask[] = [
            ...scheduledTimes.scheduled,
            ...scheduledTimes.unscheduled,
          ].map((mt, i) => ({
            ...mt,
            order: mt.order ?? i + 1,
            scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
          }));
          const totalMins = repeatedConstraint.count * repeatedConstraint.minutesPerSession;
          const preview = {
            title: baseTitle,
            description: parsed.description ?? undefined,
            dueDate: dueDay,
            priority: parsed.priority || 'medium',
            subject: parsed.subject ?? undefined,
            microTasks: previewWithTimes,
            estimatedTotalMinutes: totalMins,
            sessionStyle: 'multi_step' as const,
          };
          shadowTasks.push(singleBlockPreviewToShadowTask(preview));
          entries.push({ type: 'task', preview, sourceSpan: span });
          continue;
        }

        if (parsed.sessionStyle === 'single_block') {
          const textMins = extractDurationMinutesFromUserText(span);
          const mins = Math.max(
            10,
            Math.min(
              8 * 60,
              textMins ??
              parsed.sessionMinutes ??
              Math.round((parsed.estimatedHours || 1) * 60)
            )
          );
          const displayTitle = compactTaskTitle(resolveTitleFromUserText(span, parsed.title));
          const dueDay = parseCalendarDate(parsed.dueDate);
          const fixedClock = buildFixedWallClockSlotForDueDay(span, dueDay, mins);

          let previewWithTimes: MicroTask[];
          if (fixedClock) {
            const sd = new Date(fixedClock.scheduledStart);
            sd.setHours(0, 0, 0, 0);
            previewWithTimes = [
              {
                id: 'preview-0',
                parentTaskId: 'preview',
                title: displayTitle,
                description: parsed.description ?? undefined,
                estimatedMinutes: mins,
                completed: false,
                order: 1,
                scheduledDate: sd,
                scheduledStart: fixedClock.scheduledStart,
                scheduledEnd: fixedClock.scheduledEnd,
                fixedSlot: true,
              },
            ];
          } else {
            const previewMicroTasks: MicroTask[] = [
              {
                id: 'preview-0',
                parentTaskId: 'preview',
                title: displayTitle,
                description: parsed.description ?? undefined,
                estimatedMinutes: mins,
                completed: false,
                order: 1,
              },
            ];
            const scheduledTimes = scheduleMicroTasksIntoTimesAdaptive({
              microTasks: previewMicroTasks,
              startDay: new Date(),
              dueDay,
              prefs: schedulePreferences,
              calendarEvents: shadowCal,
              existingTasks: shadowTasks,
              options: taskPackOptions,
            });
            previewWithTimes = [...scheduledTimes.scheduled, ...scheduledTimes.unscheduled].map((mt, i) => ({
              ...mt,
              order: mt.order ?? i + 1,
              scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
            }));
          }

          const preview = {
            title: displayTitle,
            description: parsed.description ?? undefined,
            dueDate: dueDay,
            priority: parsed.priority || 'medium',
            subject: parsed.subject ?? undefined,
            microTasks: previewWithTimes,
            estimatedTotalMinutes: mins,
            sessionStyle: 'single_block' as const,
          };
          shadowTasks.push(singleBlockPreviewToShadowTask(preview));
          entries.push({ type: 'task', preview, sourceSpan: span });
          continue;
        }

        // ── multi_step: Generate workflow-aware steps locally (no second LLM call) ──
        if (repeatedConstraint) {
          const dueDay = parseCalendarDate(parsed.dueDate);
          const displayTitle = compactTaskTitle(resolveTitleFromUserText(span, parsed.title));
          const unitBase = inferRepeatedUnitLabel(span);
          const previewMicroTasks: MicroTask[] = Array.from({ length: repeatedConstraint.count }, (_, idx) => ({
            id: `preview-${idx}`,
            parentTaskId: 'preview',
            title: `${unitBase} ${idx + 1}`,
            description: repeatedConstraint.oneGo
              ? `Complete in one sitting (${repeatedConstraint.minutesPerSession} min).`
              : `Focused session (${repeatedConstraint.minutesPerSession} min).`,
            estimatedMinutes: repeatedConstraint.minutesPerSession,
            completed: false,
            order: idx + 1,
          }));
          const scheduledTimes = scheduleMicroTasksIntoTimesAdaptive({
            microTasks: previewMicroTasks,
            startDay: new Date(),
            dueDay,
            prefs: schedulePreferences,
            calendarEvents: shadowCal,
            existingTasks: shadowTasks,
            options: taskPackOptions,
          });
          const previewWithTimes: MicroTask[] = [
            ...scheduledTimes.scheduled,
            ...scheduledTimes.unscheduled,
          ].map((mt, i) => ({
            ...mt,
            order: mt.order ?? i + 1,
            scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
          }));
          const totalMins = repeatedConstraint.count * repeatedConstraint.minutesPerSession;
          const preview = {
            title: displayTitle,
            description: parsed.description ?? undefined,
            dueDate: dueDay,
            priority: parsed.priority || 'medium',
            subject: parsed.subject ?? undefined,
            microTasks: previewWithTimes,
            estimatedTotalMinutes: totalMins,
            sessionStyle: 'multi_step' as const,
          };
          shadowTasks.push(singleBlockPreviewToShadowTask(preview));
          entries.push({ type: 'task', preview, sourceSpan: span });
          continue;
        }

        const totalMins = Math.round((parsed.estimatedHours || 2) * 60);
        const sessionPref = schedulePreferences.defaultSessionMinutes || 30;
        const displayTitle = compactTaskTitle(resolveTitleFromUserText(span, parsed.title));
        const workflow = inferWorkflowType(displayTitle, parsed.description ?? '');
        const phases = contextualizeWorkflowPhases(
          displayTitle,
          workflow,
          getWorkflowPhases(workflow, totalMins, sessionPref)
        );

        const previewMicroTasks: MicroTask[] = phases.map((phase, idx) => ({
          id: `preview-${idx}`,
          parentTaskId: 'preview',
          title: phase.title,
          description: phase.description,
          estimatedMinutes: phase.minutes,
          completed: false,
          order: idx + 1,
        }));

        const dueDay = parseCalendarDate(parsed.dueDate);
        const scheduledTimes = scheduleMicroTasksIntoTimesAdaptive({
          microTasks: previewMicroTasks,
          startDay: new Date(),
          dueDay,
          prefs: schedulePreferences,
          calendarEvents: shadowCal,
          existingTasks: shadowTasks,
          options: taskPackOptions,
        });
        const previewWithTimes: MicroTask[] = [
          ...scheduledTimes.scheduled,
          ...scheduledTimes.unscheduled,
        ].map((mt, i) => ({
          ...mt,
          order: mt.order ?? i + 1,
          scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
        }));

        const preview = {
          title: displayTitle,
          description: parsed.description ?? undefined,
          dueDate: dueDay,
          priority: parsed.priority || 'medium',
          subject: parsed.subject ?? undefined,
          microTasks: previewWithTimes,
          estimatedTotalMinutes: totalMins,
          sessionStyle: 'multi_step' as const,
        };
        shadowTasks.push(singleBlockPreviewToShadowTask(preview));
        entries.push({ type: 'task', preview, sourceSpan: span });
      }

      if (entries.length === 0) {
        throw new Error('No schedule items were returned. Try rephrasing.');
      }

      if (entries.length === 1) {
        const e = entries[0]!;
        if (e.type === 'study_plan') {
          setPreviewPlan({
            summary: e.summary,
            truncated: e.truncated,
            tasks: e.tasks,
          });
        } else if (e.type === 'event') {
          pushCalendarEventFromParsed(e.parsed, schedulePreferences, taskText, e.sourceSpan, addCalendarEvent);
          rebalanceSchedule();
          alert('Added to your calendar.');
        } else {
          setPreviewTask(e.preview);
        }
      } else {
        setBatchPreview(entries);
      }
    } catch (error) {
      console.error('Error processing task:', error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      if (code === 'AI_DAILY_LIMIT') {
        alert(
          `${msg}\n\nTip: open Settings → AI assistant and paste a free Groq key from console.groq.com — it saves to your account and works on every device you sign in on.`
        );
      } else {
        const lower = msg.toLowerCase();
        const hint =
          lower.includes('key') || lower.includes('configured') || lower.includes('not enabled')
            ? '\n\nIf you host this app yourself, enable an AI key in your environment (see README) and restart.'
            : '';
        alert(msg + hint);
      }
    } finally {
      setIsProcessing(false);
      refreshGeminiHealth();
    }
  }

  const handleAddStudyPlan = () => {
    if (!previewPlan) return;
    for (const pt of previewPlan.tasks) {
      const taskId = makeId('task');
      const newTask: Task = {
        id: taskId,
        title: pt.title,
        description: pt.description,
        dueDate: pt.dueDate,
        priority: pt.priority,
        subject: pt.subject,
        microTasks: pt.microTasks.map((mt, idx) => ({
          ...mt,
          id: makeId(`micro-${idx}`),
          parentTaskId: taskId,
          order: idx + 1,
          completed: false,
          scheduledDate: mt.scheduledDate,
          scheduledStart: mt.scheduledStart,
          scheduledEnd: mt.scheduledEnd,
        })),
        completed: false,
        createdAt: new Date(),
        estimatedTotalMinutes: pt.estimatedTotalMinutes,
      };
      addTask(newTask);
    }
    setPreviewPlan(null);
    setInput('');
    rebalanceSchedule();
    onTaskCreated?.();
  };

  const handleCreateTask = () => {
    if (!previewTask) return;

    const taskId = makeId('task');
    const newTask: Task = {
      id: taskId,
      title: previewTask.title,
      description: previewTask.description,
      dueDate: previewTask.dueDate,
      priority: previewTask.priority,
      subject: previewTask.subject,
      microTasks: previewTask.microTasks.map((mt, idx) => ({
        ...mt,
        id: makeId(`micro${idx}`),
        parentTaskId: taskId,
        order: idx + 1,
        completed: false,
        scheduledDate: mt.scheduledDate,
        scheduledStart: mt.scheduledStart,
        scheduledEnd: mt.scheduledEnd,
        fixedSlot: mt.fixedSlot,
      })),
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: previewTask.estimatedTotalMinutes,
    };

    addTask(newTask);
    setPreviewTask(null);
    setInput('');
    rebalanceSchedule();
    onTaskCreated?.();
  };

  const handleBatchAddAll = () => {
    if (!batchPreview?.length) return;
    for (const e of batchPreview) {
      if (e.type === 'event') {
        pushCalendarEventFromParsed(e.parsed, schedulePreferences, e.taskText, e.sourceSpan, addCalendarEvent);
      } else if (e.type === 'study_plan') {
        for (const pt of e.tasks) {
          const taskId = makeId('task');
          const newTask: Task = {
            id: taskId,
            title: pt.title,
            description: pt.description,
            dueDate: pt.dueDate,
            priority: pt.priority,
            subject: pt.subject,
            microTasks: pt.microTasks.map((mt, idx) => ({
              ...mt,
              id: makeId(`micro-${idx}`),
              parentTaskId: taskId,
              order: idx + 1,
              completed: false,
              scheduledDate: mt.scheduledDate,
              scheduledStart: mt.scheduledStart,
              scheduledEnd: mt.scheduledEnd,
            })),
            completed: false,
            createdAt: new Date(),
            estimatedTotalMinutes: pt.estimatedTotalMinutes,
          };
          addTask(newTask);
        }
      } else {
        const preview = e.preview;
        const taskId = makeId('task');
        addTask({
          id: taskId,
          title: preview.title,
          description: preview.description,
          dueDate: preview.dueDate,
          priority: preview.priority,
          subject: preview.subject,
          microTasks: preview.microTasks.map((mt, idx) => ({
            ...mt,
            id: makeId(`micro${idx}`),
            parentTaskId: taskId,
            order: idx + 1,
            completed: false,
            scheduledDate: mt.scheduledDate,
            scheduledStart: mt.scheduledStart,
            scheduledEnd: mt.scheduledEnd,
            fixedSlot: mt.fixedSlot,
          })),
          completed: false,
          createdAt: new Date(),
          estimatedTotalMinutes: preview.estimatedTotalMinutes,
        });
      }
    }
    setBatchPreview(null);
    setInput('');
    rebalanceSchedule();
    onTaskCreated?.();
  };

  const activeTasks = tasks.filter((t) => !t.completed).length;

  const examples = [
    '2 hour Chemistry past paper this Saturday (calendar block)',
    'Gym Tue/Thu 6pm until end of month',
    'Prep slides for client review by Wednesday, ~3h total',
    'Dentist this Thursday 9am (soonest Thursday — use “next Thursday” for the week after)',
    'Math homework due tomorrow',
    '2000-word essay on climate change due next Friday',
    '8 Maths past papers, 2h each in one go per paper, all by the 19th',
    '1 Math practice paper every day, 2 hours, until my Math exam',
    'Physics past paper every other day and Chemistry on the other days, 2 hours each',
  ];

  if (batchPreview && batchPreview.length > 0) {
    const totalStudySessions = batchPreview.reduce((n, e) => {
      if (e.type === 'study_plan') return n + e.tasks.reduce((m, t) => m + t.microTasks.length, 0);
      if (e.type === 'task') return n + e.preview.microTasks.length;
      return n;
    }, 0);
    return (
      <div className="bg-white rounded-xl p-4 border border-[#E8E6DC]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-heading font-medium text-[#B0AEA5]">AI batch ({batchPreview.length} items)</span>
          <button
            type="button"
            onClick={() => {
              setBatchPreview(null);
            }}
            className="p-1 text-[#B0AEA5] hover:text-[#141413] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#57544d] font-body mb-3 leading-relaxed">
          Several schedule items were parsed from one message. Each was packed in order so later items avoid earlier
          ones. Review the list, then add everything at once.
        </p>
        <ul className="text-xs space-y-2 max-h-48 overflow-y-auto text-[#57544d] mb-3">
          {batchPreview.map((e, i) => (
            <li key={i} className="border border-[#E8E6DC] rounded-lg p-2">
              {e.type === 'event' ? (
                <>
                  <span className="font-heading font-medium text-[#6A9BCC]">Calendar</span>
                  <span className="text-[#141413] font-medium"> · {e.parsed.title}</span>
                  {e.parsed.repeat?.daysOfWeek?.length ? (
                    <span className="text-[#B0AEA5]"> · Repeats weekly</span>
                  ) : null}
                </>
              ) : e.type === 'study_plan' ? (
                <>
                  <span className="font-heading font-medium text-[#788C5D]">Study plan</span>
                  <span className="text-[#141413]"> · {e.summary}</span>
                  <span className="text-[#B0AEA5]">
                    {' '}
                    · {e.tasks.reduce((m, t) => m + t.microTasks.length, 0)} sessions
                  </span>
                </>
              ) : (
                <>
                  <span className="font-heading font-medium text-[#D97757]">Task</span>
                  <span className="text-[#141413]"> · {e.preview.title}</span>
                  <span className="text-[#B0AEA5]">
                    {' '}
                    · {e.preview.sessionStyle === 'single_block' ? '1 block' : `${e.preview.microTasks.length} steps`}
                  </span>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] font-heading text-[#6A9BCC]">View steps</summary>
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {e.preview.microTasks.map((mt, idx) => (
                        <li key={`${mt.id}-${idx}`} className="text-[#57544d]">
                          {idx + 1}. {mt.title} ({mt.estimatedMinutes}m)
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-[#B0AEA5] mb-3">
          {totalStudySessions} schedulable block{totalStudySessions !== 1 ? 's' : ''} across tasks/plans (events are
          separate calendar holds).
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setBatchPreview(null);
            }}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium border border-[#E8E6DC] rounded-lg text-[#141413] hover:bg-white transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={handleBatchAddAll}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" />
            Add all
          </button>
        </div>
      </div>
    );
  }

  if (previewPlan) {
    const totalSessions = previewPlan.tasks.reduce((n, t) => n + t.microTasks.length, 0);
    return (
      <div className="bg-white rounded-xl p-4 border border-[#E8E6DC]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-heading font-medium text-[#B0AEA5]">AI study plan</span>
          <button
            type="button"
            onClick={() => {
              setPreviewPlan(null);
            }}
            className="p-1 text-[#B0AEA5] hover:text-[#141413] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[#141413] font-body mb-2">{previewPlan.summary}</p>
        {previewPlan.truncated ? (
          <p className="text-xs text-[#D97757] font-body mb-2">
            This preview shows the first chunk of a very large plan. Add it, or split into smaller requests for more
            detail.
          </p>
        ) : null}
        <p className="text-xs text-[#B0AEA5] mb-3">
          {previewPlan.tasks.length} task{previewPlan.tasks.length !== 1 ? 's' : ''} · {totalSessions} session
          {totalSessions !== 1 ? 's' : ''}, fitted around what’s already on your calendar
        </p>
        <ul className="text-xs space-y-2 max-h-40 overflow-y-auto text-[#57544d] mb-3">
          {previewPlan.tasks.map((t, i) => (
            <li key={i} className="border border-[#E8E6DC] rounded-lg p-2">
              <span className="font-heading font-medium text-[#141413]">{t.title}</span>
              <span className="text-[#B0AEA5]"> · Due {t.dueDate.toLocaleDateString()} · </span>
              <span className="text-[#B0AEA5]">{t.microTasks.length} sessions</span>
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] font-heading text-[#6A9BCC]">View sessions</summary>
                <ul className="mt-1 space-y-1 text-[11px]">
                  {t.microTasks.map((mt, idx) => (
                    <li key={`${mt.id}-${idx}`} className="text-[#57544d]">
                      {idx + 1}. {mt.title} ({mt.estimatedMinutes}m)
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPreviewPlan(null);
            }}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium border border-[#E8E6DC] rounded-lg text-[#141413] hover:bg-white transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={handleAddStudyPlan}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" />
            Add all
          </button>
        </div>
      </div>
    );
  }

  if (previewTask) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#E8E6DC]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-heading font-medium text-[#B0AEA5]">AI suggestion</span>
          <button
            onClick={() => {
              setPreviewTask(null);
            }}
            className="p-1 text-[#B0AEA5] hover:text-[#141413] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-3">
          <h4 className="font-heading font-semibold text-sm text-[#141413]">
            {previewTask.title}
          </h4>
          {previewTask.description && (
            <p className="text-xs text-[#B0AEA5] font-body">{previewTask.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[#B0AEA5]">
            <span>Due: {previewTask.dueDate.toLocaleDateString()}</span>
            <span>•</span>
            {previewTask.sessionStyle === 'single_block' ? (
              <span>
                One calendar block · {previewTask.estimatedTotalMinutes} min (no sub-steps)
              </span>
            ) : (
              <span>{previewTask.microTasks.length} steps</span>
            )}
          </div>
          {previewTask.microTasks.length > 0 ? (
            <details className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] p-2">
              <summary className="cursor-pointer text-xs font-heading font-medium text-[#141413]">
                {previewTask.microTasks.length} {previewTask.microTasks.length === 1 ? 'step' : 'steps'} preview
              </summary>
              <ul className="mt-2 space-y-1.5 text-[11px] text-[#57544d]">
                {previewTask.microTasks.map((step, idx) => (
                  <li key={`${step.id}-${idx}`} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      {idx + 1}. {step.title}
                    </span>
                    <span className="shrink-0 text-[#B0AEA5]">{step.estimatedMinutes}m</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-[11px] text-[#57544d] leading-snug">
            {previewTask.microTasks.some((m) => m.fixedSlot) ? (
              <>
                This block uses the <strong className="font-medium text-[#141413]">time you typed</strong> and stays
                fixed when you rebalance; other tasks pack around it.
              </>
            ) : (
              <>
                Times may shift slightly after you add so blocks fit your work hours and existing events. Check{' '}
                <strong className="font-medium text-[#141413]">Calendar</strong> for the final layout.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPreviewTask(null);
            }}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium border border-[#E8E6DC] rounded-lg text-[#141413] hover:bg-white transition-colors"
          >
            Change
          </button>
          <button
            onClick={handleCreateTask}
            className="flex-1 px-3 py-2 text-xs font-heading font-medium bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" />
            Add Task
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {variant === 'nav' ? (
        <div className="flex justify-end gap-0.5 mb-2">
          <button
            type="button"
            onClick={() => openFeedback({ kind: 'ai_parse', aiPrompt: input })}
            className="p-1.5 text-[#B0AEA5] hover:text-[#6A9BCC] hover:bg-white/80 rounded-lg transition-colors"
            title="AI misread this? Send what went wrong (helps us improve)."
            aria-label="Report AI parse issue"
          >
            <MessageSquareWarning className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 text-[#B0AEA5] hover:text-[#D97757] hover:bg-white/80 rounded-lg transition-colors"
            title="How to use"
            aria-label="How to use AI task creator"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-heading font-medium text-[#B0AEA5] shrink-0">AI Task Creator</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => openFeedback({ kind: 'ai_parse', aiPrompt: input })}
              className="px-2 py-1 text-[11px] font-heading font-semibold text-[#6A9BCC] hover:text-[#4a7aad] hover:bg-[#6A9BCC]/10 rounded-md transition-colors max-w-[9.5rem] sm:max-w-none truncate"
              title="The AI misread your text? Share what went wrong so we can improve."
            >
              AI wrong?
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="p-1 text-[#B0AEA5] hover:text-[#D97757] rounded"
              title="How to use"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {apiConfigured === null && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-[#E8E6DC]">
          <p className="text-xs text-[#B0AEA5] font-body">Checking AI connection…</p>
        </div>
      )}

      {apiConfigured === false && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-[#E8E6DC]">
          <p className="text-xs font-heading font-semibold text-[#D97757] mb-1">AI assistant isn’t available here</p>
          <p className="text-xs text-[#B0AEA5] font-body">
            {apiMessage ||
              'This copy of the app doesn’t have AI enabled yet. Everything else still works—add tasks manually or use the exam planner.'}
          </p>
        </div>
      )}

      {apiConfigured === true && sharedAiMeta && !sharedAiMeta.byok && sharedAiMeta.limit > 0 ? (
        <div className="mb-3 p-3 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
          <p className="text-xs text-[#5C5B56] font-body leading-relaxed">
            <span className="font-heading font-semibold text-[#141413]">Included AI today: </span>
            {sharedAiMeta.used} / {sharedAiMeta.limit} (resets daily).{' '}
            <Link href="/settings" className="text-[#D97757] font-medium hover:underline">
              Add your Groq key in Settings
            </Link>{' '}
            for unlimited smart scheduling on your account.
          </p>
        </div>
      ) : null}

      {apiConfigured === true && sharedAiMeta?.byok ? (
        <div className="mb-3 p-3 bg-[#E8F4E8]/35 rounded-lg border border-[#E8E6DC]">
          <p className="text-xs text-[#5C5B56] font-body">
            <span className="font-heading font-semibold text-[#141413]">Your Groq key is active.</span> Scheduling uses
            your quota, not the shared daily limit.
          </p>
        </div>
      ) : null}

      {showHelp && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-[#E8E6DC] text-xs text-[#141413] space-y-3">
          <div>
            <p className="font-heading font-semibold mb-1.5">Everyone</p>
            <p className="text-[#57544d] font-body leading-relaxed">
              Describe <strong className="text-[#141413]">anything</strong> you need to schedule—work, study, sport,
              family, creative projects—in your own words. <strong className="text-[#141413]">Calendar events</strong>{' '}
              block specific times. <strong className="text-[#141413]">Tasks</strong> are flexible blocks the app packs{' '}
              <em>around</em> those events inside your work window (Settings). When the plan shifts, nothing is
              deleted—only times and sometimes days move, always respecting each due date.
            </p>
          </div>
          <div>
            <p className="font-heading font-semibold mb-1.5">Students &amp; exam prep</p>
            <p className="text-[#57544d] font-body leading-relaxed">
              Use <strong className="text-[#141413]">Bulk exam planner</strong> for syllabus → dated revision blocks.
              Add <strong className="text-[#141413]">Exams</strong> so AI knows end dates. Extra practice (“2h paper
              tomorrow”, daily papers) is layered on the same calendar; exam-linked blocks are packed{' '}
              <em>first</em> so revision plans don’t get crowded out by ad-hoc tasks.
            </p>
          </div>
          <div>
            <p className="font-heading font-semibold mb-1.5">When does the AI break work into steps?</p>
            <p className="text-[#57544d] font-body leading-relaxed mb-2">
              The model infers structure from what you mean—not from exact phrases. <strong className="text-[#141413]">
                Multi-step
              </strong>{' '}
              = one deliverable with real phases. <strong className="text-[#141413]">Single block</strong> = one
              continuous session. <strong className="text-[#141413]">Study plan</strong> = several separate sessions or a
              multi-day pattern in one message. <strong className="text-[#141413]">Event</strong> = fixed or recurring
              time on the calendar.
            </p>
            <ul className="space-y-1 text-[#B0AEA5] font-body">
              <li>• “I can only do 1 hour today” → rebalance the rest of the week</li>
              <li>• Recurring daily practice → say the pattern; add Exams first for smart dates</li>
            </ul>
          </div>
          <div>
            <p className="font-heading font-semibold text-[#D97757] mb-1">Examples</p>
            <ul className="space-y-1 text-[#B0AEA5] font-body">
              {examples.map((ex, i) => (
                <li key={i}>• {ex}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Say what you need in your own words—deadlines, durations, recurring slots, batches…"
          className="w-full px-3 py-2.5 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] focus:border-[#D97757] font-body resize-none transition-all bg-white"
          rows={3}
          disabled={isProcessing}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[#B0AEA5] font-heading">
          {activeTasks} active task{activeTasks !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => handleSubmit()}
          disabled={
            !input.trim() ||
            isProcessing ||
            (apiConfigured !== true && parseTodayBudgetMinutes(input.trim()) === null)
          }
          className="px-4 py-2 text-xs font-heading font-semibold bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Creating...</span>
            </>
          ) : apiConfigured === null && parseTodayBudgetMinutes(input.trim()) === null ? (
            <span>Wait…</span>
          ) : (
            <span>Create</span>
          )}
        </button>
      </div>
    </div>
  );
}
