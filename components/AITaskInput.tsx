'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, X, Check, HelpCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task, MicroTask, CalendarEvent } from '@/types';
import { scheduleMicroTasksIntoTimes } from '@/lib/scheduler';
import { makeId } from '@/lib/ids';

interface AITaskInputProps {
  onTaskCreated?: () => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

type ParsedTaskResponse =
  | {
      success: boolean;
      kind: 'task';
      title: string;
      description?: string | null;
      dueDate: string; // YYYY-MM-DD
      priority: 'low' | 'medium' | 'high';
      subject?: string | null;
      estimatedHours: number;
    }
  | {
      success: boolean;
      kind: 'event';
      title: string;
      description?: string | null;
      startDate: string; // YYYY-MM-DD
      startTime: string | null; // HH:mm
      endTime: string | null; // HH:mm
      allDay: boolean;
      eventType: CalendarEvent['eventType'];
      repeat: null | {
        frequency: 'weekly';
        interval: 1;
        daysOfWeek: number[];
      };
    };

type ScheduledTaskResponse = {
  success: boolean;
  microTasks: Array<{
    title: string;
    description?: string;
    estimatedMinutes: number;
    order?: number;
    scheduledDate?: string; // YYYY-MM-DD
  }>;
};

export default function AITaskInput({ onTaskCreated }: AITaskInputProps) {
  const { tasks, addTask, calendarEvents, addCalendarEvent, schedulePreferences } = useStore();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [previewTask, setPreviewTask] = useState<{
    title: string;
    description?: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
    microTasks: MicroTask[];
    estimatedTotalMinutes: number;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmitRef = useRef<(text?: string) => void>(() => {});

  useEffect(() => {
    // Check if the server has GEMINI_API_KEY loaded (avoids confusing "Failed to parse task")
    fetch('/api/gemini')
      .then((r) => r.json())
      .then((d: { configured?: boolean; message?: string }) => {
        setApiConfigured(!!d.configured);
        setApiMessage(d.message || null);
      })
      .catch(() => {
        setApiConfigured(false);
        setApiMessage('Unable to check API configuration');
      });
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionCtor =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

      if (!SpeechRecognitionCtor) {
        setSpeechSupported(false);
        return;
      }

      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognitionCtor();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSubmitRef.current(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);


  const startListening = () => {
    if (!speechSupported) {
      alert('Dictation is not supported in this browser. Try Chrome, or type your task instead.');
      return;
    }
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // always point to the latest handler (dictation callbacks can outlive renders)
  handleSubmitRef.current = handleSubmit;

  const parseNaturalLanguage = async (text: string) => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parseTask',
          text,
        }),
      });

      if (!response.ok) {
        let msg = 'Failed to parse task';
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson?.error) msg = errJson.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data: ParsedTaskResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error parsing task:', error);
      throw error;
    }
  };

  const scheduleTask = async (taskData: { title: string; dueDate: string; priority: 'low' | 'medium' | 'high'; estimatedHours: number; microTasks: Array<{ title: string; description?: string; estimatedMinutes: number; order?: number }> }) => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scheduleTask',
          task: taskData,
          existingTasks: tasks.filter(t => !t.completed).map(t => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            microTasks: t.microTasks.filter(mt => !mt.completed),
          })),
          calendarEvents: calendarEvents.map(e => ({
            start: e.start,
            end: e.end,
            title: e.title,
          })),
        }),
      });

      if (!response.ok) {
        let msg = 'Failed to schedule task';
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson?.error) msg = errJson.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data: ScheduledTaskResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error scheduling task:', error);
      throw error;
    }
  };

  async function handleSubmit(text?: string) {
    handleSubmitRef.current = handleSubmit;
    if (apiConfigured === false) {
      alert(apiMessage || 'Gemini API is not configured. Add GEMINI_API_KEY to .env.local and restart the dev server.');
      return;
    }
    const taskText = text || input.trim();
    if (!taskText) return;

    setIsProcessing(true);
    setInput('');

    try {
      // Step 1: Parse natural language
      const parsed = await parseNaturalLanguage(taskText);

      // If the user is describing a CLASS/EVENT, create a calendar event (no task chunking)
      if (parsed.kind === 'event') {
        const startDate = new Date(parsed.startDate);
        const toDateTime = (d: Date, hhmm: string | null, fallbackMinutes: number) => {
          const base = new Date(d);
          base.setHours(0, 0, 0, 0);
          if (!hhmm) {
            base.setMinutes(fallbackMinutes);
            return base;
          }
          const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
          base.setHours(h, m, 0, 0);
          return base;
        };

        const start = parsed.allDay ? new Date(parsed.startDate) : toDateTime(startDate, parsed.startTime, 9 * 60);
        const end = parsed.allDay ? new Date(parsed.startDate) : toDateTime(startDate, parsed.endTime, 10 * 60);

        addCalendarEvent({
          title: parsed.title,
          description: parsed.description ?? undefined,
          start,
          end,
          allDay: parsed.allDay,
          eventType: parsed.eventType || 'class',
          color:
            parsed.eventType === 'class'
              ? '#6A9BCC'
              : parsed.eventType === 'meeting'
              ? '#141413'
              : parsed.eventType === 'study'
              ? '#788C5D'
              : '#D97757',
          repeat: parsed.repeat
            ? {
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: parsed.repeat.daysOfWeek,
              }
            : undefined,
          location: undefined,
        });

        setIsProcessing(false);
        alert('Added to Calendar.');
        return;
      }
      
      // Step 2: Break down into micro-tasks
      const breakdownResponse = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chunkTask',
          title: parsed.title,
          description: parsed.description || parsed.title,
          estimatedHours: parsed.estimatedHours || 2,
        }),
      });

      if (!breakdownResponse.ok) throw new Error('Failed to break down task');
      const breakdownData = await breakdownResponse.json();

      // Step 3: Use server schedule (day-level) as a starting point, then do local time-slot scheduling
      const scheduled = await scheduleTask({
        title: parsed.title,
        dueDate: parsed.dueDate,
        priority: parsed.priority || 'medium',
        estimatedHours: parsed.estimatedHours || 2,
        microTasks: breakdownData.microTasks,
      });

      const baseMicroTasks: Array<{
        id?: string;
        title: string;
        description?: string;
        estimatedMinutes: number;
        order?: number;
        scheduledDate?: string;
      }> =
        (scheduled.microTasks && scheduled.microTasks.length
          ? scheduled.microTasks
          : (breakdownData.microTasks as Array<{ id?: string; title: string; description?: string; estimatedMinutes: number; order?: number; scheduledDate?: string }>)) || [];

      const previewMicroTasks: MicroTask[] = baseMicroTasks.map((mt, idx) => ({
        id: mt.id || `preview-${idx}`,
        title: mt.title,
        description: mt.description,
        estimatedMinutes: mt.estimatedMinutes,
        completed: false,
        parentTaskId: 'preview',
        order: mt.order ?? idx + 1,
        scheduledDate: mt.scheduledDate ? new Date(mt.scheduledDate) : undefined,
      }));

      const dueDay = new Date(parsed.dueDate);
      const scheduledTimes = scheduleMicroTasksIntoTimes({
        microTasks: previewMicroTasks,
        startDay: new Date(),
        dueDay,
        prefs: schedulePreferences,
        calendarEvents,
        existingTasks: tasks,
      });
      const previewWithTimes: MicroTask[] = [
        ...scheduledTimes.scheduled,
        ...scheduledTimes.unscheduled,
      ].map((mt, i) => ({
        ...mt,
        order: mt.order ?? i + 1,
        scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
      }));

      // Step 4: Show preview
      setPreviewTask({
        title: parsed.title,
        description: parsed.description ?? undefined,
        dueDate: new Date(parsed.dueDate),
        priority: parsed.priority || 'medium',
        subject: parsed.subject ?? undefined,
        microTasks: previewWithTimes,
        estimatedTotalMinutes: (parsed.estimatedHours || 2) * 60,
      });
    } catch (error) {
      console.error('Error processing task:', error);
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      alert(
        `${msg}\n\nIf this mentions an API key: add GEMINI_API_KEY to .env.local and restart the dev server.`
      );
    } finally {
      setIsProcessing(false);
    }
  }

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
      })),
      completed: false,
      createdAt: new Date(),
      estimatedTotalMinutes: previewTask.estimatedTotalMinutes,
    };

    addTask(newTask);
    setPreviewTask(null);
    setInput('');
    if (onTaskCreated) onTaskCreated();
  };

  const activeTasks = tasks.filter((t) => !t.completed).length;

  const examples = [
    "Math homework due tomorrow",
    "2000-word essay on climate change due next Friday",
    "Science project presentation due in 2 weeks",
  ];

  if (previewTask) {
    return (
      <div className="bg-white rounded-xl p-4 border border-[#E8E6DC]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-heading font-medium text-[#B0AEA5]">AI suggestion</span>
          <button
            onClick={() => setPreviewTask(null)}
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
          <div className="flex items-center gap-2 mt-1 text-xs text-[#B0AEA5]">
            <span>Due: {previewTask.dueDate.toLocaleDateString()}</span>
            <span>•</span>
            <span>{previewTask.microTasks.length} steps</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewTask(null)}
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
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-heading font-medium text-[#B0AEA5]">AI Task Creator</span>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-1 text-[#B0AEA5] hover:text-[#D97757] rounded"
          title="How to use"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {apiConfigured === false && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-[#E8E6DC]">
          <p className="text-xs font-heading font-semibold text-[#D97757] mb-1">
            AI is not connected
          </p>
          <p className="text-xs text-[#B0AEA5] font-body">
            {apiMessage || 'Create student-scheduler/.env.local with GEMINI_API_KEY, then restart npm run dev.'}
          </p>
        </div>
      )}

      {showHelp && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-[#E8E6DC] text-xs text-[#141413]">
          <p className="font-heading font-semibold mb-2">How to use</p>
          <ul className="space-y-1 text-[#B0AEA5] font-body">
            <li>• Type what you need to do</li>
            <li>• Include when it’s due (for example: “tomorrow”, “next Friday”)</li>
            <li>• Or tap the mic to speak instead</li>
            <li>• The AI will break it into small steps</li>
          </ul>
          <p className="mt-2 font-heading font-semibold text-[#D97757]">Examples</p>
          <ul className="mt-1 space-y-1 text-[#B0AEA5] font-body">
            {examples.map((ex, i) => (
              <li key={i}>• {ex}</li>
            ))}
          </ul>
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
          placeholder="Math homework due tomorrow"
          className="w-full px-3 py-2.5 pr-20 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] focus:border-[#D97757] font-body resize-none transition-all bg-white"
          rows={3}
          disabled={isProcessing || apiConfigured === false}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-1.5 rounded transition-all ${
              isListening
                ? 'bg-[#D97757] text-white animate-pulse'
                : 'text-[#B0AEA5] hover:text-[#D97757] hover:bg-[#FAF9F5]'
            } ${!speechSupported ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
            disabled={isProcessing || !speechSupported || apiConfigured === false}
            title={
              !speechSupported
                ? 'Dictation not supported in this browser'
                : apiConfigured === false
                ? 'AI is not connected'
                : isListening
                ? 'Stop listening'
                : 'Speak your task'
            }
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[#B0AEA5] font-heading">
          {activeTasks} active task{activeTasks !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => handleSubmit()}
          disabled={!input.trim() || isProcessing || apiConfigured === false}
          className="px-4 py-2 text-xs font-heading font-semibold bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <span>Create</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
