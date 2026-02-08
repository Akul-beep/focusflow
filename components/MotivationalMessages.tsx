'use client';

import { useStore } from '@/lib/store';
import { Sparkles, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';

// Comprehensive motivational quote library organized by context
const motivationalQuotes = {
  encouragement: [
    "Every expert was once a beginner. Keep going!",
    "You don't have to be great to start, but you have to start to be great.",
    "The way to get started is to quit talking and begin doing.",
    "Believe you can and you're halfway there.",
    "Your potential is limitless. Keep pushing forward!",
    "Small progress is still progress. Celebrate every step!",
    "The only bad study session is the one you didn't do.",
    "You're doing better than you think. Keep it up!",
    "Success is the sum of small efforts repeated day in and day out.",
    "You're building something amazing, one task at a time.",
    "Progress, not perfection. Keep moving forward!",
    "Your future self will thank you for today's effort.",
    "Challenges are what make life interesting. Overcoming them is what makes life meaningful.",
    "The best time to start was yesterday. The second best time is now.",
    "You're capable of more than you know. Trust the process.",
  ],
  progress: [
    "Amazing progress! You're building momentum!",
    "Look how far you've come! Keep going!",
    "Every completed task is a step toward your goals.",
    "You're turning effort into excellence. Well done!",
    "Progress feels slow, but you're building something great!",
    "Consistency is your superpower. You're proving it!",
    "Small steps lead to big achievements. Keep climbing!",
    "You're not just completing tasks—you're building habits!",
    "This is how champions are made—one focused session at a time.",
    "Your dedication is paying off. Keep the momentum!",
  ],
  achievement: [
    "Outstanding work! You should be proud!",
    "You did it! Your persistence paid off.",
    "Congratulations! You've earned this success.",
    "Mission accomplished! Time to celebrate this win!",
    "You overcame the challenge. That's growth!",
    "Well done! You're becoming the student you want to be.",
    "Success! Your hard work is showing results.",
    "Achievement unlocked! Keep this energy going!",
    "You've proven you can do difficult things. Amazing!",
    "Bravo! Your consistency is creating real results.",
  ],
  daily: [
    "Good morning! Today is full of possibilities.",
    "Start your day with intention and purpose.",
    "Morning energy is precious. Use it wisely!",
    "A productive morning sets the tone for the day.",
    "Rise and shine! Time to make progress.",
  ],
  reminder: [
    "Don't forget: consistency beats intensity.",
    "Remember: small daily improvements lead to big results.",
    "A gentle reminder: you're capable of more than you think.",
    "Just a nudge: your future self needs today's effort.",
    "Friendly reminder: progress happens one step at a time.",
  ],
  taskCompletion: [
    "Task complete! That's how it's done!",
    "Another one checked off. Great work!",
    "You nailed it! Keep this momentum going.",
    "Task finished! Your consistency is showing.",
    "Done and done! You're on a roll!",
  ],
};

function getContextualQuote(
  type: 'encouragement' | 'progress' | 'reminder',
  context?: string,
  stats?: { tasksCompleted: number; totalFocusMinutes: number }
): string {
  const hour = new Date().getHours();

  // Context-specific quotes
  if (context && type === 'progress') {
    return `Completed "${context}"! ${motivationalQuotes.progress[Math.floor(Math.random() * motivationalQuotes.progress.length)]}`;
  }

  // Stats-based encouragement
  if (type === 'encouragement' && stats) {
    if (stats.tasksCompleted === 0 && stats.totalFocusMinutes === 0) {
      return "Ready to start? Every journey begins with a single step!";
    }
    if (stats.tasksCompleted > 5) {
      return "You're on fire! Keep this amazing momentum going!";
    }
  }

  // Time-based quotes
  if (type === 'encouragement') {
    const allEncouragement = [
      ...motivationalQuotes.encouragement,
      ...(hour >= 6 && hour < 12 ? motivationalQuotes.daily : []), // Morning
    ];
    return allEncouragement[Math.floor(Math.random() * allEncouragement.length)];
  }

  // Default: use the specified type
  const quotes = motivationalQuotes[type] || motivationalQuotes.encouragement;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export default function MotivationalMessages() {
  const { motivationalMessages } = useStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'progress':
        return <TrendingUp className="w-3 h-3" />;
      case 'reminder':
        return <Clock className="w-3 h-3" />;
      default:
        return <Sparkles className="w-3 h-3" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'progress':
        return 'text-[#788C5D]';
      case 'reminder':
        return 'text-[#6A9BCC]';
      default:
        return 'text-[#D97757]';
    }
  };

  if (motivationalMessages.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#141413]" />
          </div>
          <h3 className="font-heading font-semibold text-base text-[#141413]">
            Activity Log
          </h3>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-[#B0AEA5]">
            Complete tasks to see updates
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-[#141413]" />
        </div>
        <h3 className="font-heading font-semibold text-base text-[#141413]">
          Activity Log
        </h3>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {motivationalMessages.slice(0, 4).map((message) => (
          <div
            key={message.id}
            className="flex items-start gap-2 p-2.5 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]"
          >
            <div className={`mt-0.5 ${getColor(message.type)}`}>
              {getIcon(message.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body text-[#141413] leading-relaxed">{message.message}</p>
              <p className="text-xs text-[#B0AEA5] mt-1 font-heading">
                {format(new Date(message.timestamp), 'MMM d, h:mm a')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function generateMotivationalMessage(
  type: 'encouragement' | 'progress' | 'reminder',
  context?: string,
  stats?: { tasksCompleted: number; totalFocusMinutes: number }
): string {
  return getContextualQuote(type, context, stats);
}
