'use client';

import { useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { format } from 'date-fns';
import { Play, Calendar as CalendarIcon } from 'lucide-react';
import { getDayAgenda } from '@/lib/agenda';

export default function TodayPage() {
  const { tasks, calendarEvents } = useStore();

  const todaysItems = useMemo(() => {
    const agenda = getDayAgenda({ day: new Date(), tasks, calendarEvents });
    return agenda.taskSteps.map(({ task, microTask }) => ({
      taskId: task.id,
      taskTitle: task.title,
      microTaskId: microTask.id,
      microTaskTitle: microTask.title,
      estimatedMinutes: microTask.estimatedMinutes,
      priority: task.priority,
      scheduledDate: microTask.scheduledStart || microTask.scheduledDate || null,
    }));
  }, [tasks, calendarEvents]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading font-bold text-3xl text-[#141413] mb-1">Today</h1>
                <p className="text-sm text-[#B0AEA5]">{format(new Date(), 'EEEE, MMM d')}</p>
              </div>
              <Link
                href="/calendar"
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
              >
                <CalendarIcon className="w-4 h-4" />
                Calendar
              </Link>
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="bg-white rounded-xl p-6 border border-[#E8E6DC]">
            {todaysItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#B0AEA5] mb-2">Nothing scheduled for today yet.</p>
                <p className="text-xs text-[#B0AEA5]">
                  Add a task with the AI creator; it will spread steps across days before the due date.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysItems.map((item) => (
                  <div
                    key={item.microTaskId}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]"
                  >
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-sm text-[#141413] truncate">{item.microTaskTitle}</p>
                      <p className="text-xs text-[#B0AEA5] truncate">
                        {item.taskTitle} • ~{item.estimatedMinutes} min
                      </p>
                    </div>
                    <Link
                      href={`/focus?task=${item.taskId}&micro=${item.microTaskId}`}
                      className="flex items-center gap-2 px-4 py-2 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

