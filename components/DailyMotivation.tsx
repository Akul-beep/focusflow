'use client';

import { useEffect, useMemo } from 'react';
import { Sparkles, Flame } from 'lucide-react';
import { useStore } from '@/lib/store';

// Daily motivational quotes that work from day one
const dailyQuotes = [
  "Today is a fresh start. Make it count!",
  "Set your intention for today and make it happen.",
  "This moment is your opportunity. Seize it!",
  "What you do today matters. Choose wisely!",
  "Make today so productive that yesterday gets jealous.",
  "Today is the perfect day to make progress.",
  "Your future depends on what you do today. Make it great!",
  "Wake up with determination. Go to bed with satisfaction.",
  "Today's small steps become tomorrow's giant leaps.",
  "Every expert was once a beginner. Keep going!",
  "You don't have to be great to start, but you have to start to be great.",
  "The way to get started is to quit talking and begin doing.",
  "Believe you can and you're halfway there.",
  "Your potential is limitless. Keep pushing forward!",
  "Small progress is still progress. Celebrate every step!",
];

export default function DailyMotivation() {
  const { stats, pomodoroSessions, tasks, updateStats, motivationPreferences } = useStore();

  useEffect(() => {
    // Update stats to ensure streak is calculated
    updateStats();
  }, [pomodoroSessions, updateStats]);

  const dailyQuote = useMemo(() => {
    // Consistent for the day, without setState-in-effect
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const quoteIndex = dayOfYear % dailyQuotes.length;
    return dailyQuotes[quoteIndex];
  }, []);

  const totalFocusHours = stats.totalFocusMinutes / 60;
  const hasAnyProgress = totalFocusHours > 0 || tasks.length > 0 || pomodoroSessions.length > 0;

  return (
    <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6A9BCC]/20 to-[#788C5D]/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#6A9BCC]" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-base text-[#141413]">
            Daily Motivation
          </h3>
        </div>
      </div>

      {/* Daily Quote - Compact */}
      <div className="mb-4 p-3 bg-gradient-to-br from-[#FAF9F5] to-[#E8E6DC]/30 rounded-lg border border-[#E8E6DC]">
        <p className="text-sm font-body text-[#141413] italic leading-relaxed">
          “{dailyQuote}”
        </p>
      </div>

      {motivationPreferences.personalGoal && (
        <div className="mb-4 p-3 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
          <div className="text-xs text-[#B0AEA5] font-heading mb-1">Your goal</div>
          <div className="text-sm font-heading font-semibold text-[#141413]">
            {motivationPreferences.personalGoal}
          </div>
        </div>
      )}

      {/* Streak Display - Compact */}
      <div className="flex items-center justify-between p-3 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#D97757]" />
          <div>
            <div className="text-xs text-[#B0AEA5] font-heading">Streak</div>
            <div className="text-lg font-heading font-bold text-[#141413]">
              {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>
        {stats.currentStreak === 0 && !hasAnyProgress && (
          <div className="text-right">
            <div className="text-xs font-semibold text-[#6A9BCC]">Start now!</div>
          </div>
        )}
      </div>
    </div>
  );
}
