'use client';

import { useStore } from '@/lib/store';
import { TreePine } from 'lucide-react';
import { useEffect, useMemo } from 'react';

interface Tree {
  id: number;
  size: number; // 0-1 scale
  x: number; // position
  color: string;
}

const TREE_COLORS = [
  '#788C5D', // green
  '#6A9BCC', // blue-green
  '#5A7A4E', // dark green
  '#7BA56F', // light green
  '#6B8E5A', // olive
];

export default function TreeForest(props: { variant?: 'default' | 'compact'; extraGrowthMinutes?: number } = {}) {
  const { stats, updateStats } = useStore();
  const variant = props.variant || 'default';

  useEffect(() => {
    updateStats();
  }, [updateStats]);

  const trees = useMemo(() => {
    // Show growth from day one:
    // - Seed always visible
    // - Forest grows with focus minutes, but also with completed micro-tasks (for students who start by checking steps)
    const focusMinutes = stats.totalFocusMinutes;
    const microBoostMinutes = stats.microTasksCompleted * 5; // 5 minutes credit per completed step
    const extra = Math.max(0, props.extraGrowthMinutes || 0);
    const totalGrowthMinutes = focusMinutes + microBoostMinutes + extra;

    // Forest-style growth:
    // Keep it motivating: quick wins without spamming the view.
    const minutesPerTick = 10;
    const minutesPerTree = 30; // 3 ticks per tree
    const numTrees = Math.floor(totalGrowthMinutes / minutesPerTree);
    const currentTreeProgress = (totalGrowthMinutes % minutesPerTree) / minutesPerTree;

    const newTrees: Tree[] = [];

    // Keep trees away from the edges so the first sapling doesn't render off-screen.
    const xForIndex = (i: number) => {
      const base = 12 + ((i * 11) % 76); // 12..88
      const jitter = ((i * 7) % 5) - 2; // -2..+2
      return Math.max(8, Math.min(92, base + jitter));
    };

    for (let i = 0; i < numTrees; i++) {
      newTrees.push({
        id: i,
        size: 1,
        x: xForIndex(i),
        color: TREE_COLORS[i % TREE_COLORS.length],
      });
    }

    if (currentTreeProgress > 0 && totalGrowthMinutes > 0) {
      newTrees.push({
        id: numTrees,
        // Make early progress visibly meaningful (avoid tiny/hidden sapling).
        size: Math.max(0.35, 0.35 + 0.65 * currentTreeProgress),
        x: xForIndex(numTrees),
        color: TREE_COLORS[numTrees % TREE_COLORS.length],
      });
    }

    if (newTrees.length === 0) {
      newTrees.push({
        id: 0,
        size: 0.35,
        x: 45,
        color: TREE_COLORS[0],
      });
    }

    return newTrees;
  }, [stats.totalFocusMinutes, stats.microTasksCompleted, props.extraGrowthMinutes]);

  const totalGrowthMinutes = stats.totalFocusMinutes + stats.microTasksCompleted * 5 + Math.max(0, props.extraGrowthMinutes || 0);
  const minutesPerTick = 10;
  const minutesPerTree = 30;
  const ticksPerTree = Math.max(1, Math.round(minutesPerTree / minutesPerTick));
  const treesPlanted = Math.floor(totalGrowthMinutes / minutesPerTree);
  const nextTreeAtMinutes = (treesPlanted + 1) * minutesPerTree;
  const minutesIntoCurrentTree = totalGrowthMinutes % minutesPerTree;
  const ticksEarned = Math.min(ticksPerTree, Math.floor(minutesIntoCurrentTree / minutesPerTick));

  return (
    <div className={`bg-white rounded-xl border border-[#E8E6DC] shadow-sm ${variant === 'compact' ? 'p-4' : 'p-6'}`}>
      <div className={`flex items-center gap-3 ${variant === 'compact' ? 'mb-3' : 'mb-6'}`}>
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#788C5D]/20 to-[#6A9BCC]/20 flex items-center justify-center">
          <TreePine className="w-5 h-5 text-[#788C5D]" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-lg text-[#141413]">
            Growth Forest
          </h3>
          <p className="text-xs text-[#B0AEA5]">Your progress visualized</p>
        </div>
      </div>

      {/* Forest Visualization */}
      <div className={`relative ${variant === 'compact' ? 'mb-3' : 'mb-6'}`}>
        <div className={`relative ${variant === 'compact' ? 'h-28' : 'h-48'} bg-gradient-to-b from-[#FAF9F5] to-[#E8E6DC] rounded-lg overflow-hidden border border-[#E8E6DC]`}>
          {/* Ground */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#788C5D]/30 to-transparent" />
          
          {/* Trees */}
          <svg
            className="w-full h-full absolute inset-0"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            {trees.map((tree) => {
              const treeHeight = 15 + tree.size * 25; 
              const treeWidth = 3 + tree.size * 4; 
              const trunkHeight = treeHeight * 0.4;
              const crownHeight = treeHeight * 0.6;
              
              return (
                <g
                  key={tree.id}
                  transform={`translate(${tree.x}, ${100 - trunkHeight - crownHeight * tree.size})`}
                  className="transition-all duration-500 ease-out"
                  style={{ opacity: 1 }}
                >
                  {/* Tree Crown (Foliage) */}
                  <ellipse
                    cx="0"
                    cy="0"
                    rx={treeWidth * 1.5}
                    ry={crownHeight * 0.8}
                    fill={tree.color}
                    opacity={0.8}
                  />
                  <ellipse
                    cx={-treeWidth * 0.6}
                    cy={-crownHeight * 0.2}
                    rx={treeWidth * 1.2}
                    ry={crownHeight * 0.6}
                    fill={tree.color}
                    opacity={0.6}
                  />
                  <ellipse
                    cx={treeWidth * 0.6}
                    cy={-crownHeight * 0.2}
                    rx={treeWidth * 1.2}
                    ry={crownHeight * 0.6}
                    fill={tree.color}
                    opacity={0.6}
                  />
                  
                  {/* Tree Trunk */}
                  <rect
                    x={-treeWidth * 0.3}
                    y={0}
                    width={treeWidth * 0.6}
                    height={trunkHeight}
                    fill="#5A4A3A"
                    opacity={0.9}
                  />
                </g>
              );
            })}
          </svg>
          
          {/* Empty state */}
          {trees.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <TreePine className="w-12 h-12 text-[#E8E6DC] mx-auto mb-3" />
                <p className="text-sm text-[#B0AEA5] font-heading">
                  Start your journey
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-heading text-[#141413]">
            Trees Planted
          </span>
          <span className="text-lg font-heading font-bold text-[#141413]">
            {treesPlanted}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs text-[#B0AEA5]">
          <span>Growth time: {Math.floor(totalGrowthMinutes)} min</span>
          <span>Next tree in {Math.max(0, Math.ceil(nextTreeAtMinutes - totalGrowthMinutes))} min</span>
        </div>

        {/* Progress bar (tick-based) */}
        <div className="w-full h-2 bg-[#E8E6DC] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#788C5D] transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, (minutesIntoCurrentTree / minutesPerTree) * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#B0AEA5] font-heading">
          <span>Today’s growth: {ticksEarned}/{ticksPerTree} ticks</span>
          <span>+1 tick every {minutesPerTick} min</span>
        </div>
      </div>
    </div>
  );
}
