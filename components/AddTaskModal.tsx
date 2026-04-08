'use client';

import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task } from '@/types';
import { chunkTaskWithAI } from '@/lib/gemini';
import { mergeSchedulePackOptions, scheduleMicroTasksIntoTimesAdaptive } from '@/lib/scheduler';
import { extractDurationMinutesFromUserText, extractSlotEarliestMinutesFromUserText } from '@/lib/ai-task-text-parse';
import BulkExamPlanner from '@/components/BulkExamPlanner';
import { parseCalendarDate } from '@/lib/local-date';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'task' | 'exam';
  lockMode?: boolean;
}

export default function AddTaskModal({ isOpen, onClose, initialMode = 'task', lockMode = false }: AddTaskModalProps) {
  const { addTask, addMotivationalMessage, tasks, calendarEvents, schedulePreferences, rebalanceSchedule } =
    useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'task' | 'exam'>(initialMode);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    subject: '',
    estimatedHours: '2',
  });

  useEffect(() => {
    if (isOpen) return;
    setMode(initialMode);
    setError(null);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dueDate = parseCalendarDate(formData.dueDate);
      const estimatedMinutes = parseFloat(formData.estimatedHours) * 60;
      const instructionBlob = `${formData.title}\n${formData.description || formData.title}`;
      const inferRepeatedSessionConstraint = (text: string): { count: number; sessionMinutes: number } | null => {
        const t = String(text || '').toLowerCase();
        const duration = extractDurationMinutesFromUserText(t);
        if (duration == null || duration < 10) return null;
        const countMatch =
          t.match(/\b(\d{1,3})\s*x\b/i) ||
          t.match(/\b(\d{1,3})\s+times?\b/i) ||
          t.match(/\b(\d{1,3})\s+(?:items?|sessions?|rounds?|sets?|attempts?|tasks?|papers?)\b/i) ||
          t.match(/\bhave\s+(\d{1,3})\b/i);
        if (!countMatch) return null;
        const count = Math.round(Number(countMatch[1]));
        if (!Number.isFinite(count) || count < 2 || count > 200) return null;
        if (!/\b(each|every|per|one\s+go|one\s+sitting|one\s+by\s+one)\b/i.test(t)) return null;
        return { count, sessionMinutes: Math.max(10, Math.min(8 * 60, duration)) };
      };
      const repeatedConstraint = inferRepeatedSessionConstraint(instructionBlob);
      const effectiveHours = repeatedConstraint
        ? Math.max(parseFloat(formData.estimatedHours) || 0, (repeatedConstraint.count * repeatedConstraint.sessionMinutes) / 60)
        : parseFloat(formData.estimatedHours);

      // Generate micro-tasks using AI
      let microTasks: Task['microTasks'] = [];
      try {
        const aiMicroTasks = await chunkTaskWithAI(
          formData.title,
          formData.description || formData.title,
          effectiveHours,
          {
            dueDate: formData.dueDate,
            priority: formData.priority,
            studyPace: schedulePreferences.studyPace,
            defaultSessionMinutes: schedulePreferences.defaultSessionMinutes,
            gradeLevel: schedulePreferences.gradeLevel,
          }
        );
        const taskId = `task-${Date.now()}`;
        microTasks = aiMicroTasks.map((mt, idx) => ({
          ...mt,
          id: `micro-${Date.now()}-${idx}`,
          parentTaskId: taskId,
          order: idx + 1,
          completed: false,
        }));
      } catch (error) {
        console.error('Error generating micro-tasks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const maybeNetworkFlag =
          typeof error === 'object' &&
          error !== null &&
          'networkIssue' in error &&
          Boolean((error as { networkIssue?: boolean }).networkIssue);
        const isNetworkError = maybeNetworkFlag || errorMessage.includes('fetch failed');
        
        if (isNetworkError) {
          setError(
            'Network connection failed. Your network may be blocking AI provider APIs.\n\n' +
            'The task was created with a simple breakdown. Try:\n' +
            '• Using a VPN (if allowed)\n' +
            '• Connecting to a different network\n' +
            '• The task will still work, just without AI-powered breakdown'
          );
        } else {
          setError(`AI task breakdown failed: ${errorMessage}. Task created with simple breakdown.`);
        }
        
        // Fallback: create a simple micro-task
        microTasks = [
          {
            id: `micro-${Date.now()}`,
            title: `Work on ${formData.title}`,
            description: formData.description,
            estimatedMinutes: estimatedMinutes,
            completed: false,
            parentTaskId: `task-${Date.now()}`,
            order: 1,
          },
        ];
      }

      const newTaskId = `task-${Date.now()}`;
      // Ensure microtasks point at the actual task id
      microTasks = microTasks.map((mt) => ({ ...mt, parentTaskId: newTaskId }));

      // Final scheduling: assign clock times in the work window. Keep AI day hints (scheduledDate)
      // for spread across the week; strip any stale clock times from earlier runs.
      microTasks = microTasks.map((mt) => ({
        ...mt,
        scheduledStart: undefined,
        scheduledEnd: undefined,
      }));
      const userSchedulingText = [formData.title, formData.description]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
      const slotEarliest = extractSlotEarliestMinutesFromUserText(userSchedulingText);
      const packOptions = mergeSchedulePackOptions(
        schedulePreferences,
        slotEarliest != null ? { slotEarliestMinutes: slotEarliest } : undefined
      );
      const timeScheduled = scheduleMicroTasksIntoTimesAdaptive({
        microTasks,
        startDay: new Date(),
        dueDay: dueDate,
        prefs: schedulePreferences,
        calendarEvents,
        existingTasks: tasks,
        options: packOptions,
      });
      microTasks = [
        ...timeScheduled.scheduled,
        ...timeScheduled.unscheduled,
      ].map((mt, idx) => ({
        ...mt,
        order: idx + 1,
        scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
      }));

      const finalEstimatedTotalMinutes = microTasks.reduce(
        (sum, mt) => sum + Math.max(1, Math.round(Number(mt.estimatedMinutes) || 0)),
        0
      );
      const newTask: Task = {
        id: newTaskId,
        title: formData.title,
        description: formData.description || undefined,
        dueDate,
        priority: formData.priority,
        subject: formData.subject || undefined,
        microTasks,
        completed: false,
        createdAt: new Date(),
        estimatedTotalMinutes: finalEstimatedTotalMinutes || estimatedMinutes,
      };

      addTask(newTask);
      rebalanceSchedule();
      addMotivationalMessage({
        message: `Task "${formData.title}" added`,
        type: 'encouragement',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        subject: '',
        estimatedHours: '2',
      });
      setError(null);

      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-[var(--surface)] rounded-lg border border-[var(--border-default)] shadow-xl w-full max-h-[90vh] overflow-y-auto ${
          mode === 'exam' ? 'max-w-3xl' : 'max-w-2xl'
        }`}
      >
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border-default)] p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="font-heading font-bold text-2xl text-[var(--foreground)] mb-1">
              {mode === 'exam' ? 'Plan exams' : 'Add task'}
            </h2>
            <p className="text-sm text-[var(--text-subtle)] leading-snug">
              {mode === 'exam'
                ? 'Add one subject at a time (recommended) or paste everything. We detect units and topics, then schedule using your work window in Settings.'
                : 'We break work into steps and place them on your calendar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] rounded-lg transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!lockMode && <div className="flex gap-2 p-1 bg-[var(--surface-muted)] rounded-lg border border-[var(--border-default)]">
            <button
              type="button"
              onClick={() => setMode('task')}
              className={`px-3 py-2 rounded-md text-sm font-heading ${mode === 'task' ? 'bg-[var(--surface)] border border-[var(--border-default)] text-[var(--foreground)]' : 'text-[var(--text-muted)]'}`}
            >
              Quick task
            </button>
            <button
              type="button"
              onClick={() => setMode('exam')}
              className={`px-3 py-2 rounded-md text-sm font-heading ${mode === 'exam' ? 'bg-[var(--surface)] border border-[var(--border-default)] text-[var(--foreground)]' : 'text-[var(--text-muted)]'}`}
            >
              Exam planner
            </button>
          </div>}

          {mode === 'exam' ? (
            <BulkExamPlanner onDone={onClose} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-[#D97757]/10 border border-[#D97757]/40 rounded-lg">
              <p className="text-sm text-[var(--foreground)] font-body whitespace-pre-line">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)] text-[var(--foreground)] font-body transition-colors"
              placeholder="e.g., Complete History Essay"
              autoFocus
            />
          </div>

            <div>
              <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              />
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
                How long will it take? *
              </label>
              <select
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                className="w-full px-4 py-3 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
                <option value="5">5+ hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })
                }
                className="w-full px-4 py-3 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)] text-[var(--foreground)] transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--foreground)] mb-2 font-heading">
              Additional Details
            </summary>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] text-[var(--foreground)] min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>
              <div>
                <label className="block text-sm font-heading font-medium text-[var(--foreground)] mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-[var(--border-default)] bg-[var(--surface-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring-accent)] focus:border-[var(--accent)] text-[var(--foreground)] transition-colors"
                  placeholder="e.g., History, Math"
                />
              </div>
            </div>
          </details>

          <div className="flex gap-3 pt-6 border-t border-[var(--border-default)]">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-heading font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create task
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[var(--surface)] border border-[var(--border-default)] text-[var(--foreground)] rounded-lg font-heading font-medium hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
