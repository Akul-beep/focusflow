export interface MicroTask {
  id: string;
  title: string;
  description?: string;
  notes?: string[];
  /** When an exam block combines several topics (one calendar session). */
  subtopics?: string[];
  /** Syllabus unit/chapter label for this step (e.g. "Unit 2"). */
  unitSectionLabel?: string;
  source?: 'default' | 'exam-planner';
  /** When set, ties this step to an exam record for the exam dashboard */
  examId?: string;
  estimatedMinutes: number;
  completed: boolean;
  parentTaskId: string;
  order: number;
  scheduledDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  completedAt?: Date;
  /** Matches an entry in Exam.topics for progress (avoids "Revision: …" title mismatch) */
  examTopicKey?: string;
  /**
   * When true with scheduledStart/scheduledEnd, rebalance keeps this wall-clock block
   * (e.g. user said "past paper at 5pm") instead of repacking into the generic work window.
   */
  fixedSlot?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  subject?: string;
  microTasks: MicroTask[];
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  estimatedTotalMinutes: number;
}

export interface PomodoroSession {
  id: string;
  taskId: string;
  microTaskId?: string;
  duration: number;
  startTime: Date;
  endTime?: Date;
  completed: boolean;
  type: 'focus' | 'break';
}

export interface MotivationalMessage {
  id: string;
  message: string;
  type: 'encouragement' | 'progress' | 'reminder';
  timestamp: Date;
}

export interface ProgressStats {
  tasksCompleted: number;
  microTasksCompleted: number;
  totalFocusMinutes: number;
  currentStreak: number;
  weeklyGoal: number;
  weeklyCompleted: number;
  focusCoins: number;
  focusCoinsToday: number;
  level: number;
}

export interface MoodEntry {
  id: string;
  timestamp: Date;
  mood: 'great' | 'good' | 'okay' | 'tired' | 'stressed';
  note?: string;
  pomodoroSessionId?: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  streak: number;
  lastCompleted?: Date;
  color: string;
}

export interface GrowthPlant {
  id: string;
  type: 'seed' | 'sprout' | 'sapling' | 'tree' | 'flower';
  focusMinutes: number; // Total minutes needed to grow
  currentMinutes: number;
  plantedDate: Date;
  color: string;
}

export interface DistractionBlockSettings {
  enabled: boolean;
  blockedSites: string[];
  blockDuringFocus: boolean;
  allowBreakAccess: boolean;
}

export interface CalendarIntegration {
  type: 'google' | 'outlook' | 'lms' | 'none';
  connected: boolean;
  syncEnabled: boolean;
  lastSync?: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  eventType: 'class' | 'task' | 'event' | 'meeting' | 'study' | 'other';
  color: string;
  location?: string;
  repeat?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval: number; // e.g., every 2 weeks
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6 for weekly repeats
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulePreferences {
  // Work window in 24h HH:mm local time (weekdays Mon–Fri)
  workStart: string; // e.g. "16:00"
  workEnd: string;   // e.g. "20:30"
  /** Sat–Sun window; if omitted, weekday window is used on weekends too. */
  weekendWorkStart?: string;
  weekendWorkEnd?: string;
  // Scheduling behavior
  defaultSessionMinutes: number; // e.g. 30
  breakMinutes: number;          // e.g. 10
  bufferMinutes: number;         // e.g. 5 between sessions
  /** Student pacing style used for AI time estimates and scheduling intensity. */
  studyPace?: 'light' | 'balanced' | 'intensive';
  /**
   * Grade / program (e.g. "MYP 5", "IB DP") — passed to AI for per-topic study-time estimates.
   * Empty = generic upper-secondary assumption.
   */
  gradeLevel?: string;
  /** Calendar event pill color (hex) */
  calendarEventColor?: string;
  /** Scheduled task / study block color (hex) */
  calendarTaskColor?: string;
  /**
   * yyyy-MM-dd keys where the packer should not place tasks (e.g. user skipped a study day).
   * Persisted locally and synced to Supabase when signed in.
   */
  noTaskSchedulingDates?: string[];
}

export interface MotivationPreferences {
  personalGoal?: string; // e.g. "Getting into an Ivy League"
  /** When true, show the morning briefing overlay once per day */
  dailyBriefingEnabled?: boolean;
}

export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  linkedSessionId?: string;
}

/** Step under a planner todo (Microsoft To Do subtask). */
export interface PlannerTodoSubtask {
  id: string;
  title: string;
  completed: boolean;
}

/**
 * Microsoft To Do–style tasks on /todo · Todo tab.
 * Subtasks become micro-steps when you add to the AI scheduler.
 */
export interface PlannerTodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  subtasks: PlannerTodoSubtask[];
  /** Populated after “Add to planner” — links to a real Task on the calendar. */
  linkedTaskId?: string;
}

/** @deprecated alias */
export type QuickTodo = PlannerTodoItem;

export interface Exam {
  id: string;
  name: string;
  subject: string;
  examDate: string;
  dailyHours: number;
  topics: string[];
  coveredTopicIds: string[];
  /** Topics the student marked to revisit (bookmark), independent of "covered". */
  reviewTopicIds: string[];
  sessionsGenerated: boolean;
  createdAt: string;
}
