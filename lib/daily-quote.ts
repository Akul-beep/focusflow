export const DAILY_QUOTES = [
  'One clear plan for today beats a perfect plan for next week.',
  'You do not need more hours—you need a smaller next step.',
  'Start with the assignment that matters most this week.',
  'A ten-minute start counts. Momentum is built from small openings.',
  'When the list feels heavy, pick one step and ignore the rest for this block.',
  'Deadlines are information, not a verdict on who you are.',
  'Rest is part of the work. Tired brains do not learn well.',
  'Ask for help early. It saves time and stress.',
  'Review what you did yesterday before you pile on something new.',
  'Close extra tabs. Your attention is the scarce resource.',
  'Write the first rough version. Editing comes later.',
  'If you are stuck, switch to a different step for twenty minutes.',
  'Celebrate finishing a step—not only finishing the whole task.',
  'Consistent small sessions beat rare marathon nights.',
  'You are allowed to adjust the plan when real life changes.',
];

export const getDailyQuote = (date = new Date()) => {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
};
