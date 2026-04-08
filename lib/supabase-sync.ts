import { getSupabaseBrowser } from './supabase/browser';
import type {
  Task,
  MicroTask,
  PomodoroSession,
  CalendarEvent,
  ProgressStats,
  SchedulePreferences,
  MotivationPreferences,
  Note,
  Exam,
} from '@/types';
import { applyThemePreference, readThemePreference, type ThemePreference } from '@/lib/theme';

async function assertActiveUserMatches(expectedUserId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error('No authenticated Supabase user.');
  if (user.id !== expectedUserId) {
    throw new Error('Supabase user mismatch. Aborting sync to prevent cross-account writes.');
  }
}

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

const CAL_EVENT_TYPES = new Set<CalendarEvent['eventType']>([
  'class',
  'task',
  'event',
  'meeting',
  'study',
  'other',
]);
const CAL_REPEAT_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly', 'custom']);

function coerceCalendarDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value === null || value === undefined) return fallback;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Normalize for Postgres CHECK constraints and avoid Invalid Date breaking the whole upload batch. */
function calendarEventToUpsertRow(userId: string, event: CalendarEvent) {
  const now = new Date();
  const start = coerceCalendarDate(event.start, now);
  let end = coerceCalendarDate(event.end, now);
  if (end.getTime() < start.getTime()) {
    end = new Date(start.getTime() + 60_000);
  }
  const createdAt = coerceCalendarDate(event.createdAt, now);
  const updatedAt = coerceCalendarDate(event.updatedAt, now);
  const eventType = CAL_EVENT_TYPES.has(event.eventType) ? event.eventType : 'event';

  let repeatFrequency: string | null = null;
  let repeatInterval: number | null = null;
  let repeatEndDate: string | null = null;
  let repeatDaysOfWeek: number[] | null = null;

  const rep = event.repeat;
  if (rep?.frequency && CAL_REPEAT_FREQUENCIES.has(rep.frequency)) {
    repeatFrequency = rep.frequency;
    repeatInterval = Math.max(1, Math.min(365, Number(rep.interval) || 1));
    repeatEndDate = toISO(rep.endDate);
    if (Array.isArray(rep.daysOfWeek) && rep.daysOfWeek.length > 0) {
      const days = rep.daysOfWeek
        .map((x) => (typeof x === 'number' ? Math.round(x) : parseInt(String(x), 10)))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      repeatDaysOfWeek = days.length > 0 ? days : null;
    }
  }

  const title =
    typeof event.title === 'string' && event.title.trim().length > 0 ? event.title.trim() : 'Event';
  const color =
    typeof event.color === 'string' && event.color.trim().length > 0 ? event.color.trim() : '#6A9BCC';

  return {
    id: event.id,
    user_id: userId,
    title,
    description: event.description?.trim() || null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    all_day: !!event.allDay,
    event_type: eventType,
    color,
    location: event.location?.trim() || null,
    repeat_frequency: repeatFrequency,
    repeat_interval: repeatInterval,
    repeat_end_date: repeatEndDate,
    repeat_days_of_week: repeatDaysOfWeek,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    synced_at: now.toISOString(),
  };
}

const NOTES_MARKER = '\n\n__NOTES__:';
const SUBTOPICS_MARKER = '\n\n__SUBTOPICS__:';
const UNIT_SECTION_MARKER = '\n\n__UNIT_SECTION__:';
const FIXED_SLOT_MARKER = '\n\n__FIXED_SLOT__:';

const encodeMicroTaskDescription = (
  description?: string,
  notes?: string[],
  subtopics?: string[],
  unitSectionLabel?: string,
  fixedSlot?: boolean
) => {
  let s = description || '';
  if (subtopics && subtopics.length > 0) {
    s += `${SUBTOPICS_MARKER}${JSON.stringify(subtopics)}`;
  }
  if (unitSectionLabel && unitSectionLabel.trim()) {
    s += `${UNIT_SECTION_MARKER}${JSON.stringify(unitSectionLabel.trim())}`;
  }
  if (notes && notes.length > 0) {
    s += `${NOTES_MARKER}${JSON.stringify(notes)}`;
  }
  if (fixedSlot) {
    s += `${FIXED_SLOT_MARKER}1`;
  }
  return s || null;
};

