'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Task,
  MicroTask,
  PomodoroSession,
  MotivationalMessage,
  ProgressStats,
  MoodEntry,
  Habit,
  GrowthPlant,
  DistractionBlockSettings,
  CalendarIntegration,
  CalendarEvent,
  SchedulePreferences,
  MotivationPreferences,
  Note,
  Exam,
  PlannerTodoItem,
  PlannerTodoSubtask,
} from '@/types';
import { rebalanceAllTaskSchedules } from '@/lib/scheduler';
import { fragmentTasksAfterSkippingDays } from '@/lib/skip-work-day';
import { localDateKey, parseCalendarDate } from '@/lib/local-date';
import { addDays, format, startOfDay } from 'date-fns';
import type { User } from '@supabase/supabase-js';
import {
  uploadToSupabase,
  downloadFromSupabase,
  deleteRemoteTask,
  deleteRemoteCalendarEvent,
  deleteRemoteExam,
} from '@/lib/supabase-sync';
import { isSupabaseConfigured } from './supabase/config';
import { getSupabaseBrowser } from './supabase/browser';
import {
  createScopedZustandStateStorage,
  FOCUSFLOW_ZUSTAND_PERSIST_NAME,
  featureTourSeenStorageKey,
  morningBriefingStorageKey,
  syncQueueStorageKey,
} from './focusflow-storage-scope';
import { examSyllabusTopicsFromMicroTask } from './exam-topic-sync';
import { workWindowForLocalDay } from '@/lib/work-window';

/** Legacy / partial exams may omit syllabus arrays — keeps reducers and merges safe. */
function withNormalizedExamArrays(e: Exam): Exam {
  const topics = Array.isArray(e.topics) ? e.topics.map(String) : [];
  const coveredTopicIds = (Array.isArray(e.coveredTopicIds) ? e.coveredTopicIds.map(String) : []).filter((id) =>
    topics.includes(id)
  );
  const reviewTopicIds = (Array.isArray(e.reviewTopicIds) ? e.reviewTopicIds.map(String) : []).filter((id) =>
    topics.includes(id)
  );
  return { ...e, topics, coveredTopicIds, reviewTopicIds };
}

interface AppState {
  tasks: Task[];
  pomodoroSessions: PomodoroSession[];
  motivationalMessages: MotivationalMessage[];
  currentPomodoro: PomodoroSession | null;
  stats: ProgressStats;
  moodEntries: MoodEntry[];
  habits: Habit[];
  growthPlants: GrowthPlant[];
  distractionSettings: DistractionBlockSettings;
  calendarIntegration: CalendarIntegration;
  calendarEvents: CalendarEvent[];
  schedulePreferences: SchedulePreferences;
  motivationPreferences: MotivationPreferences;
  showMorningBriefing: boolean;
  /** First-run checklist (persisted per device / storage scope). */
  gettingStartedVisitedToday: boolean;
  gettingStartedVisitedSettings: boolean;
  gettingStartedChecklistDismissed: boolean;
  /** Feature tour finished or skipped — persisted locally and in `user_preferences` when signed in. */
  featureTourCompleted: boolean;
  notes: Note[];
  /** Lightweight todos (To-do page · Tasks tab) — local persist only; not synced to Supabase yet. */
  quickTodos: PlannerTodoItem[];
  exams: Exam[];

  // Actions
  replaceTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (taskId: string) => void;
  completeMicroTask: (microTaskId: string) => void;
  toggleTaskComplete: (taskId: string) => void;
  toggleMicroTaskComplete: (microTaskId: string) => void;
  addPomodoroSession: (session: PomodoroSession) => void;
  setCurrentPomodoro: (session: PomodoroSession | null) => void;
  addMotivationalMessage: (message: Omit<MotivationalMessage, 'id' | 'timestamp'>) => void;
  updateStats: () => void;
  addMoodEntry: (entry: MoodEntry) => void;
  addHabit: (habit: Omit<Habit, 'id'>) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  completeHabit: (id: string) => void;
  updateDistractionSettings: (settings: DistractionBlockSettings) => void;
  updateCalendarIntegration: (integration: CalendarIntegration) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  clearAllTasksAndEvents: () => void;
  updateSchedulePreferences: (prefs: SchedulePreferences) => void;
  updateMotivationPreferences: (prefs: MotivationPreferences) => void;
  updateWeeklyGoal: (hours: number) => void;
  evaluateMorningBriefing: () => void;
  dismissMorningBriefing: () => void;
  recordGettingStartedVisitedToday: () => void;
  recordGettingStartedVisitedSettings: () => void;
  dismissGettingStartedChecklist: () => void;
  completeFeatureTour: () => void;
  rebalanceSchedule: () => void;
  rebalanceWithTodayBudget: (minutesToday: number) => void;
  /** Mark date(s) as no-task days, clear placement for steps on those days, split heavy exam rows, repack. */
  skipWorkDaysAndRebalance: (dates: Date[]) => void;
  /** Remove a yyyy-MM-dd from no-task days and repack. */
  removeNoTaskSchedulingDate: (dateKey: string) => void;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addQuickTodo: (title: string) => void;
  updateQuickTodo: (id: string, updates: Partial<Pick<PlannerTodoItem, 'title' | 'completed'>>) => void;
  deleteQuickTodo: (id: string) => void;
  clearCompletedQuickTodos: () => void;
  addQuickTodoSubtask: (parentId: string, title: string) => void;
  updateQuickTodoSubtask: (
    parentId: string,
    subId: string,
    updates: Partial<Pick<PlannerTodoSubtask, 'title' | 'completed'>>
  ) => void;
  deleteQuickTodoSubtask: (parentId: string, subId: string) => void;
  /** Creates a Task + micro-steps and runs rebalance (AI scheduler / calendar packer). */
  scheduleQuickTodoToPlanner: (todoId: string) => void;
  addExam: (exam: Omit<Exam, 'id' | 'createdAt'>) => string;
  updateExam: (id: string, updates: Partial<Exam>) => void;
  deleteExam: (id: string) => void;
  clearAllExams: () => void;
  /** Clear and repack calendar slots for open prep sessions tied to this exam. */
  repackExamSchedule: (examId: string) => void;
  markTopicCovered: (examId: string, topic: string) => void;
  unmarkTopicCovered: (examId: string, topic: string) => void;
  toggleTopicCovered: (examId: string, topic: string) => void;
  /** Bookmark a syllabus topic to revisit (independent of “covered”). */
  toggleTopicReview: (examId: string, topic: string) => void;
  updateMicroTaskSchedule: (
    microTaskId: string,
    patch: { scheduledStart?: Date; scheduledEnd?: Date; scheduledDate?: Date; estimatedMinutes?: number }
  ) => void;

  // Sync functions
  syncToSupabase: () => Promise<void>;
  /** Pass `user` from `getUser()` to skip a duplicate network round-trip. */
  syncFromSupabase: (knownUser?: User | null) => Promise<void>;
  retryQueuedSyncs: () => Promise<void>;
  isSyncing: boolean;
  completionSyncing: boolean;
  syncQueueCount: number;
  lastSync: Date | null;
  syncError: string | null;
}

const initialStats: ProgressStats = {
  tasksCompleted: 0,
  microTasksCompleted: 0,
  totalFocusMinutes: 0,
  currentStreak: 0,
  weeklyGoal: 20, // hours
  weeklyCompleted: 0,
  focusCoins: 0,
  focusCoinsToday: 0,
  level: 1,
};

const initialDistractionSettings: DistractionBlockSettings = {
  enabled: false,
  blockedSites: [],
  blockDuringFocus: true,
  allowBreakAccess: true,
};

