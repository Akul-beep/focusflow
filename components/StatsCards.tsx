'use client';

import { List, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isPast, isToday } from 'date-fns';

export default function StatsCards() {
  const { tasks, stats } = useStore();

  const activeTasks = tasks.filter((t) => !t.completed).length;
  const overdueTasks = tasks.filter(
    (t) => !t.completed && isPast(t.dueDate) && !isToday(t.dueDate)
  ).length;
  const completedTasks = tasks.filter((t) => t.completed).length;

  const statsData = [
    {
      label: 'Active Tasks',
      value: activeTasks,
      icon: List,
      color: 'text-[#6A9BCC]',
      bgColor: 'bg-[#6A9BCC]/10',
      trend: null,
    },
    {
      label: 'Overdue',
      value: overdueTasks,
      icon: Calendar,
      color: 'text-[#D97757]',
      bgColor: 'bg-[#D97757]/10',
      trend: overdueTasks > 0 ? 'urgent' : null,
    },
    {
      label: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      color: 'text-[#788C5D]',
      bgColor: 'bg-[#788C5D]/10',
      trend: null,
    },
    {
      label: 'Focus Hours',
      value: Math.round(stats.totalFocusMinutes / 60),
      icon: TrendingUp,
      color: 'text-[#6A9BCC]',
      bgColor: 'bg-[#6A9BCC]/10',
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsData.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-xl p-5 border border-[#E8E6DC] hover:shadow-md transition-all duration-200 hover:border-[#6A9BCC]/30 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              {stat.trend === 'urgent' && (
                <span className="px-2 py-1 bg-[#D97757]/10 text-[#D97757] rounded-full text-xs font-heading font-semibold">
                  !
                </span>
              )}
            </div>
            <div className="text-3xl font-heading font-bold text-[#141413] mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-[#B0AEA5] font-heading">
              {stat.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
