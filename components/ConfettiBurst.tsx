'use client';

import { useEffect, useMemo, useState } from 'react';

type Piece = {
  id: string;
  leftPct: number;
  delayMs: number;
  durationMs: number;
  rotateDeg: number;
  color: string;
  sizePx: number;
};

export default function ConfettiBurst(props: { onDone?: () => void }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  const colors = useMemo(
    () => ['#D97757', '#6A9BCC', '#788C5D', '#141413', '#E8E6DC'],
    []
  );

  useEffect(() => {
    const count = 26;
    const next: Piece[] = Array.from({ length: count }).map((_, i) => {
      const r = Math.random();
      return {
        id: `${Date.now()}-${i}`,
        leftPct: Math.random() * 100,
        delayMs: Math.floor(Math.random() * 120),
        durationMs: 700 + Math.floor(Math.random() * 500),
        rotateDeg: Math.floor(Math.random() * 360),
        color: colors[i % colors.length],
        sizePx: 6 + Math.floor(r * 6),
      };
    });
    setPieces(next);

    const done = window.setTimeout(() => {
      props.onDone?.();
    }, 1400);
    return () => window.clearTimeout(done);
  }, [colors, props]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style jsx global>{`
        @keyframes ff-confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(220px) rotate(380deg);
            opacity: 0;
          }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.leftPct}%`,
            width: `${p.sizePx}px`,
            height: `${p.sizePx}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotateDeg}deg)`,
            animation: `ff-confetti-fall ${p.durationMs}ms ease-out ${p.delayMs}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