const initialCalendarIntegration: CalendarIntegration = {
  type: 'none',
  connected: false,
  syncEnabled: false,
};

const initialSchedulePreferences: SchedulePreferences = {
  workStart: '16:00',
  workEnd: '21:30',
  weekendWorkStart: '10:00',
  weekendWorkEnd: '18:00',
  defaultSessionMinutes: 30,
  breakMinutes: 10,
  bufferMinutes: 5,
  studyPace: 'balanced',
  gradeLevel: '10',
  calendarEventColor: '#141413',
  calendarTaskColor: '#6A9BCC',
};

const initialMotivationPreferences: MotivationPreferences = {
  personalGoal: '',
  dailyBriefingEnabled: false,
};

const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_SYNC_QUEUE = 50;

const getSyncQueue = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(syncQueueStorageKey());
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const enqueueSyncFailure = () => {
  if (typeof window === 'undefined') return 0;
  const queue = getSyncQueue();
  const next = [...queue, new Date().toISOString()].slice(-MAX_SYNC_QUEUE);
  localStorage.setItem(syncQueueStorageKey(), JSON.stringify(next));
  return next.length;
};

const clearSyncQueue = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(syncQueueStorageKey());
};

const mergeBooleanByRecency = (
  localValue: boolean,
  localAt: Date | undefined,
  remoteValue: boolean,
  remoteAt: Date | undefined
) => {
  if (localValue === remoteValue) return localValue;
  const now = Date.now();
  if (localAt && now - localAt.getTime() <= TEN_MINUTES_MS) return localValue;
  if (remoteAt && now - remoteAt.getTime() <= TEN_MINUTES_MS) return remoteValue;
  if (remoteAt && localAt) return remoteAt.getTime() >= localAt.getTime() ? remoteValue : localValue;
  return remoteValue;
};

const mergeTasksWithRecentLocalWins = (localTasks: Task[], remoteTasks: Task[]): Task[] => {
  const remoteById = new Map(remoteTasks.map((t) => [t.id, t]));
  const merged: Task[] = [];

  for (const localTask of localTasks) {
    const remoteTask = remoteById.get(localTask.id);
    if (!remoteTask) {
      merged.push(localTask);
      continue;
    }

    const remoteMicroById = new Map(remoteTask.microTasks.map((mt) => [mt.id, mt]));
    const microTasks = localTask.microTasks.map((localMt) => {
      const remoteMt = remoteMicroById.get(localMt.id);
      if (!remoteMt) return localMt;

      const completed = mergeBooleanByRecency(localMt.completed, localMt.completedAt, remoteMt.completed, remoteMt.completedAt);
      return completed
        ? { ...remoteMt, completed: true, completedAt: localMt.completedAt || remoteMt.completedAt || new Date() }
        : { ...remoteMt, completed: false, completedAt: undefined };
    });

    const completed = mergeBooleanByRecency(localTask.completed, localTask.completedAt, remoteTask.completed, remoteTask.completedAt);
    merged.push({
      ...remoteTask,
      completed,
      completedAt: completed ? localTask.completedAt || remoteTask.completedAt || new Date() : undefined,
      microTasks,
    });
    remoteById.delete(localTask.id);
  }

  merged.push(...remoteById.values());
  return merged;
};

const mergePomodorosWithRecentLocalWins = (
  localSessions: PomodoroSession[],
  remoteSessions: PomodoroSession[]
): PomodoroSession[] => {
  const remoteById = new Map(remoteSessions.map((s) => [s.id, s]));
  const merged: PomodoroSession[] = [];

  for (const localSession of localSessions) {
    const remoteSession = remoteById.get(localSession.id);
    if (!remoteSession) {
      merged.push(localSession);
      continue;
    }

    const completed = mergeBooleanByRecency(localSession.completed, localSession.endTime, remoteSession.completed, remoteSession.endTime);
    merged.push(
      completed
        ? { ...remoteSession, completed: true, endTime: localSession.endTime || remoteSession.endTime }
        : { ...remoteSession, completed: false, endTime: undefined }
    );
    remoteById.delete(localSession.id);
  }

  merged.push(...remoteById.values());
  return merged;
};

