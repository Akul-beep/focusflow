'use client';

import { Plus, Play, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import Link from 'next/link';

interface QuickActionsProps {
  onAddTask: () => void;
}

export default function QuickActions({ onAddTask }: QuickActionsProps) {
  const { tasks } = useStore();
  const hasActiveTasks = tasks.filter((t) => !t.completed).length > 0;

  return (
    <div className="flex items-center gap-3">
      {hasActiveTasks && (
        <Link
          href="/focus"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
        >
          <Play className="w-4 h-4" />
          Start Focus
        </Link>
      )}
      <button
        onClick={onAddTask}
        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] hover:border-[#B0AEA5] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </button>
    </div>
  );
}
