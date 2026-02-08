import { supabase } from './supabase';
import type { Task, MicroTask, PomodoroSession, CalendarEvent, ProgressStats, SchedulePreferences, MotivationPreferences } from '@/types';

export interface SyncStatus {
  syncing: boolean;
  lastSync: Date | null;
  error: string | null;
}

// Convert Date objects to ISO strings for Supabase
const toISO = (date: Date | undefined): string | null => {
  return date ? date.toISOString() : null;
};

// Convert ISO strings from Supabase to Date objects
const fromISO = (iso: string | null | undefined): Date | undefined => {
  return iso ? new Date(iso) : undefined;
};

// Upload all data to Supabase
export async function uploadToSupabase(userId: string, data: {
  tasks: Task[];
  microTasks: MicroTask[];
  pomodoroSessions: PomodoroSession[];
  calendarEvents: CalendarEvent[];
  stats: ProgressStats;
  schedulePreferences: SchedulePreferences;
  motivationPreferences: MotivationPreferences;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Upsert user profile
    await supabase.from('user_profiles').upsert({
      id: userId,
      updated_at: new Date().toISOString(),
    });

    // 2. Upsert tasks
    if (data.tasks.length > 0) {
      const tasksData = data.tasks.map(task => ({
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description || null,
        due_date: task.dueDate.toISOString(),
        priority: task.priority,
        subject: task.subject || null,
        completed: task.completed,
        completed_at: toISO(task.completedAt),
        estimated_total_minutes: task.estimatedTotalMinutes,
        created_at: task.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

      const { error: tasksError } = await supabase
        .from('tasks')
        .upsert(tasksData, { onConflict: 'id' });

      if (tasksError) throw tasksError;
    }

    // 3. Upsert micro tasks
    const allMicroTasks = data.tasks.flatMap(task => task.microTasks);
    if (allMicroTasks.length > 0) {
      const microTasksData = allMicroTasks.map(mt => ({
        id: mt.id,
        task_id: mt.parentTaskId,
        user_id: userId,
        title: mt.title,
        description: mt.description || null,
        estimated_minutes: mt.estimatedMinutes,
        order: mt.order,
        completed: mt.completed,
        completed_at: toISO(mt.completedAt),
        scheduled_date: mt.scheduledDate ? mt.scheduledDate.toISOString().split('T')[0] : null,
        scheduled_start: toISO(mt.scheduledStart),
        scheduled_end: toISO(mt.scheduledEnd),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

      const { error: microTasksError } = await supabase
        .from('micro_tasks')
        .upsert(microTasksData, { onConflict: 'id' });

      if (microTasksError) throw microTasksError;
    }

    // 4. Upsert pomodoro sessions
    if (data.pomodoroSessions.length > 0) {
      const sessionsData = data.pomodoroSessions.map(session => ({
        id: session.id,
        user_id: userId,
        task_id: session.taskId,
        micro_task_id: session.microTaskId || null,
        duration: session.duration,
        start_time: session.startTime.toISOString(),
        end_time: toISO(session.endTime),
        completed: session.completed,
        type: session.type,
        created_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

      const { error: sessionsError } = await supabase
        .from('pomodoro_sessions')
        .upsert(sessionsData, { onConflict: 'id' });

      if (sessionsError) throw sessionsError;
    }

    // 5. Upsert calendar events
    if (data.calendarEvents.length > 0) {
      const eventsData = data.calendarEvents.map(event => ({
        id: event.id,
        user_id: userId,
        title: event.title,
        description: event.description || null,
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        all_day: event.allDay,
        event_type: event.eventType,
        color: event.color,
        location: event.location || null,
        repeat_frequency: event.repeat?.frequency || null,
        repeat_interval: event.repeat?.interval || null,
        repeat_end_date: toISO(event.repeat?.endDate),
        repeat_days_of_week: event.repeat?.daysOfWeek || null,
        created_at: event.createdAt.toISOString(),
        updated_at: event.updatedAt.toISOString(),
        synced_at: new Date().toISOString(),
      }));

      const { error: eventsError } = await supabase
        .from('calendar_events')
        .upsert(eventsData, { onConflict: 'id' });

      if (eventsError) throw eventsError;
    }

    // 6. Upsert stats
    await supabase.from('user_stats').upsert({
      user_id: userId,
      tasks_completed: data.stats.tasksCompleted,
      micro_tasks_completed: data.stats.microTasksCompleted,
      total_focus_minutes: data.stats.totalFocusMinutes,
      current_streak: data.stats.currentStreak,
      longest_streak: data.stats.currentStreak, // Update if needed
      weekly_goal: data.stats.weeklyGoal,
      weekly_completed: data.stats.weeklyCompleted,
      focus_coins: data.stats.focusCoins,
      focus_coins_today: data.stats.focusCoinsToday,
      level: data.stats.level,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // 7. Upsert preferences
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      schedule_work_start: data.schedulePreferences.workStart,
      schedule_work_end: data.schedulePreferences.workEnd,
      schedule_default_session_minutes: data.schedulePreferences.defaultSessionMinutes,
      schedule_break_minutes: data.schedulePreferences.breakMinutes,
      schedule_buffer_minutes: data.schedulePreferences.bufferMinutes,
      motivation_personal_goal: data.motivationPreferences.personalGoal || null,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return { success: true };
  } catch (error) {
    console.error('Upload to Supabase error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Download all data from Supabase
export async function downloadFromSupabase(userId: string): Promise<{
  tasks: Task[];
  microTasks: MicroTask[];
  pomodoroSessions: PomodoroSession[];
  calendarEvents: CalendarEvent[];
  stats: ProgressStats | null;
  schedulePreferences: SchedulePreferences | null;
  motivationPreferences: MotivationPreferences | null;
} | null> {
  try {
    // 1. Get tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (tasksError) throw tasksError;

    // 2. Get micro tasks
    const { data: microTasksData, error: microTasksError } = await supabase
      .from('micro_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true });

    if (microTasksError) throw microTasksError;

    // 3. Get pomodoro sessions
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (sessionsError) throw sessionsError;

    // 4. Get calendar events
    const { data: eventsData, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (eventsError) throw eventsError;

    // 5. Get stats
    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError && statsError.code !== 'PGRST116') throw statsError; // PGRST116 = not found

    // 6. Get preferences
    const { data: prefsData, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;

    // Transform data to match app types
    const tasks: Task[] = (tasksData || []).map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || undefined,
      dueDate: new Date(task.due_date),
      priority: task.priority as 'low' | 'medium' | 'high',
      subject: task.subject || undefined,
      completed: task.completed,
      completedAt: fromISO(task.completed_at),
      createdAt: new Date(task.created_at),
      estimatedTotalMinutes: task.estimated_total_minutes,
      microTasks: [], // Will be populated below
    }));

    // Group micro tasks by task
    const microTasksByTask = new Map<string, MicroTask[]>();
    (microTasksData || []).forEach(mt => {
      if (!microTasksByTask.has(mt.task_id)) {
        microTasksByTask.set(mt.task_id, []);
      }
      microTasksByTask.get(mt.task_id)!.push({
        id: mt.id,
        title: mt.title,
        description: mt.description || undefined,
        estimatedMinutes: mt.estimated_minutes,
        completed: mt.completed,
        parentTaskId: mt.task_id,
        order: mt.order,
        scheduledDate: fromISO(mt.scheduled_date ? new Date(mt.scheduled_date).toISOString() : null),
        scheduledStart: fromISO(mt.scheduled_start),
        scheduledEnd: fromISO(mt.scheduled_end),
        completedAt: fromISO(mt.completed_at),
      });
    });

    // Attach micro tasks to tasks
    tasks.forEach(task => {
      task.microTasks = microTasksByTask.get(task.id) || [];
    });

    const pomodoroSessions: PomodoroSession[] = (sessionsData || []).map(session => ({
      id: session.id,
      taskId: session.task_id,
      microTaskId: session.micro_task_id || undefined,
      duration: session.duration,
      startTime: new Date(session.start_time),
      endTime: fromISO(session.end_time),
      completed: session.completed,
      type: session.type as 'focus' | 'break',
    }));

    const calendarEvents: CalendarEvent[] = (eventsData || []).map(event => ({
      id: event.id,
      title: event.title,
      description: event.description || undefined,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      allDay: event.all_day,
      eventType: event.event_type as CalendarEvent['eventType'],
      color: event.color,
      location: event.location || undefined,
      repeat: event.repeat_frequency ? {
        frequency: event.repeat_frequency as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
        interval: event.repeat_interval || 1,
        endDate: fromISO(event.repeat_end_date),
        daysOfWeek: event.repeat_days_of_week || undefined,
      } : undefined,
      createdAt: new Date(event.created_at),
      updatedAt: new Date(event.updated_at),
    }));

    const stats: ProgressStats | null = statsData ? {
      tasksCompleted: statsData.tasks_completed,
      microTasksCompleted: statsData.micro_tasks_completed,
      totalFocusMinutes: statsData.total_focus_minutes,
      currentStreak: statsData.current_streak,
      weeklyGoal: statsData.weekly_goal,
      weeklyCompleted: Number(statsData.weekly_completed),
      focusCoins: statsData.focus_coins,
      focusCoinsToday: statsData.focus_coins_today,
      level: statsData.level,
    } : null;

    const schedulePreferences: SchedulePreferences | null = prefsData ? {
      workStart: prefsData.schedule_work_start,
      workEnd: prefsData.schedule_work_end,
      defaultSessionMinutes: prefsData.schedule_default_session_minutes,
      breakMinutes: prefsData.schedule_break_minutes,
      bufferMinutes: prefsData.schedule_buffer_minutes,
    } : null;

    const motivationPreferences: MotivationPreferences | null = prefsData ? {
      personalGoal: prefsData.motivation_personal_goal || undefined,
    } : null;

    return {
      tasks,
      microTasks: (microTasksData || []).map(mt => ({
        id: mt.id,
        title: mt.title,
        description: mt.description || undefined,
        estimatedMinutes: mt.estimated_minutes,
        completed: mt.completed,
        parentTaskId: mt.task_id,
        order: mt.order,
        scheduledDate: fromISO(mt.scheduled_date ? new Date(mt.scheduled_date).toISOString() : null),
        scheduledStart: fromISO(mt.scheduled_start),
        scheduledEnd: fromISO(mt.scheduled_end),
        completedAt: fromISO(mt.completed_at),
      })),
      pomodoroSessions,
      calendarEvents,
      stats,
      schedulePreferences,
      motivationPreferences,
    };
  } catch (error) {
    console.error('Download from Supabase error:', error);
    return null;
  }
}

// Merge strategy: Supabase wins (cloud is source of truth when logged in)
export function mergeData(
  local: any,
  remote: any,
  strategy: 'remote' | 'local' | 'newest' = 'remote'
): any {
  if (strategy === 'remote') {
    return remote || local;
  }
  if (strategy === 'local') {
    return local || remote;
  }
  // newest: compare timestamps
  // For now, remote wins
  return remote || local;
}