const decodeMicroTaskDescription = (
  raw?: string | null
): {
  description?: string;
  notes?: string[];
  subtopics?: string[];
  unitSectionLabel?: string;
  fixedSlot?: boolean;
} => {
  if (!raw) return {};
  let rest = raw;
  let fixedSlot: boolean | undefined;
  const fIdx = rest.lastIndexOf(FIXED_SLOT_MARKER);
  if (fIdx !== -1) {
    const tail = rest.slice(fIdx + FIXED_SLOT_MARKER.length).trim();
    if (tail === '1' || tail === 'true') fixedSlot = true;
    rest = rest.slice(0, fIdx);
  }
  let notes: string[] | undefined;
  const nIdx = rest.lastIndexOf(NOTES_MARKER);
  if (nIdx !== -1) {
    const notesRaw = rest.slice(nIdx + NOTES_MARKER.length);
    rest = rest.slice(0, nIdx);
    try {
      const parsed = JSON.parse(notesRaw) as string[];
      if (Array.isArray(parsed)) notes = parsed;
    } catch {
      /* keep notes undefined */
    }
  }
  let unitSectionLabel: string | undefined;
  const uIdx = rest.lastIndexOf(UNIT_SECTION_MARKER);
  if (uIdx !== -1) {
    const unitRaw = rest.slice(uIdx + UNIT_SECTION_MARKER.length);
    rest = rest.slice(0, uIdx);
    try {
      const parsed = JSON.parse(unitRaw) as string;
      if (typeof parsed === 'string' && parsed.trim()) unitSectionLabel = parsed.trim();
    } catch {
      /* ignore */
    }
  }
  let subtopics: string[] | undefined;
  let description: string | undefined;
  const sIdx = rest.indexOf(SUBTOPICS_MARKER);
  if (sIdx !== -1) {
    description = rest.slice(0, sIdx) || undefined;
    try {
      const parsed = JSON.parse(rest.slice(sIdx + SUBTOPICS_MARKER.length)) as string[];
      if (Array.isArray(parsed)) subtopics = parsed;
    } catch {
      description = rest || undefined;
    }
  } else {
    description = rest || undefined;
  }
  return { description, notes, subtopics, unitSectionLabel, fixedSlot };
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
  featureTourCompleted?: boolean;
  notes: Note[];
  exams: Exam[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseBrowser();
    await assertActiveUserMatches(userId);
    // 1. Upsert user profile
    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: userId,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

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
        description: encodeMicroTaskDescription(
          mt.description,
          mt.notes,
          mt.subtopics,
          mt.unitSectionLabel,
          mt.fixedSlot
        ),
        estimated_minutes: mt.estimatedMinutes,
        order: mt.order,
        completed: mt.completed,
        completed_at: toISO(mt.completedAt),
        scheduled_date: mt.scheduledDate ? mt.scheduledDate.toISOString().split('T')[0] : null,
        scheduled_start: toISO(mt.scheduledStart),
        scheduled_end: toISO(mt.scheduledEnd),
        exam_id: mt.examId || null,
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
      const eventsData = data.calendarEvents.map((event) => calendarEventToUpsertRow(userId, event));

      const { error: eventsError } = await supabase
        .from('calendar_events')
        .upsert(eventsData, { onConflict: 'id' });

      if (eventsError) throw eventsError;
    }

    // 6. Upsert stats (always — even with zero tasks so cloud has a row)
    const { error: statsError } = await supabase.from('user_stats').upsert(
      {
        user_id: userId,
        tasks_completed: data.stats.tasksCompleted,
        micro_tasks_completed: data.stats.microTasksCompleted,
        total_focus_minutes: data.stats.totalFocusMinutes,
        current_streak: data.stats.currentStreak,
        longest_streak: data.stats.currentStreak,
        weekly_goal: data.stats.weeklyGoal,
        weekly_completed: data.stats.weeklyCompleted,
        focus_coins: data.stats.focusCoins,
        focus_coins_today: data.stats.focusCoinsToday,
        level: data.stats.level,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (statsError) throw statsError;

    // 7. Upsert preferences (always)
    const { error: prefsError } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        schedule_work_start: data.schedulePreferences.workStart,
        schedule_work_end: data.schedulePreferences.workEnd,
        schedule_weekend_start: data.schedulePreferences.weekendWorkStart?.trim() || null,
        schedule_weekend_end: data.schedulePreferences.weekendWorkEnd?.trim() || null,
        schedule_no_task_dates:
          Array.isArray(data.schedulePreferences.noTaskSchedulingDates) &&
          data.schedulePreferences.noTaskSchedulingDates.length > 0
            ? data.schedulePreferences.noTaskSchedulingDates
            : null,
        schedule_default_session_minutes: data.schedulePreferences.defaultSessionMinutes,
        schedule_break_minutes: data.schedulePreferences.breakMinutes,
        schedule_buffer_minutes: data.schedulePreferences.bufferMinutes,
        schedule_grade_level: data.schedulePreferences.gradeLevel?.trim() || null,
        schedule_study_pace: data.schedulePreferences.studyPace || null,
        calendar_event_color: data.schedulePreferences.calendarEventColor || null,
        calendar_task_color: data.schedulePreferences.calendarTaskColor || null,
        motivation_personal_goal: data.motivationPreferences.personalGoal || null,
        motivation_daily_briefing: data.motivationPreferences.dailyBriefingEnabled ?? null,
        theme_preference: readThemePreference(),
        feature_tour_completed: !!data.featureTourCompleted,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (prefsError) throw prefsError;

    if (data.notes.length > 0) {
      const notesRows = data.notes.map((n) => ({
        id: n.id,
        user_id: userId,
        subject_id: n.subjectId,
        title: n.title,
        content: n.content,
        created_at: n.createdAt,
        updated_at: n.updatedAt,
        linked_session_id: n.linkedSessionId || null,
      }));
      const { error: notesError } = await supabase.from('notes').upsert(notesRows, { onConflict: 'id' });
      if (notesError) throw notesError;
    }

    if (data.exams.length > 0) {
      const examRows = data.exams.map((e) => ({
        id: e.id,
        user_id: userId,
        name: e.name,
        subject: e.subject,
        exam_date: e.examDate,
        daily_hours: e.dailyHours,
        topics: Array.isArray(e.topics) ? e.topics : [],
        covered_topic_ids: Array.isArray(e.coveredTopicIds) ? e.coveredTopicIds : [],
        review_topic_ids: Array.isArray(e.reviewTopicIds) ? e.reviewTopicIds : [],
        sessions_generated: e.sessionsGenerated,
        created_at: e.createdAt,
      }));
      const { error: examsError } = await supabase.from('exams').upsert(examRows, { onConflict: 'id' });
      if (examsError) throw examsError;
    }

    return { success: true };
  } catch (error) {
    console.error('Upload to Supabase error:', error);
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    const details =
      error && typeof error === 'object' && 'details' in error && (error as { details?: string }).details
        ? ` (${String((error as { details: string }).details)})`
        : '';
    return {
      success: false,
      error: msg + details,
    };
  }
}

/** Delete task on server (micro_tasks CASCADE). Required so other devices don’t resurrect deleted tasks. */
export async function deleteRemoteTask(userId: string, taskId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = getSupabaseBrowser();
    await assertActiveUserMatches(userId);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.warn('deleteRemoteTask:', e);
    return { ok: false };
  }
}

