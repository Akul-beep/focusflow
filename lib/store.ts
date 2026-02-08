import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, MicroTask, PomodoroSession, MotivationalMessage, ProgressStats, MoodEntry, Habit, GrowthPlant, DistractionBlockSettings, CalendarIntegration, CalendarEvent, SchedulePreferences, MotivationPreferences } from '@/types';
import { rebalanceAllTaskSchedules } from '@/lib/scheduler';
import { uploadToSupabase, downloadFromSupabase } from '@/lib/supabase-sync';
import { supabase } from './supabase';

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
  
  // Actions
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
  updateSchedulePreferences: (prefs: SchedulePreferences) => void;
  updateMotivationPreferences: (prefs: MotivationPreferences) => void;
  rebalanceSchedule: () => void;
  
  // Sync functions
  syncToSupabase: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  isSyncing: boolean;
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
  workEnd: '20:30',
  defaultSessionMinutes: 30,
  breakMinutes: 10,
  bufferMinutes: 5,
};

const initialMotivationPreferences: MotivationPreferences = {
  personalGoal: '',
};

// Helper to deserialize dates from localStorage (avoid `any` to satisfy strict linting)
const deserializeDates = (state: unknown): AppState => {
  const s = (typeof state === 'object' && state !== null) ? (state as Record<string, unknown>) : {};
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const tasks = asArray<Record<string, unknown>>(s.tasks).map((task) => ({
    ...(task as unknown as Task),
    dueDate: new Date(String((task as Record<string, unknown>).dueDate)),
    createdAt: new Date(String((task as Record<string, unknown>).createdAt)),
    completedAt: (task as Record<string, unknown>).completedAt
      ? new Date(String((task as Record<string, unknown>).completedAt))
      : undefined,
    microTasks: asArray<Record<string, unknown>>((task as Record<string, unknown>).microTasks).map((mt) => ({
      ...(mt as unknown as MicroTask),
      scheduledDate: (mt as Record<string, unknown>).scheduledDate
        ? new Date(String((mt as Record<string, unknown>).scheduledDate))
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

  return {
    ...(s as unknown as AppState),
    stats: {
      ...initialStats,
      ...((s.stats as ProgressStats) || {}),
    },
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
    schedulePreferences: (s.schedulePreferences as SchedulePreferences) || initialSchedulePreferences,
    motivationPreferences: (s.motivationPreferences as MotivationPreferences) || initialMotivationPreferences,
  };
};

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

      addTask: (task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().updateStats();
        // Sync to Supabase (fire and forget)
        get().syncToSupabase().catch(() => {});
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
        }));
        get().updateStats();
        get().syncToSupabase().catch(() => {});
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
        get().updateStats();
        get().syncToSupabase().catch(() => {});
      },

      completeTask: (taskId) => {
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
        get().updateStats();
      },

      completeMicroTask: (microTaskId) => {
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
        get().updateStats();
        get().syncToSupabase().catch(() => {});
      },

      toggleTaskComplete: (taskId) => {
        set((state) => {
          const target = state.tasks.find((t) => t.id === taskId);
          if (!target) return state;

          const now = new Date();
          const becomingCompleted = !target.completed;

          const tasks = state.tasks.map((task) => {
            if (task.id !== taskId) return task;
            if (becomingCompleted) {
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
            // Undo completion: reopen everything for simplicity/consistency
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

          const motivationalMessages = becomingCompleted
            ? [
                {
                  id: Date.now().toString(),
                  message: `Task "${target.title}" completed`,
                  type: 'progress' as const,
                  timestamp: now,
                },
                ...state.motivationalMessages.slice(0, 9),
              ]
            : state.motivationalMessages;

          return { tasks, motivationalMessages };
        });
        get().updateStats();
      },

      toggleMicroTaskComplete: (microTaskId) => {
        set((state) => {
          const now = new Date();
          let parentId: string | null = null;
          let microTitle: string | null = null;
          let becomingCompleted = false;

          const tasks = state.tasks.map((task) => {
            const nextMicroTasks = task.microTasks.map((mt) => {
              if (mt.id !== microTaskId) return mt;
              parentId = mt.parentTaskId;
              microTitle = mt.title;
              becomingCompleted = !mt.completed;
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
        get().updateStats();
      },

      addPomodoroSession: (session) => {
        set((state) => ({
          pomodoroSessions: [...state.pomodoroSessions, session],
        }));
        get().updateStats();
        get().syncToSupabase().catch(() => {});
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
          const totalFocusMinutes = state.pomodoroSessions
            .filter((s) => s.completed)
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
                new Date(s.endTime) >= weekStart
            )
            .reduce((acc, s) => acc + s.duration, 0) / 60;

          // Calculate streak - consecutive days with activity (completed pomodoro OR completed micro-task)
          let currentStreak = 0;
          const completedSessionDays = state.pomodoroSessions
            .filter((s) => s.completed && s.endTime)
            .map((s) => {
              const date = new Date(s.endTime!);
              date.setHours(0, 0, 0, 0);
              return date.getTime();
            });

          const completedMicroTaskDays = state.tasks
            .flatMap((t) => t.microTasks)
            .filter((mt) => mt.completed && mt.completedAt)
            .map((mt) => {
              const date = new Date(mt.completedAt!);
              date.setHours(0, 0, 0, 0);
              return date.getTime();
            });

          const uniqueDays = Array.from(new Set([...completedSessionDays, ...completedMicroTaskDays])).sort((a, b) => b - a);
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
              .filter((s) => s.completed && s.endTime)
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
          get().syncToSupabase().catch(() => {});
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
          get().syncToSupabase().catch(() => {});
          return { calendarEvents, tasks };
        }),

      deleteCalendarEvent: (id) =>
        set((state) => {
          const calendarEvents = state.calendarEvents.filter((event) => event.id !== id);
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          });
          get().syncToSupabase().catch(() => {});
          return { calendarEvents, tasks };
        }),

      updateSchedulePreferences: (prefs) =>
        set((state) => {
          const next = { schedulePreferences: prefs } as Partial<AppState>;
          const tasks = rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents: state.calendarEvents,
            prefs,
            from: new Date(),
          });
          get().syncToSupabase().catch(() => {});
          return { ...next, tasks };
        }),

      updateMotivationPreferences: (prefs) => {
        set(() => ({ motivationPreferences: prefs }));
        get().syncToSupabase().catch(() => {});
      },

      rebalanceSchedule: () =>
        set((state) => ({
          tasks: rebalanceAllTaskSchedules({
            tasks: state.tasks,
            calendarEvents: state.calendarEvents,
            prefs: state.schedulePreferences,
            from: new Date(),
          }),
        })),

      // Sync state
      isSyncing: false,
      lastSync: null,
      syncError: null,

      // Sync to Supabase
      syncToSupabase: async () => {
        const state = useStore.getState();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in, skip sync (local storage only)
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
          });

          if (result.success) {
            set({ lastSync: new Date(), isSyncing: false, syncError: null });
          } else {
            set({ isSyncing: false, syncError: result.error || 'Sync failed' });
          }
        } catch (error) {
          console.error('Sync error:', error);
          set({ 
            isSyncing: false, 
            syncError: error instanceof Error ? error.message : 'Unknown sync error' 
          });
        }
      },

      // Sync from Supabase
      syncFromSupabase: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in, keep local data
          return;
        }

        set({ isSyncing: true, syncError: null });

        try {
          const remoteData = await downloadFromSupabase(user.id);
          
          if (remoteData) {
            // Merge: remote wins (cloud is source of truth)
            set((state) => ({
              tasks: remoteData.tasks.length > 0 ? remoteData.tasks : state.tasks,
              pomodoroSessions: remoteData.pomodoroSessions.length > 0 ? remoteData.pomodoroSessions : state.pomodoroSessions,
              calendarEvents: remoteData.calendarEvents.length > 0 ? remoteData.calendarEvents : state.calendarEvents,
              stats: remoteData.stats || state.stats,
              schedulePreferences: remoteData.schedulePreferences || state.schedulePreferences,
              motivationPreferences: remoteData.motivationPreferences || state.motivationPreferences,
              lastSync: new Date(),
              isSyncing: false,
              syncError: null,
            }));
          } else {
            set({ isSyncing: false, syncError: 'No data received from server' });
          }
        } catch (error) {
          console.error('Download sync error:', error);
          set({ 
            isSyncing: false, 
            syncError: error instanceof Error ? error.message : 'Unknown download error' 
          });
        }
      },
    }),
    {
      name: 'student-scheduler-storage',
      // Deserialize dates when loading from localStorage
      onRehydrateStorage: () => (state) => {
        if (state) {
          const deserialized = deserializeDates(state);
          // Update state with deserialized dates
          useStore.setState(deserialized);
        }
      },
    }
  )
);