// Helper to deserialize dates from localStorage (avoid `any` to satisfy strict linting)
const deserializeDates = (state: unknown): AppState => {
  const s = (typeof state === 'object' && state !== null) ? (state as Record<string, unknown>) : {};
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const tasks = asArray<Record<string, unknown>>(s.tasks).map((task) => ({
    ...(task as unknown as Task),
    dueDate: parseCalendarDate(String((task as Record<string, unknown>).dueDate)),
    createdAt: new Date(String((task as Record<string, unknown>).createdAt)),
    completedAt: (task as Record<string, unknown>).completedAt
      ? new Date(String((task as Record<string, unknown>).completedAt))
      : undefined,
    microTasks: asArray<Record<string, unknown>>((task as Record<string, unknown>).microTasks).map((mt) => ({
      ...(mt as unknown as MicroTask),
      scheduledDate: (mt as Record<string, unknown>).scheduledDate
        ? parseCalendarDate(String((mt as Record<string, unknown>).scheduledDate))
        : undefined,
      scheduledStart: (mt as Record<string, unknown>).scheduledStart
        ? new Date(String((mt as Record<string, unknown>).scheduledStart))
        : undefined,
      scheduledEnd: (mt as Record<string, unknown>).scheduledEnd
        ? new Date(String((mt as Record<string, unknown>).scheduledEnd))
        : undefined,
      completedAt: (mt as Record<string, unknown>).completedAt
        ? new Date(String((mt as Record<string, unknown>).completedAt))
        : undefined,
    })),
  }));

  const pomodoroSessions = asArray<Record<string, unknown>>(s.pomodoroSessions).map((session) => ({
    ...(session as unknown as PomodoroSession),
    startTime: new Date(String((session as Record<string, unknown>).startTime)),
    endTime: (session as Record<string, unknown>).endTime
      ? new Date(String((session as Record<string, unknown>).endTime))
      : undefined,
  }));

  const motivationalMessages = asArray<Record<string, unknown>>(s.motivationalMessages).map((msg) => ({
    ...(msg as unknown as MotivationalMessage),
    timestamp: new Date(String((msg as Record<string, unknown>).timestamp)),
  }));

  const moodEntries = asArray<Record<string, unknown>>(s.moodEntries).map((entry) => ({
    ...(entry as unknown as MoodEntry),
    timestamp: new Date(String((entry as Record<string, unknown>).timestamp)),
    lastCompleted: (entry as Record<string, unknown>).lastCompleted
      ? new Date(String((entry as Record<string, unknown>).lastCompleted))
      : undefined,
  }));

  const habits = asArray<Record<string, unknown>>(s.habits).map((habit) => ({
    ...(habit as unknown as Habit),
    lastCompleted: (habit as Record<string, unknown>).lastCompleted
      ? new Date(String((habit as Record<string, unknown>).lastCompleted))
      : undefined,
  }));

  const growthPlants = asArray<Record<string, unknown>>(s.growthPlants).map((plant) => ({
    ...(plant as unknown as GrowthPlant),
    plantedDate: new Date(String((plant as Record<string, unknown>).plantedDate)),
  }));

  const currentPomodoroRaw = s.currentPomodoro as Record<string, unknown> | undefined;
  const currentPomodoro =
    currentPomodoroRaw
      ? ({
          ...(currentPomodoroRaw as unknown as PomodoroSession),
          startTime: new Date(String(currentPomodoroRaw.startTime)),
          endTime: currentPomodoroRaw.endTime ? new Date(String(currentPomodoroRaw.endTime)) : undefined,
        } as PomodoroSession)
      : null;

  const calendarEvents = asArray<Record<string, unknown>>(s.calendarEvents).map((event) => {
    const e = event as Record<string, unknown>;
    const repeat = e.repeat as Record<string, unknown> | undefined;
    return {
      ...(event as unknown as CalendarEvent),
      start: new Date(String(e.start)),
      end: new Date(String(e.end)),
      createdAt: new Date(String(e.createdAt)),
      updatedAt: new Date(String(e.updatedAt)),
      repeat: repeat
        ? {
            ...(repeat as CalendarEvent['repeat']),
            endDate: repeat.endDate ? new Date(String(repeat.endDate)) : undefined,
          }
        : undefined,
    } as CalendarEvent;
  });

  const notes = asArray<Note>(s.notes);
  const quickTodos = asArray<Record<string, unknown>>(s.quickTodos).map((raw) => {
    const q = raw as Record<string, unknown>;
    const subRaw = asArray<Record<string, unknown>>(q.subtasks);
    const subtasks: PlannerTodoSubtask[] = subRaw.map((sr) => ({
      id: String(sr.id ?? `qts-${Math.random().toString(36).slice(2, 9)}`),
      title: String(sr.title ?? ''),
      completed: Boolean(sr.completed),
    }));
    return {
      id: String(q.id ?? ''),
      title: String(q.title ?? ''),
      completed: Boolean(q.completed),
      createdAt: String(q.createdAt || new Date().toISOString()),
      completedAt: q.completedAt ? String(q.completedAt) : undefined,
      subtasks,
      linkedTaskId: q.linkedTaskId ? String(q.linkedTaskId) : undefined,
    } as PlannerTodoItem;
  });
  const exams = asArray<Record<string, unknown>>(s.exams).map((raw) => {
    const e = raw as unknown as Exam;
    const topics = Array.isArray(e.topics) ? e.topics.map(String) : [];
    const coveredTopicIds = Array.isArray(e.coveredTopicIds)
      ? e.coveredTopicIds.map(String).filter((id) => topics.includes(id))
      : [];
    const reviewTopicIds = Array.isArray(e.reviewTopicIds)
      ? e.reviewTopicIds.map(String).filter((id) => topics.includes(id))
      : [];
    return { ...e, topics, coveredTopicIds, reviewTopicIds } as Exam;
  });

  return {
    ...(s as unknown as AppState),
    stats: {
      ...initialStats,
      ...((s.stats as ProgressStats) || {}),
    },
    notes,
    quickTodos,
    exams,
    tasks,
    pomodoroSessions,
    motivationalMessages,
    moodEntries,
    habits,
    growthPlants,
    currentPomodoro,
    distractionSettings: (s.distractionSettings as DistractionBlockSettings) || initialDistractionSettings,
    calendarIntegration: (s.calendarIntegration as CalendarIntegration) || initialCalendarIntegration,
    calendarEvents,
    schedulePreferences: {
      ...initialSchedulePreferences,
      ...(s.schedulePreferences as SchedulePreferences),
    },
    motivationPreferences: {
      ...initialMotivationPreferences,
      ...(s.motivationPreferences as MotivationPreferences | undefined),
    },
    gettingStartedVisitedToday: Boolean((s as Record<string, unknown>).gettingStartedVisitedToday),
    gettingStartedVisitedSettings: Boolean((s as Record<string, unknown>).gettingStartedVisitedSettings),
    gettingStartedChecklistDismissed: Boolean((s as Record<string, unknown>).gettingStartedChecklistDismissed),
    featureTourCompleted: Boolean((s as Record<string, unknown>).featureTourCompleted),
  };
};

/**
 * When JWT says user A but persist bucket is still `local` (or unset), align scope so sync/upload works.
 * Returns false if another user’s bucket is active (do not write).
 */
async function ensurePersistScopeMatchesUser(userId: string): Promise<boolean> {
  const scopeMod = await import('./focusflow-storage-scope');
  const current = scopeMod.getFocusflowStorageSuffix();
  if (current === userId) return true;
  if (current && current !== 'local' && current !== userId) return false;
  const { applyFocusflowStorageScope } = await import('./storage-bootstrap');
  await applyFocusflowStorageScope(userId);
  return scopeMod.getFocusflowStorageSuffix() === userId;
}

