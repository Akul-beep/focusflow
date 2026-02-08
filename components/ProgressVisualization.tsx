'use client';

import { useStore } from '@/lib/store';
import { TrendingUp, Target } from 'lucide-react';
import { useEffect } from 'react';

export default function ProgressVisualization() {
  const { stats, updateStats } = useStore();

  useEffect(() => {
    updateStats();
  }, [updateStats]);

  const weeklyProgress = (stats.weeklyCompleted / stats.weeklyGoal) * 100;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E8E6DC]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
            <Target className="w-5 h-5 text-[#141413]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-[#141413]">
              Weekly Goal
            </h3>
            <p className="text-xs text-[#B0AEA5]">Focus hours</p>
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-heading font-medium text-[#141413]">
              {stats.weeklyCompleted.toFixed(1)}h / {stats.weeklyGoal}h
            </span>
            <span className="text-base font-heading font-semibold text-[#141413]">
              {Math.min(100, Math.round(weeklyProgress))}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#E8E6DC] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#141413] transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, weeklyProgress)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E8E6DC]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#141413]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-[#141413]">
              Statistics
            </h3>
            <p className="text-xs text-[#B0AEA5]">Overall progress</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#FAF9F5] rounded-lg">
            <div className="text-2xl font-heading font-bold text-[#141413] mb-1">
              {stats.tasksCompleted}
            </div>
            <div className="text-xs text-[#B0AEA5] font-heading">Tasks</div>
          </div>
          <div className="p-3 bg-[#FAF9F5] rounded-lg">
            <div className="text-2xl font-heading font-bold text-[#141413] mb-1">
              {stats.microTasksCompleted}
            </div>
            <div className="text-xs text-[#B0AEA5] font-heading">Micro-tasks</div>
          </div>
          <div className="p-3 bg-[#FAF9F5] rounded-lg">
            <div className="text-2xl font-heading font-bold text-[#141413] mb-1">
              {Math.round(stats.totalFocusMinutes / 60)}
            </div>
            <div className="text-xs text-[#B0AEA5] font-heading">Hours</div>
          </div>
          <div className="p-3 bg-[#FAF9F5] rounded-lg">
            <div className="text-2xl font-heading font-bold text-[#141413] mb-1">
              {stats.currentStreak}
            </div>
            <div className="text-xs text-[#B0AEA5] font-heading">Streak</div>
          </div>
        </div>
      </div>
    </div>
  );
}
