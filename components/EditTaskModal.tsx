'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task } from '@/types';

interface EditTaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTaskModal({ task, isOpen, onClose }: EditTaskModalProps) {
  const { updateTask } = useStore();
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    dueDate: task.dueDate instanceof Date 
      ? task.dueDate.toISOString().split('T')[0]
      : new Date(task.dueDate).toISOString().split('T')[0],
    priority: task.priority,
    subject: task.subject || '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTask(task.id, {
      title: formData.title,
      description: formData.description || undefined,
      dueDate: new Date(formData.dueDate),
      priority: formData.priority,
      subject: formData.subject || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] px-6 py-4 flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-[#141413]">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body min-h-[100px]"
              placeholder="Optional description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                Due Date *
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body"
              placeholder="e.g., Math HL, English A"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E6DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