export async function deleteRemoteCalendarEvent(userId: string, eventId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = getSupabaseBrowser();
    await assertActiveUserMatches(userId);
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId).eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.warn('deleteRemoteCalendarEvent:', e);
    return { ok: false };
  }
}

export async function deleteRemoteExam(userId: string, examId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = getSupabaseBrowser();
    await assertActiveUserMatches(userId);
    const { error } = await supabase.from('exams').delete().eq('id', examId).eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.warn('deleteRemoteExam:', e);
    return { ok: false };
  }
}

/** Successful cloud snapshot (empty arrays = new account / nothing uploaded yet). */
export type CloudPlannerData = {
  tasks: Task[];
  microTasks: MicroTask[];
  pomodoroSessions: PomodoroSession[];
  calendarEvents: CalendarEvent[];
  stats: ProgressStats | null;
  schedulePreferences: SchedulePreferences | null;
  motivationPreferences: MotivationPreferences | null;
  /** From `user_preferences.feature_tour_completed` — synced across browsers. */
  featureTourCompleted?: boolean;
  notes: Note[];
  exams: Exam[];
};

export type DownloadFromSupabaseResult =
  | { ok: true; data: CloudPlannerData }
  | { ok: false; error: string };

function formatSupabaseClientError(error: unknown): string {
  if (error && typeof error === 'object') {
    const o = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [o.message, o.details, o.hint].filter(Boolean);
    if (parts.length) return parts.join(' — ');
    if (o.code) return `Supabase error code: ${o.code}`;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error talking to Supabase';
}

// Download all data from Supabase
export async function downloadFromSupabase(userId: string): Promise<DownloadFromSupabaseResult> {
  try {
    const supabase = getSupabaseBrowser();
    await assertActiveUserMatches(userId);

    const [
      tasksRes,
      microTasksRes,
      sessionsRes,
      eventsRes,
      statsRes,
      prefsRes,
      notesRes,
      examsRes,
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('micro_tasks').select('*').eq('user_id', userId).order('order', { ascending: true }),
      supabase.from('pomodoro_sessions').select('*').eq('user_id', userId).order('start_time', { ascending: false }),
      supabase.from('calendar_events').select('*').eq('user_id', userId).order('start_time', { ascending: true }),
      supabase.from('user_stats').select('*').eq('user_id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('notes').select('*').eq('user_id', userId),
      supabase.from('exams').select('*').eq('user_id', userId),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (microTasksRes.error) throw microTasksRes.error;
    if (sessionsRes.error) throw sessionsRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (statsRes.error && statsRes.error.code !== 'PGRST116') throw statsRes.error;
    if (prefsRes.error && prefsRes.error.code !== 'PGRST116') throw prefsRes.error;
    if (notesRes.error) throw notesRes.error;
    if (examsRes.error) throw examsRes.error;

    const tasksData = tasksRes.data;
    const microTasksData = microTasksRes.data;
    const sessionsData = sessionsRes.data;
    const eventsData = eventsRes.data;
    const statsData = statsRes.data;
    const prefsData = prefsRes.data;
    const notesData = notesRes.data;
    const examsData = examsRes.data;

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
      const decoded = decodeMicroTaskDescription(mt.description);
      microTasksByTask.get(mt.task_id)!.push({
        ...decoded,
        id: mt.id,
        title: mt.title,
        estimatedMinutes: mt.estimated_minutes,
        completed: mt.completed,
        parentTaskId: mt.task_id,
        order: mt.order,
        scheduledDate: fromISO(mt.scheduled_date ? new Date(mt.scheduled_date).toISOString() : null),
        scheduledStart: fromISO(mt.scheduled_start),
        scheduledEnd: fromISO(mt.scheduled_end),
        completedAt: fromISO(mt.completed_at),
        examId: mt.exam_id || undefined,
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

    const paceRaw = prefsData?.schedule_study_pace;
    const studyPace =
      paceRaw === 'light' || paceRaw === 'balanced' || paceRaw === 'intensive' ? paceRaw : undefined;

    const schedulePreferences: SchedulePreferences | null = prefsData ? {
      workStart: prefsData.schedule_work_start,
      workEnd: prefsData.schedule_work_end,
      weekendWorkStart:
        typeof prefsData.schedule_weekend_start === 'string' && prefsData.schedule_weekend_start.trim()
          ? prefsData.schedule_weekend_start.trim()
          : undefined,
      weekendWorkEnd:
        typeof prefsData.schedule_weekend_end === 'string' && prefsData.schedule_weekend_end.trim()
          ? prefsData.schedule_weekend_end.trim()
          : undefined,
      noTaskSchedulingDates:
        Array.isArray(prefsData.schedule_no_task_dates) && prefsData.schedule_no_task_dates.length > 0
          ? prefsData.schedule_no_task_dates.map((x: unknown) => String(x)).filter(Boolean)
          : undefined,
      defaultSessionMinutes: prefsData.schedule_default_session_minutes,
      breakMinutes: prefsData.schedule_break_minutes,
      bufferMinutes: prefsData.schedule_buffer_minutes,
      gradeLevel: typeof prefsData.schedule_grade_level === 'string' ? prefsData.schedule_grade_level : '',
      studyPace,
      calendarEventColor:
        typeof prefsData.calendar_event_color === 'string' ? prefsData.calendar_event_color : undefined,
      calendarTaskColor:
        typeof prefsData.calendar_task_color === 'string' ? prefsData.calendar_task_color : undefined,
    } : null;

    const motivationPreferences: MotivationPreferences | null = prefsData
      ? {
          personalGoal: prefsData.motivation_personal_goal || undefined,
          ...(typeof prefsData.motivation_daily_briefing === 'boolean'
            ? { dailyBriefingEnabled: prefsData.motivation_daily_briefing }
            : {}),
        }
      : null;

    const themePreferenceRaw = prefsData?.theme_preference;
    if (
      themePreferenceRaw === 'light' ||
      themePreferenceRaw === 'dark' ||
      themePreferenceRaw === 'system'
    ) {
      applyThemePreference(themePreferenceRaw as ThemePreference);
    }

    const notes: Note[] = (notesData || []).map((n) => ({
      id: n.id,
      subjectId: n.subject_id,
      title: n.title,
      content: n.content,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      linkedSessionId: n.linked_session_id || undefined,
    }));

    const exams: Exam[] = (examsData || []).map((e) => ({
      id: e.id,
      name: e.name,
      subject: e.subject,
      examDate: e.exam_date,
      dailyHours: Number(e.daily_hours),
      topics: Array.isArray(e.topics) ? e.topics : [],
      coveredTopicIds: Array.isArray(e.covered_topic_ids) ? e.covered_topic_ids : [],
      reviewTopicIds: Array.isArray(e.review_topic_ids) ? e.review_topic_ids : [],
      sessionsGenerated: !!e.sessions_generated,
      createdAt: e.created_at,
    }));

    const featureTourCompleted =
      typeof prefsData?.feature_tour_completed === 'boolean' ? prefsData.feature_tour_completed : false;

    return {
      ok: true,
      data: {
        tasks,
        featureTourCompleted,
        microTasks: (microTasksData || []).map((mt) => {
          const d = decodeMicroTaskDescription(mt.description);
          return {
            ...d,
            id: mt.id,
            title: mt.title,
            estimatedMinutes: mt.estimated_minutes,
            completed: mt.completed,
            parentTaskId: mt.task_id,
            order: mt.order,
            scheduledDate: fromISO(mt.scheduled_date ? new Date(mt.scheduled_date).toISOString() : null),
            scheduledStart: fromISO(mt.scheduled_start),
            scheduledEnd: fromISO(mt.scheduled_end),
            completedAt: fromISO(mt.completed_at),
            examId: mt.exam_id || undefined,
          };
        }),
        pomodoroSessions,
        calendarEvents,
        stats,
        schedulePreferences,
        motivationPreferences,
        notes,
        exams,
      },
    };
  } catch (error) {
    console.error('Download from Supabase error:', error);
    return {
      ok: false,
      error: formatSupabaseClientError(error),
    };
  }
}

// Merge strategy: Supabase wins (cloud is source of truth when logged in)
export function mergeData(
  local: unknown,
  remote: unknown,
  strategy: 'remote' | 'local' | 'newest' = 'remote'
): unknown {
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
