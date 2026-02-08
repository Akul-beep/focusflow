'use client';

import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import TreeForest from '@/components/TreeForest';
import ProgressVisualization from '@/components/ProgressVisualization';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Target, Clock, CheckCircle2 } from 'lucide-react';
import { startOfWeek } from 'date-fns';

export default function AnalyticsPage() {
  const { stats, pomodoroSessions, tasks } = useStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const weekStart = startOfWeek(new Date());
  const weeklySessions = pomodoroSessions.filter((s) => s.completed && s.endTime && new Date(s.endTime) >= weekStart);
  const weeklyHours = weeklySessions.reduce((acc, s) => acc + s.duration, 0) / 60;

  const totalMicroTasks = tasks.reduce((acc, t) => acc + t.microTasks.length, 0);
  const completedMicroTasks = tasks.reduce((acc, t) => acc + t.microTasks.filter((mt) => mt.completed).length, 0);
  const completionRate = totalMicroTasks > 0 ? (completedMicroTasks / totalMicroTasks) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading font-bold text-3xl text-[#141413] mb-1">Analytics</h1>
                <p className="text-sm text-[#B0AEA5]">Track your progress and insights</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-3 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#6A9BCC]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-[#B0AEA5] font-heading">Total Focus</div>
                      <div className="text-2xl font-heading font-bold text-[#141413]">{(stats.totalFocusMinutes / 60).toFixed(1)}h</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#788C5D]/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-[#788C5D]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-[#B0AEA5] font-heading">Completion Rate</div>
                      <div className="text-2xl font-heading font-bold text-[#141413]">{completionRate.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-[#D97757]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-[#B0AEA5] font-heading">Weekly Progress</div>
                      <div className="text-2xl font-heading font-bold text-[#141413]">{weeklyHours.toFixed(1)}h</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <h2 className="font-heading font-semibold text-xl text-[#141413] mb-6">Progress Overview</h2>
                <ProgressVisualization />
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <h2 className="font-heading font-semibold text-xl text-[#141413] mb-6">Growth Forest</h2>
                <TreeForest />
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute -left-4 top-0 z-10 w-8 h-8 bg-white border border-[#E8E6DC] rounded-full flex items-center justify-center hover:bg-[#FAF9F5] transition-colors shadow-sm"
              >
                {sidebarCollapsed ? (
                  <ChevronLeft className="w-4 h-4 text-[#141413]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#141413]" />
                )}
              </button>

              {!sidebarCollapsed && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                    <h3 className="font-heading font-semibold text-lg text-[#141413] mb-4">Insights</h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <div className="text-[#B0AEA5] mb-1">Current Streak</div>
                        <div className="font-heading font-semibold text-[#141413] text-lg">{stats.currentStreak} days</div>
                      </div>
                      <div>
                        <div className="text-[#B0AEA5] mb-1">Tasks Completed</div>
                        <div className="font-heading font-semibold text-[#141413] text-lg">{stats.tasksCompleted}</div>
                      </div>
                      <div>
                        <div className="text-[#B0AEA5] mb-1">Micro-tasks Done</div>
                        <div className="font-heading font-semibold text-[#141413] text-lg">{stats.microTasksCompleted}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

