'use client';

import { useState } from 'react';
import { X, Check, Edit2, Calendar, Clock, Tag } from 'lucide-react';
import { Task, MicroTask } from '@/types';
import { format } from 'date-fns';

interface TaskPreviewModalProps {
  isOpen: boolean;
  task: {
    title: string;
    description?: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
    microTasks: MicroTask[];
    estimatedTotalMinutes: number;
  };
  onClose: () => void;
  onEdit: () => void;
  onCreate: () => void;
}

export default function TaskPreviewModal({ isOpen, task, onClose, onEdit, onCreate }: TaskPreviewModalProps) {
  const [expandedMicroTasks, setExpandedMicroTasks] = useState(true);

  if (!isOpen) return null;

  const priorityColors = {
    high: 'bg-[#D97757]/10 text-[#D97757] border-[#D97757]/20',
    medium: 'bg-[#6A9BCC]/10 text-[#6A9BCC] border-[#6A9BCC]/20',
    low: 'bg-[#788C5D]/10 text-[#788C5D] border-[#788C5D]/20',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6A9BCC]/20 to-[#788C5D]/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-[#6A9BCC]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-[#141413]">AI Task Preview</h2>
              <p className="text-xs text-[#B0AEA5]">Review before creating</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Task Details */}
          <div>
            <h3 className="font-heading font-bold text-lg text-[#141413] mb-2">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-[#B0AEA5] font-body mb-4 leading-relaxed">
                {task.description}
              </p>
            )}
            
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                <Calendar className="w-4 h-4" />
                <span>Due: {format(task.dueDate, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                <Clock className="w-4 h-4" />
                <span>{(task.estimatedTotalMinutes / 60).toFixed(1)} hours</span>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-heading font-medium border ${priorityColors[task.priority]}`}>
                {task.priority.toUpperCase()}
              </span>
              {task.subject && (
                <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                  <Tag className="w-4 h-4" />
                  <span>{task.subject}</span>
                </div>
              )}
            </div>
          </div>

          {/* Micro-Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-heading font-semibold text-base text-[#141413]">
                Micro-Tasks ({task.microTasks.length})
              </h4>
              <button
                onClick={() => setExpandedMicroTasks(!expandedMicroTasks)}
                className="text-xs text-[#6A9BCC] hover:text-[#5a8bbd] font-heading font-medium"
              >
                {expandedMicroTasks ? 'Collapse' : 'Expand'}
              </button>
            </div>
            
            {expandedMicroTasks && (
              <div className="space-y-2">
                {task.microTasks.map((microTask, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-heading font-medium text-sm text-[#141413] mb-1">
                          {idx + 1}. {microTask.title}
                        </p>
                        {microTask.description && (
                          <p className="text-xs text-[#B0AEA5] font-body">
                            {microTask.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[#B0AEA5] font-heading ml-3">
                        {microTask.estimatedMinutes} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E6DC]">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-6 py-3 border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onCreate}
              className="flex items-center gap-2 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
            >
              <Check className="w-4 h-4" />
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
