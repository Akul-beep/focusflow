export interface MicroTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  completed: boolean;
  parentTaskId: string;
  order: number;
  scheduledDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  completedAt?: Date;
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
  // Work window in 24h HH:mm local time
  workStart: string; // e.g. "16:00"
  workEnd: string;   // e.g. "20:30"
  // Scheduling behavior
  defaultSessionMinutes: number; // e.g. 30
  breakMinutes: number;          // e.g. 10
  bufferMinutes: number;         // e.g. 5 between sessions
}

export interface MotivationPreferences {
  personalGoal?: string; // e.g. "Getting into an Ivy League"
}
