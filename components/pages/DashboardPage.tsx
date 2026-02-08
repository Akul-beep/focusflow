'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Play, Plus, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import TaskCard from '@/components/TaskCard';
import AddTaskModal from '@/components/AddTaskModal';
import TreeForest from '@/components/TreeForest';
import Sidebar from '@/components/Sidebar';
import DailyMotivation from '@/components/DailyMotivation';
import { generateMotivationalMessage } from '@/components/MotivationalMessages';
import { isToday, isPast } from 'date-fns';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { tasks, addMotivationalMessage, updateStats, motivationalMessages, stats } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  useEffect(() => {
    updateStats();

    if (motivationalMessages.length === 0) {
      addMotivationalMessage({
        message: generateMotivationalMessage('encouragement', undefined, stats),
        type: 'encouragement',
      });
    }
  }, [addMotivationalMessage, updateStats, motivationalMessages.length]);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'completed') return task.completed;
    if (filter === 'active') return !task.completed;
    if (filter === 'overdue') {
      return !task.completed && isPast(task.dueDate) && !isToday(task.dueDate);
    }
    return true;
  });

  const sortedTasks = [...filteredTasks]
    .map((task) => ({
      ...task,
      dueDate: task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate),
    }))
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  const activeTasks = tasks.filter((t) => !t.completed).length;
  const overdueTasks = tasks.filter((t) => !t.completed && isPast(t.dueDate) && !isToday(t.dueDate)).length;

  const nextMicroTask = tasks
    .filter((t) => !t.completed)
    .flatMap((task) => task.microTasks.filter((mt) => !mt.completed).map((mt) => ({ task, microTask: mt })))[0];

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading font-bold text-3xl text-[#141413] mb-1">Dashboard</h1>
                <p className="text-sm text-[#B0AEA5]">
                  {activeTasks > 0
                    ? `You have ${activeTasks} task${activeTasks !== 1 ? 's' : ''} to do`
                    : 'No tasks yet - add one to get started!'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center h-12 bg-[#FAF9F5] border border-[#E8E6DC] rounded-xl px-3">
                  {(() => {
                    const total = tasks.length;
                    const done = tasks.filter((t) => t.completed).length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div className="w-[220px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-heading text-[#B0AEA5]">Completion</span>
                          <span className="text-[11px] font-heading font-semibold text-[#141413]">
                            {done}/{total}
                          </span>
                        </div>
                        <div className="mt-1 w-full h-1.5 bg-[#E8E6DC] rounded-full overflow-hidden">
                          <div className="h-full bg-[#D97757] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="hidden lg:flex items-center gap-2 h-12 bg-[#FAF9F5] border border-[#E8E6DC] rounded-xl px-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-[#D97757]" />
                  </div>
                  <div className="leading-none">
                    <div className="text-[11px] text-[#B0AEA5] font-heading">FocusCoins</div>
                    <div className="text-sm font-heading font-bold text-[#141413]">
                      {stats.focusCoins} <span className="text-[#B0AEA5] font-semibold">• L{stats.level}</span>
                      <span className="text-[#B0AEA5] font-semibold"> • +{stats.focusCoinsToday} today</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="h-12 flex items-center gap-2 px-5 bg-white border-2 border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
                {nextMicroTask && (
                  <Link
                    href={`/focus?task=${nextMicroTask.task.id}&micro=${nextMicroTask.microTask.id}`}
                    className="h-12 flex items-center gap-2 px-6 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors shadow-lg"
                  >
                    <Play className="w-5 h-5" />
                    Start Working
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#6A9BCC]" />
                </div>
              </div>
              <div className="text-3xl font-heading font-bold text-[#141413] mb-1">{activeTasks}</div>
              <div className="text-sm text-[#B0AEA5] font-heading">Active Tasks</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[#D97757]" />
                </div>
              </div>
              <div className="text-3xl font-heading font-bold text-[#141413] mb-1">{overdueTasks}</div>
              <div className="text-sm text-[#B0AEA5] font-heading">Overdue Tasks</div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-3 space-y-4">
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-[#E8E6DC] w-fit">
                {(['all', 'active', 'overdue', 'completed'] as const).map((f) => {
                  const count =
                    f === 'all'
                      ? tasks.length
                      : f === 'active'
                        ? tasks.filter((t) => !t.completed).length
                        : f === 'completed'
                          ? tasks.filter((t) => t.completed).length
                          : tasks.filter((t) => !t.completed && isPast(t.dueDate) && !isToday(t.dueDate)).length;
                  const label = f === 'all' ? 'All Tasks' : f.charAt(0).toUpperCase() + f.slice(1);
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-lg font-heading text-sm font-medium transition-all duration-200 capitalize ${
                        filter === f ? 'bg-[#D97757] text-white shadow-sm' : 'text-[#141413] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{label}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            filter === f ? 'bg-white/20' : 'bg-[#E8E6DC] text-[#141413]'
                          }`}
                        >
                          {count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Task List */}
              <div className="space-y-4">
                {sortedTasks.length === 0 ? (
                  <div className="bg-white rounded-2xl p-16 text-center border-2 border-[#E8E6DC]">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#D97757]/10 to-[#788C5D]/10 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-[#D97757]" />
                    </div>
                    <h3 className="font-heading font-bold text-2xl text-[#141413] mb-3">
                      {filter === 'completed'
                        ? 'No completed tasks yet'
                        : filter === 'overdue'
                          ? 'No overdue tasks!'
                          : 'Ready to get started?'}
                    </h3>
                    <p className="text-[#B0AEA5] mb-8 max-w-md mx-auto">
                      {filter === 'all' || filter === 'active'
                        ? 'Add your first task using the AI creator in the sidebar, or click "Add Task" above!'
                        : 'Nothing here yet'}
                    </p>
                    {(filter === 'all' || filter === 'active') && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors text-lg"
                      >
                        <Plus className="w-5 h-5" />
                        Add Your First Task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="relative">
              <button
                onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
                className="absolute -left-4 top-0 z-10 w-8 h-8 bg-white border border-[#E8E6DC] rounded-full flex items-center justify-center hover:bg-[#FAF9F5] transition-colors shadow-sm"
              >
                {rightSidebarCollapsed ? (
                  <ChevronLeft className="w-4 h-4 text-[#141413]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#141413]" />
                )}
              </button>

              {!rightSidebarCollapsed && (
                <div className="space-y-4">
                  <TreeForest />
                  <DailyMotivation />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <AddTaskModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

