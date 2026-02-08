import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CalendarEvent } from '@/types';

function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function inferDueDateFromText(text: string, today: Date): Date | null {
  const t = text.toLowerCase();
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  if (t.includes('today')) return base;
  if (t.includes('tomorrow')) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const inDaysMatch = t.match(/in\s+(\d+)\s+day/);
  if (inDaysMatch) {
    const n = parseInt(inDaysMatch[1], 10);
    if (!Number.isNaN(n)) {
      const d = new Date(base);
      d.setDate(d.getDate() + n);
      return d;
    }
  }

  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const nextPrefix = t.includes('next ');
  const thisPrefix = t.includes('this ') || t.includes('on ') || t.includes('coming ');

  for (let i = 0; i < weekdays.length; i++) {
    const w = weekdays[i];
    if (t.includes(w)) {
      const target = i;
      const dow = base.getDay();
      let delta = (target - dow + 7) % 7;
      if (delta === 0) delta = 7; // next occurrence by default
      if (nextPrefix) delta += 7;
      const d = new Date(base);
      d.setDate(d.getDate() + delta);
      return d;
    }
  }

  return null;
}

function nextOccurrenceForWeeklyRepeat(args: {
  today: Date;
  daysOfWeek: number[];
  startTimeHHMM: string | null;
}): Date {
  const { today, daysOfWeek, startTimeHHMM } = args;
  const now = new Date(today);
  const baseDay = new Date(now);
  baseDay.setHours(0, 0, 0, 0);

  const [sh, sm] = startTimeHHMM ? startTimeHHMM.split(':').map((v) => parseInt(v, 10)) : [0, 0];
  const todayDow = baseDay.getDay();

  // try today first if it's included and start time hasn't passed
  if (daysOfWeek.includes(todayDow)) {
    const candidate = new Date(baseDay);
    candidate.setHours(sh, sm, 0, 0);
    if (!startTimeHHMM || candidate.getTime() >= now.getTime()) return candidate;
  }

  // otherwise find the soonest next included weekday
  for (let delta = 1; delta <= 14; delta++) {
    const d = new Date(baseDay);
    d.setDate(d.getDate() + delta);
    if (daysOfWeek.includes(d.getDay())) {
      d.setHours(sh, sm, 0, 0);
      return d;
    }
  }

  // fallback (shouldn't happen)
  return baseDay;
}

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const isValidApiKey = API_KEY && 
  API_KEY.trim() !== '' && 
  !API_KEY.includes('PASTE_YOUR_KEY_HERE') &&
  !API_KEY.includes('your_') &&
  API_KEY.length > 20; 

if (!isValidApiKey) {
  console.warn('Gemini API key not found or invalid. Please set GEMINI_API_KEY in .env.local');
  console.warn('Get your API key from: https://makersuite.google.com/app/apikey');
}

const genAI = isValidApiKey ? new GoogleGenerativeAI(API_KEY) : null;

type ChunkedMicroTask = {
  title: string;
  description?: string;
  estimatedMinutes: number;
  order: number;
};

type ScheduledMicroTask = ChunkedMicroTask & {
  scheduledDate?: string; 
};

function safeJsonParse<T>(text: string): T {
  return JSON.parse(text) as T;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const jsonMatch =
    trimmed.match(/```json\s*([\s\S]*?)\s*```/) ||
    trimmed.match(/\[[\s\S]*\]/) ||
    trimmed.match(/\{[\s\S]*\}/);
  return (jsonMatch?.[1] || jsonMatch?.[0] || trimmed).trim();
}

