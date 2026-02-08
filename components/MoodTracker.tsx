'use client';

import { useState } from 'react';
import { Smile, Meh, Frown, Heart, Zap } from 'lucide-react';
import { useStore } from '@/lib/store';
import { MoodEntry } from '@/types';
import { makeId } from '@/lib/ids';

const moods = [
  { id: 'great', label: 'Great!', icon: Heart, color: 'text-[#788C5D]', bg: 'bg-[#788C5D]/10' },
  { id: 'good', label: 'Good', icon: Smile, color: 'text-[#6A9BCC]', bg: 'bg-[#6A9BCC]/10' },
  { id: 'okay', label: 'Okay', icon: Meh, color: 'text-[#B0AEA5]', bg: 'bg-[#B0AEA5]/10' },
  { id: 'tired', label: 'Tired', icon: Frown, color: 'text-[#D97757]', bg: 'bg-[#D97757]/10' },
  { id: 'stressed', label: 'Stressed', icon: Zap, color: 'text-[#D97757]', bg: 'bg-[#D97757]/10' },
] as const;

interface MoodTrackerProps {
  pomodoroSessionId?: string;
  onMoodSelected?: (mood: MoodEntry['mood']) => void;
}

export default function MoodTracker({ pomodoroSessionId, onMoodSelected }: MoodTrackerProps) {
  const { addMoodEntry } = useStore();
  const [selectedMood, setSelectedMood] = useState<MoodEntry['mood'] | null>(null);
  const [note, setNote] = useState('');

  const handleMoodSelect = async (mood: MoodEntry['mood']) => {
    setSelectedMood(mood);
    
    const moodEntry: MoodEntry = {
      id: makeId('mood'),
      timestamp: new Date(),
      mood,
      note: note || undefined,
      pomodoroSessionId,
    };

    addMoodEntry(moodEntry);
    
    if (onMoodSelected) {
      onMoodSelected(mood);
    }

    // Show mood-based reward message
    // No popup alerts - professional approach
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-[#E8E6DC] shadow-sm">
      <h3 className="font-heading font-semibold text-base text-[#141413] mb-4">
        Session Feedback
      </h3>
      <div className="grid grid-cols-5 gap-3 mb-4">
        {moods.map((mood) => {
          const Icon = mood.icon;
          const isSelected = selectedMood === mood.id;
          
          return (
            <button
              key={mood.id}
              onClick={() => handleMoodSelect(mood.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                isSelected
                  ? `${mood.bg} border-2 border-current ${mood.color}`
                  : 'bg-[#FAF9F5] border-2 border-transparent hover:bg-[#E8E6DC]'
              }`}
            >
              <Icon className={`w-8 h-8 ${isSelected ? mood.color : 'text-[#B0AEA5]'}`} />
              <span className={`text-xs font-heading ${isSelected ? mood.color : 'text-[#B0AEA5]'}`}>
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>
      {selectedMood && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: Add a note about how you're feeling..."
          className="w-full px-4 py-2 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] text-[#141413] text-sm min-h-[60px]"
        />
      )}
    </div>
  );
}
