'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { getDayAgenda } from '@/lib/agenda';
import { getDailyQuote } from '@/lib/daily-quote';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { addDays, format, isToday, isTomorrow } from 'date-fns';

export default function MorningBriefingOverlay() {
  const { showMorningBriefing, dismissMorningBriefing, tasks, calendarEvents, stats, updateStats } = useStore();
  const [name, setName] = useState<string>('');

  useEffect(() => {
    updateStats();
  }, [updateStats]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const loadUser = async () => {
      try {
        const { data: { user } } = await getSupabaseBrowser().auth.getUser();
        const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
        setName(displayName);
      } catch {
        /* offline / unreachable auth */
      }
    };
    void loadUser();
  }, []);

  const todayAgenda = useMemo(() => getDayAgenda({ day: new Date(), tasks, calendarEvents }), [tasks, calendarEvents]);
  const todaysSessions = todayAgenda.taskSteps;
  const todaysHours = todaysSessions.reduce((acc, item) => acc + item.microTask.estimatedMinutes, 0) / 60;

  const nextDeadline = useMemo(() => {
    const now = new Date();
    const upcoming = tasks
      .filter((task) => !task.completed && task.dueDate >= now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    return upcoming || null;
  }, [tasks]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  if (!showMorningBriefing) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#141413]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E8E6DC] shadow-2xl p-6">
        <h2 className="font-heading font-bold text-2xl text-[#141413] mb-4">
          {greeting}{name ? `, ${name}` : ''}
        </h2>
        <div className="space-y-3 mb-5">
          <p className="text-sm text-[#141413]">
            <span className="font-heading font-semibold">
              {todaysSessions.length} session{todaysSessions.length === 1 ? '' : 's'} · {todaysHours.toFixed(1)}h planned
            </span>
          </p>
          <p className="text-sm text-[#141413]">
            {nextDeadline
              ? `${nextDeadline.title} due ${
                  isToday(nextDeadline.dueDate)
                    ? 'today'
                    : isTomorrow(nextDeadline.dueDate)
                      ? 'tomorrow'
                      : format(nextDeadline.dueDate, 'EEE, MMM d')
                }`
              : `No upcoming deadlines — ${format(addDays(new Date(), 1), 'EEE')} is open to plan ahead.`}
          </p>
          <p className="text-sm text-[#141413]">
            Focus streak:{' '}
            <span className="font-heading font-semibold">
              {stats.currentStreak > 0 ? `${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'} with a completed session` : 'Complete a focus timer to begin'}
            </span>
          </p>
          <p className="text-sm italic text-[#B0AEA5]">"{getDailyQuote()}"</p>
        </div>
        <button
          onClick={dismissMorningBriefing}
          className="w-full px-4 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
        >
          Let&apos;s go →
        </button>
      </div>
    </div>
  );
}