export async function GET() {
  return NextResponse.json({
    configured: isValidApiKey,
    model: MODEL_NAME,
    message: isValidApiKey ? undefined : 'Please set GEMINI_API_KEY in .env.local. Get your key from https://makersuite.google.com/app/apikey',
  });
}

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json(
      { 
        error: 'Gemini API key not configured',
        message: 'Please set GEMINI_API_KEY in .env.local and restart the dev server. Get your key from https://makersuite.google.com/app/apikey'
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { action, ...data } = body;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    if (action === 'chunkTask') {
      const { title, description, estimatedHours } = data;
      
      const prompt = `Break down this academic task into a small, realistic plan. Avoid overwhelming the student.

Task: ${title}
Description: ${description || title}
Estimated Total Time: ${estimatedHours} hours

RULES:
- If total time is <= 2 hours: return 3-5 micro-tasks
- 2-4 hours: return 4-7 micro-tasks
- 4-8 hours: return 6-10 micro-tasks (never more than 10)
- Each micro-task should be meaningful (not tiny/fragmented).
- Estimated minutes per micro-task should vary (not all 30).
- Keep each micro-task usually 20-60 minutes. Use 15 minutes only for quick setup/review items.

Return ONLY a valid JSON array of micro-tasks:
[
  {
    "title": "specific micro-task title",
    "description": "brief description",
    "estimatedMinutes": 30,
    "order": 1
  }
]

Return ONLY the JSON array, nothing else.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonText = extractJson(text);
      const microTasks = safeJsonParse<ChunkedMicroTask[]>(jsonText);
      
      return NextResponse.json({
        success: true,
        microTasks: microTasks.map((mt, idx) => ({
          ...mt,
          id: `micro-${Date.now()}-${idx}`,
          parentTaskId: '', // Will be set by caller
          completed: false,
        })),
      });
    }

    if (action === 'parseTask') {
      const { text } = data;
      
      const nowLocal = new Date();
      const todayLocal = new Date(nowLocal);
      todayLocal.setHours(0, 0, 0, 0);

      const prompt = `You are an assistant for students. First classify the user's input as either:
1) A CALENDAR EVENT/CLASS (recurring or one-off) like "Physics class Monday and Thursday" or "Dentist appointment at 3pm"
2) A TASK/ASSIGNMENT to complete like "Study atomic physics test on Monday" or "Write English essay due next Friday"

IMPORTANT RULES:
- If it's a CLASS/EVENT, do NOT break it into steps. It should become a calendar event.
- If it mentions recurrence (e.g., "every Monday and Thursday", "Mondays + Thursdays"), set repeat.frequency = "weekly" and provide daysOfWeek.
- If it is a TASK with a due date like "test on Monday":
  - "on Monday" or "this Monday" means the NEXT occurrence of Monday (could be in 1-6 days).
  - "next Monday" means Monday of NEXT WEEK (7-13 days away), unless today is Monday in which case "this Monday" = today and "next Monday" = +7 days.
  - Always interpret the user's wording carefully so "coming Monday" is soon, not 7+ days away incorrectly.
- If no due date is present for a TASK, choose a reasonable default: 7 days from today.
- Estimate total effort (hours) realistically and NOT overwhelming.

User input: "${text}"
Today's date (local): ${toLocalYYYYMMDD(nowLocal)}
Current time (local): ${toLocalHHMM(nowLocal)}

Return ONLY valid JSON:
{
  "kind": "task" | "event",
  "title": "string",
  "description": "string | null",

  // If kind="task"
  "dueDate": "YYYY-MM-DD",
  "priority": "low" | "medium" | "high",
  "subject": "string | null",
  "estimatedHours": number,

  // If kind="event"
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:mm" | null,
  "endTime": "HH:mm" | null,
  "allDay": boolean,
  "eventType": "class" | "meeting" | "study" | "event" | "other",
  "repeat": null | {
    "frequency": "weekly",
    "interval": 1,
    "daysOfWeek": number[]
  }
}
Return ONLY the JSON object, nothing else.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonText = extractJson(responseText);
      const parsed = safeJsonParse<{
        kind?: 'task' | 'event';
        title?: string;
        description?: string | null;
        dueDate?: string;
        priority?: 'low' | 'medium' | 'high';
        subject?: string | null;
        estimatedHours?: number;
        startDate?: string;
        startTime?: string | null;
        endTime?: string | null;
        allDay?: boolean;
        eventType?: CalendarEvent['eventType'];
        repeat?: CalendarEvent['repeat'] | null;
      }>(jsonText);
      
      const kind: 'task' | 'event' = parsed.kind === 'event' ? 'event' : 'task';

      if (kind === 'event') {
        let startDate = parsed.startDate ? new Date(parsed.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) startDate = new Date();
        // Guardrail: weekly repeats must start on the next real occurrence (including today if applicable),
        // otherwise we don't block the calendar correctly and tasks can overlap.
        if (parsed.repeat?.frequency === 'weekly' && Array.isArray(parsed.repeat.daysOfWeek) && parsed.repeat.daysOfWeek.length) {
          startDate = nextOccurrenceForWeeklyRepeat({
            today: nowLocal,
            daysOfWeek: parsed.repeat.daysOfWeek,
            startTimeHHMM: parsed.startTime ?? null,
          });
        }

        // Guardrail: never return an event startDate in the past (in local terms)
        const start0 = new Date(startDate);
        start0.setHours(0, 0, 0, 0);
        if (start0 < todayLocal) startDate = new Date(todayLocal);

        return NextResponse.json({
          success: true,
          kind,
          title: parsed.title || 'Untitled Event',
          description: parsed.description || null,
          startDate: toLocalYYYYMMDD(startDate),
          startTime: parsed.startTime ?? null,
          endTime: parsed.endTime ?? null,
          allDay: parsed.allDay ?? false,
          eventType: parsed.eventType || 'class',
          repeat: parsed.repeat ?? null,
        });
      }

      // TASK: Validate and set defaults
      const today = nowLocal;
      const inferred = inferDueDateFromText(text, today);
      const dueDateRaw = inferred ?? (parsed.dueDate ? new Date(parsed.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      // Guardrail: never return a due date in the past
      const today0 = new Date(todayLocal);
      const dueDate = dueDateRaw < today0 ? new Date(today0) : dueDateRaw;
      return NextResponse.json({
        success: true,
        kind,
        title: parsed.title || 'Untitled Task',
        description: parsed.description || null,
        dueDate: toLocalYYYYMMDD(dueDate),
        priority: parsed.priority || 'medium',
        subject: parsed.subject || null,
        estimatedHours: parsed.estimatedHours || 2,
      });
    }

    if (action === 'scheduleTask') {
      const { task, existingTasks, calendarEvents } = data;
      
      const prompt = `You are an intelligent task scheduler. Schedule micro-tasks optimally across available days leading up to the due date.

Task to schedule:
- Title: ${task.title}
- Due Date: ${task.dueDate}
- Priority: ${task.priority}
- Estimated Hours: ${task.estimatedHours || 2}
- Micro-tasks: ${JSON.stringify(task.microTasks, null, 2)}

Existing tasks (avoid conflicts):
${JSON.stringify(existingTasks.slice(0, 10), null, 2)}

Calendar events (avoid time conflicts):
${JSON.stringify(calendarEvents.slice(0, 10), null, 2)}

Schedule micro-tasks intelligently:
1. Distribute evenly across days leading to due date
2. Prioritize high-priority tasks earlier
3. Avoid scheduling conflicts with existing tasks/events
4. Consider cognitive load (don't overload single days)
5. Leave buffer time before due date
6. Schedule shorter tasks on busier days

Return ONLY valid JSON (no markdown, no code blocks):
{
  "microTasks": [
    {
      "title": "micro-task title",
      "description": "description",
      "estimatedMinutes": 30,
      "order": 1,
      "scheduledDate": "YYYY-MM-DD"
    }
  ]
}

Return ONLY the JSON object, nothing else.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonText = extractJson(responseText);
      const scheduled = safeJsonParse<{ microTasks?: ScheduledMicroTask[] }>(jsonText);

      // Fallback: if model didn't provide scheduledDate, spread tasks evenly across days until due date
      const due = task?.dueDate ? new Date(task.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const base = (scheduled.microTasks && scheduled.microTasks.length) ? scheduled.microTasks : (task.microTasks as ScheduledMicroTask[]);
      const safeBase = Array.isArray(base) ? base : [];
      const today = new Date();
      const today0 = new Date(today);
      today0.setHours(0, 0, 0, 0);
      const due0 = new Date(due);
      due0.setHours(0, 0, 0, 0);
      const days = Math.max(1, Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      const withDates = safeBase.map((mt, idx) => {
        const proposed = mt.scheduledDate ? new Date(mt.scheduledDate) : null;
        let d = proposed && !Number.isNaN(proposed.getTime()) ? proposed : new Date(due0);
        if (!mt.scheduledDate) {
          d = new Date(due0);
          d.setDate(d.getDate() - (days - idx - 1));
        }
        // Clamp into [today, due] so the model can never schedule into the past.
        if (d < today0) d = new Date(today0);
        if (d > due0) d = new Date(due0);
        return { ...mt, scheduledDate: d.toISOString().split('T')[0] };
      });
      
      return NextResponse.json({
        success: true,
        microTasks: withDates,
      });
    }

    if (action === 'scheduleTasks') {
      const { tasks, availableHours } = data;
      
      const prompt = `You are an AI assistant helping students manage their academic workload. Your task is to:

1. Break down each task into small, manageable micro-tasks (15-45 minutes each)
2. Schedule tasks optimally based on:
   - Due dates and priorities
   - Available time slots
   - Student's cognitive load (spread difficult tasks)
   - Subject variety (mix different subjects)

Given these tasks:
${JSON.stringify(tasks, null, 2)}

And available hours:
${JSON.stringify(availableHours, null, 2)}

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "taskId": "task index (0-based)",
    "scheduledTime": "YYYY-MM-DDTHH:mm:ss",
    "microTasks": [
      {
        "title": "specific micro-task title",
        "description": "brief description",
        "estimatedMinutes": 30,
        "order": 1
      }
    ]
  }
]

Make micro-tasks specific, actionable, and time-bound. Ensure they build logically toward completing the main task. Return ONLY the JSON array.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      let jsonText = text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const scheduled = JSON.parse(jsonText);
      
      return NextResponse.json({
        success: true,
        scheduled,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to process request';
    console.error('Error with Gemini API:', error);
    
    // Detect network/connectivity issues
    const isNetworkError = 
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('network') ||
      message.includes('timeout');
    
    const errorResponse: { error: string; message?: string; networkIssue?: boolean } = {
      error: message,
    };
    
    if (isNetworkError) {
      errorResponse.networkIssue = true;
      errorResponse.message = 
        'Network connection failed. This might be due to:\n' +
        '• School/work network blocking Google APIs\n' +
        '• Firewall restrictions\n' +
        '• Internet connectivity issues\n\n' +
        'Try:\n' +
        '• Using a VPN (if allowed)\n' +
        '• Connecting to a different network\n' +
        '• Checking if generativelanguage.googleapis.com is accessible';
    }
    
    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  }
}
