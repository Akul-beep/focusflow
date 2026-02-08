'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task } from '@/types';
import { chunkTaskWithAI } from '@/lib/gemini';
import { scheduleMicroTasksIntoTimes } from '@/lib/scheduler';

type AIScheduledMicroTask = {
  title: string;
  description?: string;
  estimatedMinutes: number;
  order?: number;
  scheduledDate?: string | Date; // YYYY-MM-DD (or Date after persistence)
};

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const { addTask, addMotivationalMessage, tasks, calendarEvents, schedulePreferences } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    subject: '',
    estimatedHours: '2',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dueDate = new Date(formData.dueDate);
      const estimatedMinutes = parseFloat(formData.estimatedHours) * 60;

      // Generate micro-tasks using AI
      let microTasks: Task['microTasks'] = [];
      try {
        const aiMicroTasks = await chunkTaskWithAI(
          formData.title,
          formData.description || formData.title,
          parseFloat(formData.estimatedHours)
        );
        // Ask AI to spread micro-tasks across days (scheduleTask)
        let scheduledMicroTasks: AIScheduledMicroTask[] = aiMicroTasks;
        try {
          const scheduleRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'scheduleTask',
              task: {
                title: formData.title,
                dueDate: formData.dueDate,
                priority: formData.priority,
                estimatedHours: parseFloat(formData.estimatedHours),
                microTasks: aiMicroTasks,
              },
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
          if (scheduleRes.ok) {
            const scheduleData: unknown = await scheduleRes.json();
            if (
              typeof scheduleData === 'object' &&
              scheduleData !== null &&
              'microTasks' in scheduleData &&
              Array.isArray((scheduleData as { microTasks: unknown }).microTasks)
            ) {
              scheduledMicroTasks = (scheduleData as { microTasks: AIScheduledMicroTask[] }).microTasks;
            }
          }
        } catch {
          // scheduling is best-effort
        }

        const taskId = `task-${Date.now()}`;
        microTasks = scheduledMicroTasks.map((mt, idx) => ({
          ...mt,
          id: `micro-${Date.now()}-${idx}`,
          parentTaskId: taskId,
          order: idx + 1,
          completed: false,
          scheduledDate: mt.scheduledDate
            ? (mt.scheduledDate instanceof Date ? mt.scheduledDate : new Date(mt.scheduledDate))
            : undefined,
        }));
      } catch (error) {
        console.error('Error generating micro-tasks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isNetworkError = (error as any)?.networkIssue || errorMessage.includes('fetch failed');
        
        if (isNetworkError) {
          setError(
            'Network connection failed. Your school network may be blocking Google APIs.\n\n' +
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

      // Final scheduling step: assign actual times inside the user's work window
      // Also: clear any AI-proposed day placements so "unscheduled" items don't show up in the past.
      microTasks = microTasks.map((mt) => ({
        ...mt,
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
      }));
      const timeScheduled = scheduleMicroTasksIntoTimes({
        microTasks,
        startDay: new Date(),
        dueDay: dueDate,
        prefs: schedulePreferences,
        calendarEvents,
        existingTasks: tasks,
      });
      microTasks = [
        ...timeScheduled.scheduled,
        ...timeScheduled.unscheduled,
      ].map((mt, idx) => ({
        ...mt,
        order: idx + 1,
        scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
      }));

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
        estimatedTotalMinutes: estimatedMinutes,
      };

      addTask(newTask);
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] p-6 flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-2xl text-[#141413] mb-1">
              Add New Task
            </h2>
            <p className="text-sm text-[#B0AEA5]">
              Task will be broken down into manageable micro-tasks
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-[#D97757]/10 border border-[#D97757]/30 rounded-lg">
              <p className="text-sm text-[#141413] font-body whitespace-pre-line">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] text-[#141413] font-body transition-colors"
              placeholder="e.g., Complete History Essay"
              autoFocus
            />
          </div>

            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] text-[#141413] transition-colors"
              />
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                How long will it take? *
              </label>
              <select
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] text-[#141413] transition-colors"
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
                <option value="5">5+ hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })
                }
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] text-[#141413] transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-[#B0AEA5] hover:text-[#141413] mb-2 font-heading">
              Additional Details
            </summary>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] text-[#141413] min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>
              <div>
                <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] text-[#141413] transition-colors"
                  placeholder="e.g., History, Math"
                />
              </div>
            </div>
          </details>

          <div className="flex gap-3 pt-6 border-t border-[#E8E6DC]">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Task
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
