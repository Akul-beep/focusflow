'use client';

import { useStore } from '@/lib/store';
import { Sprout, TreePine, Flower2, Circle } from 'lucide-react';
import { format } from 'date-fns';

export default function GrowthGarden() {
  const { stats } = useStore();

  const getPlantIcon = (type: string) => {
    switch (type) {
      case 'seed':
        return Circle;
      case 'sprout':
        return Sprout;
      case 'sapling':
        return TreePine;
      case 'tree':
      case 'flower':
        return Flower2;
      default:
        return Circle;
    }
  };

  const getPlantSize = (type: string) => {
    switch (type) {
      case 'seed':
        return 'w-8 h-8';
      case 'sprout':
        return 'w-12 h-12';
      case 'sapling':
        return 'w-16 h-16';
      case 'tree':
      case 'flower':
        return 'w-20 h-20';
      default:
        return 'w-8 h-8';
    }
  };

  const totalFocusHours = Math.floor(stats.totalFocusMinutes / 60);
  const plantsToShow = Math.min(Math.floor(totalFocusHours / 2), 10); // One plant per 2 hours

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-[#E8E6DC] shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-heading font-bold text-lg text-[#141413] mb-1">Focus Hours</h3>
          <p className="text-xs text-[#B0AEA5]">
            Total time spent in focus sessions
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-heading font-bold text-[#141413]">{totalFocusHours}</div>
          <div className="text-xs text-[#B0AEA5] font-heading">Hours</div>
        </div>
      </div>

      <div className="w-full h-2 bg-[#E8E6DC] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#141413] transition-all duration-500 rounded-full"
          style={{ width: `${Math.min(100, (totalFocusHours / 20) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-[#B0AEA5] mt-3 text-center">
        {totalFocusHours < 1
          ? "Start focus sessions to track your progress"
          : `${totalFocusHours} hour${totalFocusHours !== 1 ? 's' : ''} completed`}
      </p>
    </div>
  );
}
