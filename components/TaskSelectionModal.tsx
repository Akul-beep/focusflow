'use client';

import { useState } from 'react';
import { X, Play, Clock, Calendar } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Task, MicroTask } from '@/types';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface TaskSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskSelectionModal({ isOpen, onClose }: TaskSelectionModalProps) {
  const { tasks } = useStore();
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableTasks = tasks
    .filter((t) => !t.completed)
    .map((task) => ({
      ...task,
      dueDate: task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate),
    }))
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  const handleSelectMicroTask = (taskId: string, microTaskId: string) => {
    router.push(`/focus?task=${taskId}&micro=${microTaskId}`);
    onClose();
  };

  const priorityColors = {
    high: 'bg-[#D97757]/10 text-[#D97757] border-[#D97757]/20',
    medium: 'bg-[#6A9BCC]/10 text-[#6A9BCC] border-[#6A9BCC]/20',
    low: 'bg-[#788C5D]/10 text-[#788C5D] border-[#788C5D]/20',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-xl text-[#141413]">Choose Task to Focus On</h2>
            <p className="text-sm text-[#B0AEA5] mt-1">Select a micro-task to start your focus session</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {availableTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#B0AEA5] mb-4">No active tasks available</p>
              <button
                onClick={() => {
                  onClose();
                  router.push('/');
                }}
                className="px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
              >
                Add Task
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {availableTasks.map((task) => {
                const incompleteMicroTasks = task.microTasks.filter((mt) => !mt.completed);
                
                if (incompleteMicroTasks.length === 0) return null;

                return (
                  <div
                    key={task.id}
                    className="border border-[#E8E6DC] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="bg-[#FAF9F5] px-5 py-4 border-b border-[#E8E6DC]">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-heading font-semibold text-lg text-[#141413] mb-2">
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                              <Calendar className="w-4 h-4" />
                              <span>{format(task.dueDate, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                              <Clock className="w-4 h-4" />
                              <span>{Math.round(task.estimatedTotalMinutes / 60)}h</span>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-heading font-medium border ${priorityColors[task.priority]}`}>
                              {task.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-2">
                      {incompleteMicroTasks
                        .sort((a, b) => a.order - b.order)
                        .map((microTask) => (
                          <button
                            key={microTask.id}
                            onClick={() => handleSelectMicroTask(task.id, microTask.id)}
                            className="w-full flex items-center justify-between p-4 bg-white border border-[#E8E6DC] rounded-lg hover:bg-[#FAF9F5] hover:border-[#6A9BCC] transition-all group"
                          >
                            <div className="flex-1 text-left">
                              <p className="font-body font-medium text-[#141413] mb-1 group-hover:text-[#6A9BCC] transition-colors">
                                {microTask.title}
                              </p>
                              {microTask.description && (
                                <p className="text-sm text-[#B0AEA5] line-clamp-1">
                                  {microTask.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-[#B0AEA5] font-heading">
                                  ~{microTask.estimatedMinutes} min
                                </span>
                              </div>
                            </div>
                            <Play className="w-5 h-5 text-[#B0AEA5] group-hover:text-[#6A9BCC] transition-colors ml-4" />
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
