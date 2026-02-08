'use client';

import { Task } from '@/types';
import { Calendar, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp, Play, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { generateMotivationalMessage } from './MotivationalMessages';
import EditTaskModal from './EditTaskModal';
import ConfettiBurst from './ConfettiBurst';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const { toggleMicroTaskComplete, toggleTaskComplete, addMotivationalMessage, updateStats, stats, deleteTask } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confettiKey, setConfettiKey] = useState<number>(0);

  const taskDueDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);

  const completedMicroTasks = task.microTasks.filter((mt) => mt.completed).length;
  const totalMicroTasks = task.microTasks.length;
  const progress = totalMicroTasks > 0 ? completedMicroTasks / totalMicroTasks : 0;

  const isOverdue = isPast(taskDueDate) && !isToday(taskDueDate) && !task.completed;
  const isDueToday = isToday(taskDueDate) && !task.completed;

  const priorityColors = {
    high: 'bg-[#D97757] text-white',
    medium: 'bg-[#6A9BCC] text-white',
    low: 'bg-[#788C5D] text-white',
  };

  const handleMicroTaskToggle = (microTaskId: string) => {
    const mt = task.microTasks.find((m) => m.id === microTaskId);
    const wasDone = !!mt?.completed;
    toggleMicroTaskComplete(microTaskId);
    updateStats();
    
    const microTask = task.microTasks.find((m) => m.id === microTaskId);
    if (microTask && !wasDone) {
      addMotivationalMessage({
        message: `+5 FocusCoins • ${generateMotivationalMessage('progress', microTask.title, stats)}`,
        type: 'progress',
      });
      setConfettiKey((k) => k + 1);
    } else if (microTask && wasDone) {
      addMotivationalMessage({
        message: `Undo • -5 FocusCoins`,
        type: 'reminder',
      });
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      deleteTask(task.id);
      updateStats();
    }
  };

  const handleCompleteTask = () => {
    const wasDone = task.completed;
    toggleTaskComplete(task.id);
    updateStats();
    if (!wasDone) setConfettiKey((k) => k + 1);
    addMotivationalMessage({
      message: wasDone ? 'Undo • -20 FocusCoins' : '+20 FocusCoins • Task completed',
      type: wasDone ? 'reminder' : 'progress',
    });
  };

  const nextMicroTask = task.microTasks.find(mt => !mt.completed);

  const nextScheduled = task.microTasks
    .filter((mt) => !mt.completed)
    .map((mt) => {
      const start = mt.scheduledStart ? (mt.scheduledStart instanceof Date ? mt.scheduledStart : new Date(mt.scheduledStart)) : null;
      const day = mt.scheduledDate ? (mt.scheduledDate instanceof Date ? mt.scheduledDate : new Date(mt.scheduledDate)) : null;
      return { mt, when: start ? start.getTime() : day ? day.getTime() : Number.MAX_SAFE_INTEGER, start, day };
    })
    .sort((a, b) => a.when - b.when)[0] || null;

  const scheduleLabel = (() => {
    if (!nextScheduled) return null;
    const d = nextScheduled.start || nextScheduled.day;
    if (!d) return null;
    const dayPart = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d');
    const timePart = nextScheduled.start ? format(nextScheduled.start, 'h:mm a') : null;
    return timePart ? `${dayPart}, ${timePart}` : dayPart;
  })();

  return (
    <>
      <div className={`relative bg-white rounded-xl p-6 border-2 transition-all ${
        task.completed 
          ? 'border-[#E8E6DC] opacity-60' 
          : isOverdue 
          ? 'border-[#D97757]' 
          : 'border-[#E8E6DC] hover:border-[#6A9BCC]'
      }`}>
        {confettiKey > 0 && <ConfettiBurst key={confettiKey} />}
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className={`mt-1 p-2 rounded-lg transition-all ${
                  expanded 
                    ? 'bg-[#6A9BCC]/10 text-[#6A9BCC]' 
                    : 'text-[#B0AEA5] hover:bg-[#FAF9F5] hover:text-[#6A9BCC]'
                }`}
                title={expanded ? 'Hide steps' : 'Show steps'}
              >
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className={`font-heading font-bold text-lg text-[#141413] flex-1 ${
                    task.completed ? 'line-through text-[#B0AEA5]' : ''
                  }`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-heading font-semibold ${priorityColors[task.priority]}`}>
                      {task.priority.toUpperCase()}
                    </span>
                    <button
                      onClick={handleCompleteTask}
                      className={`px-3 py-2 rounded-lg text-xs font-heading font-semibold transition-colors ${
                        task.completed
                          ? 'bg-white border border-[#E8E6DC] text-[#141413] hover:bg-[#FAF9F5]'
                          : 'bg-[#788C5D] text-white hover:bg-[#6b7e52]'
                      }`}
                      title={task.completed ? 'Undo completion' : 'Mark task done'}
                    >
                      {task.completed ? 'Undo' : 'Mark done'}
                    </button>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="p-2 text-[#B0AEA5] hover:text-[#6A9BCC] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-2 text-[#B0AEA5] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {task.description && (
                  <p className="text-[#B0AEA5] text-sm mb-3 leading-relaxed ml-11">{task.description}</p>
                )}

                <div className="flex items-center gap-4 flex-wrap ml-11">
                  <div className={`flex items-center gap-2 text-sm font-heading ${
                    isOverdue ? 'text-[#D97757] font-semibold' : 
                    isDueToday ? 'text-[#6A9BCC] font-semibold' : 
                    'text-[#B0AEA5]'
                  }`}>
                    <Calendar className="w-4 h-4" />
                    <span>{format(taskDueDate, 'MMM d, yyyy')}</span>
                    {isOverdue && <span className="text-xs">(Late!)</span>}
                    {isDueToday && <span className="text-xs">(Today!)</span>}
                  </div>
                  {scheduleLabel && !task.completed && (
                    <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                      <Clock className="w-4 h-4" />
                      <span>{scheduleLabel}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-[#B0AEA5]">
                    <Clock className="w-4 h-4" />
                    <span>{Math.round(task.estimatedTotalMinutes / 60)} hours</span>
                  </div>
                  {task.subject && (
                    <span className="px-3 py-1 bg-[#E8E6DC] rounded-lg text-xs font-heading font-medium text-[#141413]">
                      {task.subject}
                    </span>
                  )}
                </div>

                {/* Progress Bar - Always Visible */}
                {totalMicroTasks > 0 && (
                  <div className="mt-4 ml-11">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-heading font-semibold text-[#141413]">
                        {completedMicroTasks} of {totalMicroTasks} steps done
                      </span>
                      <span className="text-lg font-heading font-bold text-[#6A9BCC]">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#E8E6DC] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${task.completed ? 'bg-[#788C5D]' : 'bg-[#D97757]'}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Steps */}
        {expanded && (
          <div className="mt-6 pt-6 border-t-2 border-[#E8E6DC]">
            {task.microTasks.length > 0 ? (
              <div className="space-y-3 mb-6">
                <h4 className="font-heading font-semibold text-base text-[#141413] mb-4">
                  Steps ({completedMicroTasks}/{totalMicroTasks} done)
                </h4>
                {task.microTasks
                  .sort((a, b) => a.order - b.order)
                  .map((microTask, idx) => (
                    <div
                      key={microTask.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                        microTask.completed
                          ? 'bg-[#FAF9F5] border-[#788C5D]/30 opacity-70'
                          : 'bg-white border-[#E8E6DC] hover:border-[#6A9BCC]'
                      }`}
                    >
                      <button
                        onClick={() => handleMicroTaskToggle(microTask.id)}
                        className={`mt-0.5 transition-all ${
                          microTask.completed
                            ? 'text-[#788C5D]'
                            : 'text-[#B0AEA5] hover:text-[#6A9BCC] hover:scale-110'
                        }`}
                        title={microTask.completed ? 'Mark as not done' : 'Mark as done'}
                      >
                        {microTask.completed ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>
                      <div className="flex-1">
                        <p className={`font-body text-base mb-1 ${
                          microTask.completed
                            ? 'text-[#B0AEA5] line-through'
                            : 'text-[#141413] font-medium'
                        }`}>
                          Step {idx + 1}: {microTask.title}
                        </p>
                        {microTask.description && (
                          <p className="text-sm text-[#B0AEA5] mb-2 leading-relaxed">
                            {microTask.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#B0AEA5] font-heading">
                            {microTask.estimatedMinutes} min
                          </span>
                          {microTask.completed && (
                          <span className="text-xs text-[#788C5D] font-heading font-semibold">
                            Done
                          </span>
                          )}
                        </div>
                      </div>
                      {!microTask.completed && (
                        <Link
                          href={`/focus?task=${task.id}&micro=${microTask.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-[#141413] text-white rounded-lg text-sm font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </Link>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#FAF9F5] rounded-lg border-2 border-[#E8E6DC]">
                <p className="text-sm text-[#B0AEA5]">No steps yet</p>
              </div>
            )}

            {/* Quick Start Button */}
            {nextMicroTask && (
              <div className="flex items-center justify-center pt-4 border-t border-[#E8E6DC]">
                <Link
                  href={`/focus?task=${task.id}&micro=${nextMicroTask.id}`}
                  className="flex items-center gap-2 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Start Working on This Task
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {showEditModal && (
        <EditTaskModal 
          task={task} 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
        />
      )}
    </>
  );
}