/** Remote writes only when JWT matches scoped localStorage (after scope repair if needed). */
async function runForSyncedScope(fn: (userId: string) => Promise<void>): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data } = await getSupabaseBrowser().auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const ok = await ensurePersistScopeMatchesUser(uid);
    if (!ok) return;
    await fn(uid);
  } catch {
    /* offline */
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: [],
      pomodoroSessions: [],
      motivationalMessages: [],
      currentPomodoro: null,
      stats: initialStats,
      moodEntries: [],
      habits: [],
      growthPlants: [],
      distractionSettings: initialDistractionSettings,
      calendarIntegration: initialCalendarIntegration,
      calendarEvents: [],
      schedulePreferences: initialSchedulePreferences,
      motivationPreferences: initialMotivationPreferences,
      showMorningBriefing: false,
      gettingStartedVisitedToday: false,
      gettingStartedVisitedSettings: false,
      gettingStartedChecklistDismissed: false,
      featureTourCompleted: false,
      notes: [],
      quickTodos: [],
      exams: [],

      replaceTasks: (tasks) => {
        set(() => ({ tasks }));
        get().updateStats();
        scheduleSyncPushToCloud();
      },

      addTask: (task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().updateStats();
        // Queue sync and push immediately so a quick refresh does not lose a just-added task.
        scheduleSyncPushToCloud();
        void flushSyncPushToCloud().catch(() => {});
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
        }));
        get().updateStats();
        scheduleSyncPushToCloud();
      },

      updateMicroTaskSchedule: (microTaskId, patch) => {
        set((state) => ({
          tasks: state.tasks.map((task) => ({
            ...task,
            microTasks: task.microTasks.map((mt) =>
              mt.id === microTaskId ? { ...mt, ...patch } : mt
            ),
          })),
        }));
        scheduleSyncPushToCloud();
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
        get().updateStats();
        void (async () => {
          await runForSyncedScope(async (uid) => {
            await deleteRemoteTask(uid, id);
          });
          void flushSyncPushToCloud().catch(() => {});
        })();
      },

      completeTask: (taskId) => {
        const prior = get().tasks.find((t) => t.id === taskId);
        const examMarks =
          prior && !prior.completed
            ? prior.microTasks.flatMap((mt) =>
                examSyllabusTopicsFromMicroTask(mt).map((topic) => ({ examId: mt.examId as string, topic }))
              )
            : [];

        set((state) => {
          const updatedTasks = state.tasks.map((task) => {
            if (task.id !== taskId) return task;
            if (task.completed) return task;
            return {
              ...task,
              completed: true,
              completedAt: new Date(),
              microTasks: task.microTasks.map((mt) => ({ ...mt, completed: true, completedAt: mt.completedAt || new Date() })),
            };
          });

          const completedTask = state.tasks.find((t) => t.id === taskId);
          const newMessages = completedTask
            ? [
                {
                  id: Date.now().toString(),
                  message: `Task "${completedTask.title}" completed`,
                  type: 'progress' as const,
                  timestamp: new Date(),
                },
                ...state.motivationalMessages.slice(0, 9),
              ]
            : state.motivationalMessages;

          return {
            tasks: updatedTasks,
            motivationalMessages: newMessages,
          };
        });
        for (const x of examMarks) get().markTopicCovered(x.examId, x.topic);
        get().updateStats();
        set({ completionSyncing: true });
        get().syncToSupabase().catch(() => {}).finally(() => set({ completionSyncing: false }));
      },

      completeMicroTask: (microTaskId) => {
        const priorMt = get()
          .tasks.flatMap((t) => t.microTasks)
          .find((m) => m.id === microTaskId);
        const wasIncomplete = !!(priorMt && !priorMt.completed);
        const examTags =
          priorMt?.examId
            ? examSyllabusTopicsFromMicroTask(priorMt).map((topic) => ({
                examId: priorMt.examId as string,
                topic,
              }))
            : [];

        set((state) => {
          const updatedTasks = state.tasks.map((task) => ({
            ...task,
            microTasks: task.microTasks.map((mt) =>
              mt.id === microTaskId ? (mt.completed ? mt : { ...mt, completed: true, completedAt: new Date() }) : mt
            ),
          }));

          // Check if all micro-tasks are completed
          let completedTaskTitle = '';
          const finalTasks = updatedTasks.map((task) => {
            const wasCompleted = task.completed;
            const allCompleted = task.microTasks.every((mt) => mt.completed);
            const nowCompleted = allCompleted && task.microTasks.length > 0;

            if (!wasCompleted && nowCompleted) {
              completedTaskTitle = task.title;
            }

            return nowCompleted ? { ...task, completed: true, completedAt: task.completedAt || new Date() } : task;
          });

          // Add motivational message if a task was completed
          const newMessages = completedTaskTitle
            ? [
                {
                  id: Date.now().toString(),
                  message: `Task "${completedTaskTitle}" completed`,
                  type: 'progress' as const,
                  timestamp: new Date(),
                },
                ...state.motivationalMessages.slice(0, 9),
              ]
            : state.motivationalMessages;

          return {
            tasks: finalTasks,
            motivationalMessages: newMessages,
          };
        });
        if (wasIncomplete && examTags.length) {
          for (const tag of examTags) get().markTopicCovered(tag.examId, tag.topic);
        }
        get().updateStats();
        set({ completionSyncing: true });
        get().syncToSupabase().catch(() => {}).finally(() => set({ completionSyncing: false }));
      },

      toggleTaskComplete: (taskId) => {
        const target = get().tasks.find((t) => t.id === taskId);
        if (!target) return;

        const becomingCompleted = !target.completed;
        const examTopicOps = target.microTasks.flatMap((mt) =>
          examSyllabusTopicsFromMicroTask(mt).map((topic) => ({ examId: mt.examId as string, topic }))
        );

        set((state) => {
          const t0 = state.tasks.find((t) => t.id === taskId);
          if (!t0) return state;

          const now = new Date();
          const willComplete = !t0.completed;

          const tasks = state.tasks.map((task) => {
            if (task.id !== taskId) return task;
            if (willComplete) {
              return {
                ...task,
                completed: true,
                completedAt: now,
                microTasks: task.microTasks.map((mt) => ({
                  ...mt,
                  completed: true,
                  completedAt: mt.completedAt || now,
                })),
              };
            }
            return {
              ...task,
              completed: false,
              completedAt: undefined,
              microTasks: task.microTasks.map((mt) => ({
                ...mt,
                completed: false,
                completedAt: undefined,
              })),
            };
          });

          const motivationalMessages = willComplete
            ? [
                {
                  id: Date.now().toString(),
                  message: `Task "${t0.title}" completed`,
                  type: 'progress' as const,
                  timestamp: now,
                },
                ...state.motivationalMessages.slice(0, 9),
              ]
            : state.motivationalMessages;

          return { tasks, motivationalMessages };
        });
        if (becomingCompleted) {
          for (const x of examTopicOps) get().markTopicCovered(x.examId, x.topic);
        } else {
          for (const x of examTopicOps) get().unmarkTopicCovered(x.examId, x.topic);
        }
        get().updateStats();
        set({ completionSyncing: true });
        get().syncToSupabase().catch(() => {}).finally(() => set({ completionSyncing: false }));
      },

      toggleMicroTaskComplete: (microTaskId) => {
        type ExamSync = { examId: string; topics: string[]; completed: boolean };
        const examHold: { current: ExamSync | null } = { current: null };

        set((state) => {
          const now = new Date();
          let microTitle: string | null = null;
          let becomingCompleted = false;

          const tasks = state.tasks.map((task) => {
            const nextMicroTasks = task.microTasks.map((mt) => {
              if (mt.id !== microTaskId) return mt;
              microTitle = mt.title;
              becomingCompleted = !mt.completed;
              const syllabusTopics = examSyllabusTopicsFromMicroTask(mt);
              if (mt.examId && syllabusTopics.length > 0) {
                examHold.current = {
                  examId: mt.examId,
                  topics: syllabusTopics,
                  completed: becomingCompleted,
                };
              }
              return becomingCompleted
                ? { ...mt, completed: true, completedAt: now }
                : { ...mt, completed: false, completedAt: undefined };
            });

            // Keep parent task consistent
            const hasThis = nextMicroTasks.some((mt) => mt.id === microTaskId);
            if (!hasThis) return { ...task, microTasks: nextMicroTasks };

            const allCompleted = nextMicroTasks.length > 0 && nextMicroTasks.every((mt) => mt.completed);
            return {
              ...task,
              microTasks: nextMicroTasks,
              completed: allCompleted,
              completedAt: allCompleted ? (task.completedAt || now) : undefined,
            };
          });

          const motivationalMessages =
            becomingCompleted && microTitle
              ? [
                  {
                    id: Date.now().toString(),
                    message: `Step completed: "${microTitle}"`,
                    type: 'progress' as const,
                    timestamp: now,
                  },
                  ...state.motivationalMessages.slice(0, 9),
                ]
              : state.motivationalMessages;

          return { tasks, motivationalMessages };
        });
        const examSync = examHold.current;
        if (examSync) {
          for (const topic of examSync.topics) {
            if (examSync.completed) get().markTopicCovered(examSync.examId, topic);
            else get().unmarkTopicCovered(examSync.examId, topic);
          }
        }
        get().updateStats();
        set({ completionSyncing: true });
        get().syncToSupabase().catch(() => {}).finally(() => set({ completionSyncing: false }));
      },

      addPomodoroSession: (session) => {
        set((state) => ({
          pomodoroSessions: [...state.pomodoroSessions, session],
        }));
        get().updateStats();
        scheduleSyncPushToCloud();
      },

      setCurrentPomodoro: (session) =>
        set(() => ({ currentPomodoro: session })),

      addMotivationalMessage: (message) =>
        set((state) => ({
          motivationalMessages: [
            {
              ...message,
              id: Date.now().toString(),
              timestamp: new Date(),
            },
            ...state.motivationalMessages.slice(0, 9), // Keep last 10
          ],
        })),

      updateStats: () =>
        set((state) => {
          const tasksCompleted = state.tasks.filter((t) => t.completed).length;
          const microTasksCompleted = state.tasks.reduce(
            (acc, task) =>
              acc + task.microTasks.filter((mt) => mt.completed).length,
            0
          );
          const isFocusPomodoro = (s: (typeof state.pomodoroSessions)[number]) =>
            !s.type || s.type === 'focus';

          const totalFocusMinutes = state.pomodoroSessions
            .filter((s) => s.completed && isFocusPomodoro(s))
            .reduce((acc, s) => acc + s.duration, 0);

          // FocusCoins (fake currency) – derived so undo stays consistent
          const COINS_PER_FOCUS_MIN = 1;
          const COINS_PER_STEP = 5;
          const COINS_PER_TASK = 20;

          const focusCoins =
            totalFocusMinutes * COINS_PER_FOCUS_MIN +
            microTasksCompleted * COINS_PER_STEP +
            tasksCompleted * COINS_PER_TASK;

          const level = Math.max(1, Math.floor(focusCoins / 250) + 1);

          // Calculate weekly completed hours
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);

          const weeklyCompleted = state.pomodoroSessions
            .filter(
              (s) =>
                s.completed &&
                s.endTime &&
                isFocusPomodoro(s) &&
                new Date(s.endTime) >= weekStart
            )
            .reduce((acc, s) => acc + s.duration, 0) / 60;

          // Streak: consecutive days with at least one completed focus session (Pomodoro), per Today "done" spec
          let currentStreak = 0;
          const completedSessionDays = state.pomodoroSessions
            .filter((s) => s.completed && s.endTime && s.type === 'focus')
            .map((s) => {
              const date = new Date(s.endTime!);
              date.setHours(0, 0, 0, 0);
              return date.getTime();
            });

          const uniqueDays = Array.from(new Set(completedSessionDays)).sort((a, b) => b - a);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTime = today.getTime();

          // Count backwards from today if present, otherwise from the most recent activity day.
          // (Fixes an off-by-one that double-counted "today".)
          const daysSet = new Set(uniqueDays);
          if (uniqueDays.length > 0) {
            const cursorStart = daysSet.has(todayTime) ? todayTime : uniqueDays[0];
            let cursor = cursorStart;
            let streak = 0;
            while (daysSet.has(cursor)) {
              streak += 1;
              const prev = new Date(cursor);
              prev.setDate(prev.getDate() - 1);
              prev.setHours(0, 0, 0, 0);
              cursor = prev.getTime();
            }
            currentStreak = streak;
          }

          // Coins earned today (nice immediate motivator)
          const focusCoinsToday =
            state.pomodoroSessions
              .filter((s) => s.completed && s.endTime && isFocusPomodoro(s))
              .filter((s) => {
                const d = new Date(s.endTime!);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === todayTime;
              })
              .reduce((acc, s) => acc + s.duration * COINS_PER_FOCUS_MIN, 0) +
            state.tasks
              .flatMap((t) => t.microTasks)
              .filter((mt) => mt.completed && mt.completedAt)
              .filter((mt) => {
                const d = new Date(mt.completedAt!);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === todayTime;
              })
              .length *
              COINS_PER_STEP +
            state.tasks
              .filter((t) => t.completed && t.completedAt)
              .filter((t) => {
                const d = new Date(t.completedAt!);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === todayTime;
              })
              .length *
              COINS_PER_TASK;

          return {
            stats: {
              ...state.stats,
              tasksCompleted,
              microTasksCompleted,
              totalFocusMinutes,
              weeklyCompleted,
              currentStreak,
              focusCoins,
              focusCoinsToday,
              level,
            },
          };
        }),

      addMoodEntry: (entry) =>
        set((state) => ({
          moodEntries: [...state.moodEntries, entry],
        })),

      addHabit: (habit) =>
        set((state) => ({
          habits: [
            ...state.habits,
            {
              ...habit,
              id: `habit-${Date.now()}`,
            },
          ],
        })),

      updateHabit: (id, updates) =>
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id ? { ...habit, ...updates } : habit
          ),
        })),

      completeHabit: (id) =>
        set((state) => {
          const habit = state.habits.find((h) => h.id === id);
          if (!habit) return state;

          const wasCompletedToday =
            habit.lastCompleted &&
            new Date(habit.lastCompleted).toDateString() === new Date().toDateString();

          return {
            habits: state.habits.map((h) =>
              h.id === id
                ? {
                    ...h,
                    streak: wasCompletedToday ? h.streak : h.streak + 1,
                    lastCompleted: new Date(),
                  }
                : h
            ),
          };
        }),

      updateDistractionSettings: (settings) =>
        set(() => ({ distractionSettings: settings })),

      updateCalendarIntegration: (integration) =>
        set(() => ({ calendarIntegration: integration })),

      addCalendarEvent: (event) =>
        set((state) => {
          const calendarEvents = [
            ...state.calendarEvents,
            {
              ...event,
              id: `event-${Date.now()}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          });
          scheduleSyncPushToCloud();
          return { calendarEvents, tasks };
        }),

      updateCalendarEvent: (id, updates) =>
        set((state) => {
          const calendarEvents = state.calendarEvents.map((event) =>
            event.id === id
              ? { ...event, ...updates, updatedAt: new Date() }
              : event
          );
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          });
          scheduleSyncPushToCloud();
          return { calendarEvents, tasks };
        }),

      deleteCalendarEvent: (id) => {
        set((state) => {
          const calendarEvents = state.calendarEvents.filter((event) => event.id !== id);
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          });
          return { calendarEvents, tasks };
        });
        void (async () => {
          await runForSyncedScope(async (uid) => {
            await deleteRemoteCalendarEvent(uid, id);
          });
          void flushSyncPushToCloud().catch(() => {});
        })();
      },

      clearAllTasksAndEvents: () => {
        const taskIds = get().tasks.map((t) => t.id);
        const eventIds = get().calendarEvents.map((e) => e.id);
        set(() => ({ tasks: [], calendarEvents: [] }));
        get().updateStats();
        void (async () => {
          await runForSyncedScope(async (uid) => {
            await Promise.all([
              ...taskIds.map((id) => deleteRemoteTask(uid, id)),
              ...eventIds.map((id) => deleteRemoteCalendarEvent(uid, id)),
            ]);
          });
          void flushSyncPushToCloud().catch(() => {});
        })();
      },

      updateSchedulePreferences: (prefs) =>
        set((state) => {
          const next = { schedulePreferences: prefs } as Partial<AppState>;
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents: state.calendarEvents,
            prefs,
            from: new Date(),
          });
          scheduleSyncPushToCloud();
          return { ...next, tasks };
        }),

      updateMotivationPreferences: (prefs) => {
        set(() => ({ motivationPreferences: prefs }));
        scheduleSyncPushToCloud();
      },

      updateWeeklyGoal: (hours) => {
        set((state) => ({
          stats: {
            ...state.stats,
            weeklyGoal: Math.max(1, Math.min(60, hours || 20)),
          },
        }));
        scheduleSyncPushToCloud();
      },

      evaluateMorningBriefing: () => {
        const prefs = get().motivationPreferences;
        if (!prefs.dailyBriefingEnabled) {
          set({ showMorningBriefing: false });
          return;
        }
        const today = localDateKey(new Date());
        const lastBriefingDate =
          typeof window !== 'undefined' ? localStorage.getItem(morningBriefingStorageKey()) : null;
        set({ showMorningBriefing: lastBriefingDate !== today });
      },

      dismissMorningBriefing: () => {
        const today = localDateKey(new Date());
        if (typeof window !== 'undefined') {
          localStorage.setItem(morningBriefingStorageKey(), today);
        }
        set({ showMorningBriefing: false });
      },

      recordGettingStartedVisitedToday: () => {
        set((state) => (state.gettingStartedVisitedToday ? {} : { gettingStartedVisitedToday: true }));
      },

      recordGettingStartedVisitedSettings: () => {
        set((state) => (state.gettingStartedVisitedSettings ? {} : { gettingStartedVisitedSettings: true }));
      },

      dismissGettingStartedChecklist: () => set({ gettingStartedChecklistDismissed: true }),

      completeFeatureTour: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(featureTourSeenStorageKey(), '1');
          } catch {
            /* ignore */
          }
        }
        set({ featureTourCompleted: true });
        void flushSyncPushToCloud().catch(() => {});
      },

      addNote: (note) => {
        const now = new Date().toISOString();
        const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          notes: [{ ...note, id, createdAt: now, updatedAt: now }, ...state.notes],
        }));
        scheduleSyncPushToCloud();
      },

      updateNote: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: now } : n)),
        }));
        scheduleSyncPushToCloud();
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
        void (async () => {
          if (!isSupabaseConfigured) return;
          try {
            const supabase = getSupabaseBrowser();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);
            }
          } catch {
            /* offline / auth unreachable */
          }
        })().catch(() => {});
        scheduleSyncPushToCloud();
      },

      addQuickTodo: (title) => {
        const t = title.trim();
        if (!t) return;
        const now = new Date().toISOString();
        const id = `qt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          quickTodos: [
            { id, title: t, completed: false, createdAt: now, subtasks: [] },
            ...state.quickTodos,
          ],
        }));
      },

      updateQuickTodo: (id, updates) => {
        set((state) => ({
          quickTodos: state.quickTodos.map((q) => {
            if (q.id !== id) return q;
            const next = { ...q, ...updates };
            if (updates.completed === true && !q.completed) {
              next.completedAt = new Date().toISOString();
            }
            if (updates.completed === false) {
              next.completedAt = undefined;
            }
            return next;
          }),
        }));
      },

      deleteQuickTodo: (id) => {
        set((state) => ({ quickTodos: state.quickTodos.filter((q) => q.id !== id) }));
      },

      clearCompletedQuickTodos: () => {
        set((state) => ({ quickTodos: state.quickTodos.filter((q) => !q.completed) }));
      },

      addQuickTodoSubtask: (parentId, title) => {
        const t = title.trim();
        if (!t) return;
        const sid = `qts-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          quickTodos: state.quickTodos.map((q) =>
            q.id === parentId
              ? { ...q, subtasks: [...q.subtasks, { id: sid, title: t, completed: false }] }
              : q
          ),
        }));
      },

      updateQuickTodoSubtask: (parentId, subId, updates) => {
        set((state) => ({
          quickTodos: state.quickTodos.map((q) => {
            if (q.id !== parentId) return q;
            return {
              ...q,
              subtasks: q.subtasks.map((s) => {
                if (s.id !== subId) return s;
                const next = { ...s, ...updates };
                return next;
              }),
            };
          }),
        }));
      },

      deleteQuickTodoSubtask: (parentId, subId) => {
        set((state) => ({
          quickTodos: state.quickTodos.map((q) =>
            q.id === parentId ? { ...q, subtasks: q.subtasks.filter((s) => s.id !== subId) } : q
          ),
        }));
      },

      scheduleQuickTodoToPlanner: (todoId) => {
        const item = get().quickTodos.find((q) => q.id === todoId);
        if (!item || item.linkedTaskId || item.completed) return;
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const openSubs = item.subtasks.filter((s) => !s.completed && s.title.trim());
        const stepTitles =
          openSubs.length > 0
            ? openSubs.map((s) => s.title.trim())
            : [item.title.trim() || 'Task'];
        const microTasks: MicroTask[] = stepTitles.map((stepTitle, idx) => ({
          id: `micro-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          parentTaskId: taskId,
          title: stepTitle,
          estimatedMinutes: 30,
          completed: false,
          order: idx + 1,
        }));
        const task: Task = {
          id: taskId,
          title: item.title.trim() || 'Planned task',
          dueDate: addDays(new Date(), 7),
          priority: 'medium',
          microTasks,
          completed: false,
          createdAt: new Date(),
          estimatedTotalMinutes: microTasks.reduce((a, m) => a + m.estimatedMinutes, 0),
        };
        get().addTask(task);
        set((state) => ({
          quickTodos: state.quickTodos.map((q) =>
            q.id === todoId ? { ...q, linkedTaskId: taskId } : q
          ),
        }));
        get().rebalanceSchedule();
      },

      addExam: (exam) => {
        const id = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const createdAt = new Date().toISOString();
        set((state) => ({
          exams: [withNormalizedExamArrays({ ...exam, id, createdAt }), ...state.exams],
        }));
        scheduleSyncPushToCloud();
        return id;
      },

      updateExam: (id, updates) => {
        set((state) => ({
          exams: state.exams.map((e) =>
            e.id === id ? withNormalizedExamArrays({ ...e, ...updates } as Exam) : e
          ),
        }));
        scheduleSyncPushToCloud();
      },

      deleteExam: (id) => {
        set((state) => ({
          exams: state.exams.filter((e) => e.id !== id),
        }));
        void (async () => {
          await runForSyncedScope(async (uid) => {
            await deleteRemoteExam(uid, id);
          });
          void flushSyncPushToCloud().catch(() => {});
        })();
      },

      clearAllExams: () => {
        const examIds = get().exams.map((e) => e.id);
        set((state) => {
          const tasks = state.tasks.filter(
            (task) =>
              !task.microTasks.some((mt) => (mt.examId && examIds.includes(mt.examId)) || mt.source === 'exam-planner')
          );
          return { exams: [], tasks };
        });
        get().updateStats();
        void (async () => {
          await runForSyncedScope(async (uid) => {
            await Promise.all(examIds.map((id) => deleteRemoteExam(uid, id)));
          });
          void flushSyncPushToCloud().catch(() => {});
        })();
      },

      repackExamSchedule: (examId) => {
        set((state) => {
          const cleared = state.tasks.map((task) => ({
            ...task,
            microTasks: task.microTasks.map((mt) =>
              mt.examId === examId && !mt.completed
                ? {
                    ...mt,
                    scheduledStart: undefined,
                    scheduledEnd: undefined,
                    scheduledDate: undefined,
                  }
                : mt
            ),
          }));
          const tasks = rebalanceAllTaskSchedules({
            tasks: cleared,
            calendarEvents: state.calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          });
          return { tasks };
        });
        scheduleSyncPushToCloud();
      },

      markTopicCovered: (examId, topic) => {
        set((state) => ({
          exams: state.exams.map((e) => {
            if (e.id !== examId) return e;
            const topics = Array.isArray(e.topics) ? e.topics : [];
            if (!topics.includes(topic)) return e;
            const cleanIds = (e.coveredTopicIds ?? []).filter((id) => topics.includes(id));
            const cleanReview = (e.reviewTopicIds ?? []).filter((id) => topics.includes(id));
            if (cleanIds.includes(topic))
              return { ...e, topics, coveredTopicIds: cleanIds, reviewTopicIds: cleanReview };
            return {
              ...e,
              topics,
              coveredTopicIds: [...cleanIds, topic],
              reviewTopicIds: cleanReview.filter((t) => t !== topic),
            };
          }),
        }));
        scheduleSyncPushToCloud();
      },

      unmarkTopicCovered: (examId, topic) => {
        set((state) => ({
          exams: state.exams.map((e) => {
            if (e.id !== examId) return e;
            const topics = Array.isArray(e.topics) ? e.topics : [];
            const cleanIds = (e.coveredTopicIds ?? []).filter((id) => topics.includes(id));
            return { ...e, topics, coveredTopicIds: cleanIds.filter((t) => t !== topic) };
          }),
        }));
        scheduleSyncPushToCloud();
      },

      toggleTopicCovered: (examId, topic) => {
        set((state) => ({
          exams: state.exams.map((e) => {
            if (e.id !== examId) return e;
            const topics = Array.isArray(e.topics) ? e.topics : [];
            const cleanIds = (e.coveredTopicIds ?? []).filter((id) => topics.includes(id));
            const cleanReview = (e.reviewTopicIds ?? []).filter((id) => topics.includes(id));
            if (!topics.includes(topic)) {
              return { ...e, topics, coveredTopicIds: cleanIds, reviewTopicIds: cleanReview };
            }
            const has = cleanIds.includes(topic);
            if (has) {
              return {
                ...e,
                topics,
                coveredTopicIds: cleanIds.filter((t) => t !== topic),
                reviewTopicIds: cleanReview,
              };
            }
            return {
              ...e,
              topics,
              coveredTopicIds: [...cleanIds, topic],
              reviewTopicIds: cleanReview.filter((t) => t !== topic),
            };
          }),
        }));
        scheduleSyncPushToCloud();
      },

      toggleTopicReview: (examId, topic) => {
        set((state) => ({
          exams: state.exams.map((e) => {
            if (e.id !== examId) return e;
            const topics = Array.isArray(e.topics) ? e.topics : [];
            if (!topics.includes(topic)) return e;
            const cleanReview = (e.reviewTopicIds ?? []).filter((id) => topics.includes(id));
            const has = cleanReview.includes(topic);
            return {
              ...e,
              topics,
              reviewTopicIds: has ? cleanReview.filter((t) => t !== topic) : [...cleanReview, topic],
            };
          }),
        }));
        scheduleSyncPushToCloud();
      },

      rebalanceSchedule: () => {
        set((state) => ({
          tasks: rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents: state.calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          }),
        }));
        scheduleSyncPushToCloud();
      },

      rebalanceWithTodayBudget: (minutesToday) =>
        set((state) => {
          const now = new Date();
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);
          const parseTime = (hhmm: string) => {
            const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
            return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
          };
          const { start: dayStart, end: dayEnd } = workWindowForLocalDay(state.schedulePreferences, now);
          const ws = parseTime(dayStart);
          const we = parseTime(dayEnd);
          const windowStart = new Date(startOfToday);
          windowStart.setHours(ws.h, ws.m, 0, 0);
          const windowEnd = new Date(startOfToday);
          windowEnd.setHours(we.h, we.m, 0, 0);
          const keepUntil = new Date(windowStart.getTime() + Math.max(0, Math.round(minutesToday)) * 60_000);

          const budgetClamp = keepUntil < windowStart ? windowStart : keepUntil > windowEnd ? windowEnd : keepUntil;
          const budgetEvent =
            budgetClamp < windowEnd
              ? [
                  {
                    id: `budget-block-${Date.now()}`,
                    title: 'Unavailable',
                    start: budgetClamp,
                    end: windowEnd,
                    allDay: false,
                    eventType: 'other' as const,
                    color: '#141413',
                    createdAt: now,
                    updatedAt: now,
                  },
                ]
              : [];

          return {
            tasks: rebalanceAllTaskSchedules({
              tasks: state.tasks,
              calendarEvents: [...state.calendarEvents, ...budgetEvent],
              prefs: state.schedulePreferences,
              from: now,
            }),
          };
        }),

      skipWorkDaysAndRebalance: (dates) => {
        const keys = [...new Set(dates.map((d) => format(startOfDay(d), 'yyyy-MM-dd')))].sort();
        if (keys.length === 0) return;
        set((state) => {
          const merged = [
            ...new Set([...(state.schedulePreferences.noTaskSchedulingDates || []), ...keys]),
          ].sort();
          const prefs: SchedulePreferences = {
            ...state.schedulePreferences,
            noTaskSchedulingDates: merged,
          };
          const fragmented = fragmentTasksAfterSkippingDays(state.tasks, new Set(keys), state.exams);
          const tasks = rebalanceAllTaskSchedules({
            tasks: fragmented,
            calendarEvents: state.calendarEvents,
            prefs,
            from: new Date(),
          });
          return { schedulePreferences: prefs, tasks };
        });
        scheduleSyncPushToCloud();
      },

      removeNoTaskSchedulingDate: (dateKey) => {
        set((state) => {
          const rest = (state.schedulePreferences.noTaskSchedulingDates || []).filter((k) => k !== dateKey);
          const prefs: SchedulePreferences = {
            ...state.schedulePreferences,
            ...(rest.length ? { noTaskSchedulingDates: rest } : { noTaskSchedulingDates: undefined }),
          };
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents: state.calendarEvents,
            prefs,
            from: new Date(),
          });
          return { schedulePreferences: prefs, tasks };
        });
        scheduleSyncPushToCloud();
      },

      // Sync state
      isSyncing: false,
      completionSyncing: false,
      syncQueueCount: 0,
      lastSync: null,
      syncError: null,

      // Sync to Supabase
      syncToSupabase: async () => {
        if (!isSupabaseConfigured) return;

        const state = useStore.getState();
        let user: { id: string } | null = null;
        try {
          const { data } = await getSupabaseBrowser().auth.getUser();
          user = data.user ?? null;
        } catch {
          return;
        }

        if (!user) {
          return;
        }

        const scopeOk = await ensurePersistScopeMatchesUser(user.id);
        if (!scopeOk) {
          set({
            isSyncing: false,
            syncError: 'This browser’s saved data is for a different account. Sign out, then sign in again.',
          });
          return;
        }

        set({ isSyncing: true, syncError: null });

        try {
          const result = await uploadToSupabase(user.id, {
            tasks: state.tasks,
            microTasks: state.tasks.flatMap(t => t.microTasks),
            pomodoroSessions: state.pomodoroSessions,
            calendarEvents: state.calendarEvents,
            stats: state.stats,
            schedulePreferences: state.schedulePreferences,
            motivationPreferences: state.motivationPreferences,
            featureTourCompleted: state.featureTourCompleted,
            notes: state.notes,
            exams: state.exams,
          });

          if (result.success) {
            clearSyncQueue();
            set({ lastSync: new Date(), isSyncing: false, syncError: null });
          } else {
            const queueCount = enqueueSyncFailure();
            set({ isSyncing: false, syncQueueCount: queueCount, syncError: result.error || 'Sync failed' });
          }
        } catch (error) {
          console.error('Sync error:', error);
          const queueCount = enqueueSyncFailure();
          set({ 
            isSyncing: false, 
            syncQueueCount: queueCount,
            syncError: error instanceof Error ? error.message : 'Unknown sync error' 
          });
        }
      },

      // Sync from Supabase
      syncFromSupabase: async (knownUser?: User | null) => {
        if (!isSupabaseConfigured) return;

        let user: User | null = null;
        if (knownUser !== undefined) {
          user = knownUser;
        } else {
          try {
            const { data } = await getSupabaseBrowser().auth.getUser();
            user = data.user ?? null;
          } catch {
            return;
          }
        }

        if (!user) {
          return;
        }

        const scopeOk = await ensurePersistScopeMatchesUser(user.id);
        if (!scopeOk) {
          set({
            isSyncing: false,
            syncError: 'This browser’s saved data is for a different account. Sign out, then sign in again.',
          });
          return;
        }

        set({ isSyncing: true, syncError: null });

        try {
          const downloadResult = await downloadFromSupabase(user.id);

          if (!downloadResult.ok) {
            set({ isSyncing: false, syncError: downloadResult.error });
            return;
          }

          const remoteData = downloadResult.data;

          const mergeNotes = (local: Note[], remote: Note[]): Note[] => {
            if (remote.length === 0) return local;
            const byId = new Map<string, Note>();
            remote.forEach((n) => byId.set(n.id, n));
            local.forEach((n) => {
              const r = byId.get(n.id);
              if (!r) {
                byId.set(n.id, n);
                return;
              }
              byId.set(n.id, new Date(n.updatedAt) >= new Date(r.updatedAt) ? n : r);
            });
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          };

          const mergeExams = (local: Exam[], remote: Exam[]): Exam[] => {
            if (remote.length === 0) return local.map(withNormalizedExamArrays);
            const byId = new Map<string, Exam>();
            remote.forEach((e) => byId.set(e.id, withNormalizedExamArrays(e)));
            local.forEach((e) => {
              if (!byId.has(e.id)) byId.set(e.id, withNormalizedExamArrays(e));
            });
            return Array.from(byId.values()).map(withNormalizedExamArrays);
          };

          /** Union by id; newer updatedAt wins (replacing the whole list when remote was non-empty dropped local-only events). */
          const mergeCalendarEvents = (local: CalendarEvent[], remote: CalendarEvent[]): CalendarEvent[] => {
            const byId = new Map<string, CalendarEvent>();
            for (const e of remote) byId.set(e.id, e);
            for (const e of local) {
              const existing = byId.get(e.id);
              if (!existing) {
                byId.set(e.id, e);
                continue;
              }
              const localT = new Date(e.updatedAt).getTime();
              const remoteT = new Date(existing.updatedAt).getTime();
              byId.set(e.id, localT >= remoteT ? e : existing);
            }
            return Array.from(byId.values()).sort(
              (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
            );
          };

          // Merge with recency-aware completion conflict handling:
          set((state) => ({
            tasks: remoteData.tasks.length > 0 ? mergeTasksWithRecentLocalWins(state.tasks, remoteData.tasks) : state.tasks,
            pomodoroSessions: remoteData.pomodoroSessions.length > 0
              ? mergePomodorosWithRecentLocalWins(state.pomodoroSessions, remoteData.pomodoroSessions)
              : state.pomodoroSessions,
            calendarEvents: mergeCalendarEvents(state.calendarEvents, remoteData.calendarEvents || []),
            featureTourCompleted:
              state.featureTourCompleted || remoteData.featureTourCompleted === true,
            stats: remoteData.stats || state.stats,
            schedulePreferences: (() => {
              const remote = remoteData.schedulePreferences;
              if (!remote) return state.schedulePreferences;
              const localNo = state.schedulePreferences.noTaskSchedulingDates || [];
              const remoteNo = remote.noTaskSchedulingDates || [];
              const mergedNo =
                localNo.length || remoteNo.length
                  ? [...new Set([...localNo, ...remoteNo])].sort()
                  : undefined;
              return {
                ...state.schedulePreferences,
                ...remote,
                ...(mergedNo ? { noTaskSchedulingDates: mergedNo } : {}),
              };
            })(),
            motivationPreferences: remoteData.motivationPreferences
              ? { ...state.motivationPreferences, ...remoteData.motivationPreferences }
              : state.motivationPreferences,
            notes: mergeNotes(state.notes, remoteData.notes || []),
            exams: mergeExams(state.exams, remoteData.exams || []),
            lastSync: new Date(),
            isSyncing: false,
            syncError: null,
          }));
          get().updateStats();
          get().evaluateMorningBriefing();
          void flushSyncPushToCloud().catch(() => {});
        } catch (error) {
          console.error('Download sync error:', error);
          set({ 
            isSyncing: false, 
            syncError: error instanceof Error ? error.message : 'Unknown download error' 
          });
        }
      },

      retryQueuedSyncs: async () => {
        const queue = getSyncQueue();
        if (queue.length === 0) {
          set({ syncQueueCount: 0 });
          return;
        }
        await useStore.getState().syncToSupabase();
        const nextQueue = getSyncQueue();
        set({ syncQueueCount: nextQueue.length });
      },
    }),
    {
      name: FOCUSFLOW_ZUSTAND_PERSIST_NAME,
      storage: createJSONStorage(() => createScopedZustandStateStorage()),
      skipHydration: true,
      // Deserialize dates when loading from localStorage
      onRehydrateStorage: () => (state) => {
        if (state) {
          const deserialized = deserializeDates(state);
          // Update state with deserialized dates
          useStore.setState(deserialized);
        }
      },
      partialize: (state) => ({
        tasks: state.tasks,
        pomodoroSessions: state.pomodoroSessions,
        motivationalMessages: state.motivationalMessages,
        currentPomodoro: state.currentPomodoro,
        stats: state.stats,
        moodEntries: state.moodEntries,
        habits: state.habits,
        growthPlants: state.growthPlants,
        distractionSettings: state.distractionSettings,
        calendarIntegration: state.calendarIntegration,
        calendarEvents: state.calendarEvents,
        schedulePreferences: state.schedulePreferences,
        motivationPreferences: state.motivationPreferences,
        showMorningBriefing: state.showMorningBriefing,
        gettingStartedVisitedToday: state.gettingStartedVisitedToday,
        gettingStartedVisitedSettings: state.gettingStartedVisitedSettings,
        gettingStartedChecklistDismissed: state.gettingStartedChecklistDismissed,
        featureTourCompleted: state.featureTourCompleted,
        notes: state.notes,
        quickTodos: state.quickTodos,
        exams: state.exams,
        lastSync: state.lastSync,
      }),
    }
  )
);

let syncPushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncPushMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_PUSH_DEBOUNCE_MS = 900;
const SYNC_PUSH_MAX_WAIT_MS = 4500;

/** Coalesce rapid edits into fewer uploads; still guarantees a push within ~4.5s. */
export function scheduleSyncPushToCloud(): void {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  if (!syncPushMaxWaitTimer) {
    syncPushMaxWaitTimer = setTimeout(() => {
      syncPushMaxWaitTimer = null;
      if (syncPushDebounceTimer) {
        clearTimeout(syncPushDebounceTimer);
        syncPushDebounceTimer = null;
      }
      void useStore.getState().syncToSupabase().catch(() => {});
    }, SYNC_PUSH_MAX_WAIT_MS);
  }

  if (syncPushDebounceTimer) clearTimeout(syncPushDebounceTimer);
  syncPushDebounceTimer = setTimeout(() => {
    syncPushDebounceTimer = null;
    if (syncPushMaxWaitTimer) {
      clearTimeout(syncPushMaxWaitTimer);
      syncPushMaxWaitTimer = null;
    }
    void useStore.getState().syncToSupabase().catch(() => {});
  }, SYNC_PUSH_DEBOUNCE_MS);
}

/** Clear pending debounced upload and run one sync immediately (sign-out, tab hide, after remote deletes). */
export function flushSyncPushToCloud(): Promise<void> {
  if (syncPushDebounceTimer) {
    clearTimeout(syncPushDebounceTimer);
    syncPushDebounceTimer = null;
  }
  if (syncPushMaxWaitTimer) {
    clearTimeout(syncPushMaxWaitTimer);
    syncPushMaxWaitTimer = null;
  }
  if (typeof window === 'undefined' || !isSupabaseConfigured) return Promise.resolve();
  return useStore.getState().syncToSupabase();
}

/** Wipe in-memory planner data when switching from one signed-in Supabase user to another (not local↔user). */
export function resetFocusflowStoreData(): void {
  useStore.setState({
    tasks: [],
    pomodoroSessions: [],
    motivationalMessages: [],
    currentPomodoro: null,
    stats: { ...initialStats },
    moodEntries: [],
    habits: [],
    growthPlants: [],
    distractionSettings: { ...initialDistractionSettings },
    calendarIntegration: { ...initialCalendarIntegration },
    calendarEvents: [],
    schedulePreferences: { ...initialSchedulePreferences },
    motivationPreferences: { ...initialMotivationPreferences },
    showMorningBriefing: false,
    gettingStartedVisitedToday: false,
    gettingStartedVisitedSettings: false,
    gettingStartedChecklistDismissed: false,
    featureTourCompleted: false,
    notes: [],
    quickTodos: [],
    exams: [],
    isSyncing: false,
    completionSyncing: false,
    syncQueueCount: 0,
    lastSync: null,
    syncError: null,
  });
}
