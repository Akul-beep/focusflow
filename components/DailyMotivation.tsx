'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, Flame, Timer } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getDailyQuote } from '@/lib/daily-quote';

export default function DailyMotivation({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { stats, pomodoroSessions, tasks, updateStats, motivationPreferences } = useStore();
  const compact = variant === 'compact';

  useEffect(() => {
    // Update stats to ensure streak is calculated
    updateStats();
  }, [pomodoroSessions, updateStats]);

  const dailyQuote = useMemo(() => {
    return getDailyQuote();
  }, []);

  const totalFocusHours = stats.totalFocusMinutes / 60;
  const hasAnyProgress = totalFocusHours > 0 || tasks.length > 0 || pomodoroSessions.length > 0;

  return (
    <div
      className={`bg-white border border-[#E8E6DC] ${compact ? 'rounded-lg p-3 shadow-none' : 'rounded-xl p-5 shadow-sm'}`}
    >
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-4'}`}>
        <div
          className={`rounded-md bg-gradient-to-br from-[#6A9BCC]/15 to-[#788C5D]/15 flex items-center justify-center ${compact ? 'w-7 h-7' : 'w-8 h-8 rounded-lg'}`}
        >
          <Sparkles className={`text-[#6A9BCC] ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        </div>
        <div>
          <h3 className={`font-heading text-[#141413] ${compact ? 'text-sm font-medium' : 'text-base font-semibold'}`}>
            {compact ? 'Today' : 'Daily motivation'}
          </h3>
        </div>
      </div>

      <div
        className={`bg-[#FAF9F5] rounded-md border border-[#E8E6DC]/80 ${compact ? 'mb-2 p-2.5' : 'mb-4 p-3 rounded-lg border-[#E8E6DC]'}`}
      >
        <p className={`font-body text-[#141413] leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>{dailyQuote}</p>
      </div>

      {motivationPreferences.personalGoal && (
        <div className={`bg-[#FAF9F5] rounded-md border border-[#E8E6DC]/80 ${compact ? 'mb-2 p-2.5' : 'mb-4 p-3 rounded-lg border-[#E8E6DC]'}`}>
          <div className="text-[10px] text-[#B0AEA5] font-heading uppercase tracking-wide mb-0.5">Goal</div>
          <div className={`font-heading font-medium text-[#141413] ${compact ? 'text-xs' : 'text-sm font-semibold'}`}>
            {motivationPreferences.personalGoal}
          </div>
        </div>
      )}

      <div className={`bg-[#FAF9F5] rounded-md border border-[#E8E6DC]/80 space-y-1 ${compact ? 'p-2.5' : 'p-3 rounded-lg border-[#E8E6DC] space-y-2'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`text-[#D97757] ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            <div>
              <div className="text-[10px] text-[#B0AEA5] font-heading uppercase tracking-wide">Streak</div>
              <div className={`font-heading font-semibold text-[#141413] ${compact ? 'text-sm' : 'text-lg font-bold'}`}>
                {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>
          {stats.currentStreak === 0 && !hasAnyProgress && (
            <div className="text-right">
              <div className="text-xs font-semibold text-[#6A9BCC]">Finish a focus session</div>
            </div>
          )}
        </div>
        <p className={`text-[#B0AEA5] leading-snug ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          One completed focus session per day keeps the streak (Pomodoro on the Focus page).
        </p>
      </div>

      {compact ? (
        <div className="mt-2.5 pt-2.5 border-t border-[#E8E6DC]/80">
          <p className="text-[10px] text-[#B0AEA5] font-body leading-snug mb-2">
            {stats.totalFocusMinutes < 1
              ? 'Run the timer once to start your streak and feed the forest.'
              : `${Math.floor(stats.totalFocusMinutes)} focus minutes logged — keep going.`}
          </p>
          <Link
            href="/focus"
            className="inline-flex items-center gap-1.5 text-[11px] font-heading font-semibold text-[#6A9BCC] hover:text-[#4a7aad]"
          >
            <Timer className="w-3.5 h-3.5 shrink-0" />
            Open focus timer
          </Link>
        </div>
      ) : null}
    </div>
  );
}
