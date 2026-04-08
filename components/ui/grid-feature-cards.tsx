"use client";

import { cn } from "@/lib/utils";
import React from "react";

type FeatureType = {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
};

type FeatureCardProps = React.ComponentProps<"div"> & {
  feature: FeatureType;
  /** Stable grid decoration — avoids random SSR/client mismatch */
  patternKey?: string;
};

/** Deterministic “random” grid dots from a string (same server + client). */
function patternFromKey(key: string, length = 5): number[][] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[][] = [];
  for (let i = 0; i < length; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const x = 7 + (Math.abs(h) % 4);
    const y = 1 + (Math.abs(h >> 8) % 6);
    out.push([x, y]);
  }
  return out;
}

export function FeatureCard({ feature, className, patternKey, ...props }: FeatureCardProps) {
  const Icon = feature.icon;
  const p = patternFromKey(patternKey ?? feature.title);

  return (
    <div className={cn("relative overflow-hidden bg-white p-6", className)} {...props}>
      <div className="pointer-events-none absolute left-1/2 top-0 -ml-20 -mt-2 h-full w-full [mask-image:linear-gradient(white,transparent)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#141413]/[0.06] to-[#141413]/[0.02] opacity-100 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
          <GridPattern
            width={20}
            height={20}
            x="-12"
            y="4"
            squares={p}
            className="absolute inset-0 h-full w-full fill-[#141413]/[0.06] stroke-[#141413]/20 mix-blend-overlay"
          />
        </div>
      </div>
      <Icon className="size-6 text-[#141413]/75" strokeWidth={1} aria-hidden />
      <h3 className="mt-10 font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#141413] md:text-base">
        {feature.title}
      </h3>
      <p className="relative z-20 mt-2 text-xs font-light leading-relaxed text-[#b0aea5] md:text-sm">
        {feature.description}
      </p>
    </div>
  );
}

function GridPattern({
  width,
  height,
  x,
  y,
  squares,
  ...props
}: React.ComponentProps<"svg"> & {
  width: number;
  height: number;
  x: string;
  y: string;
  squares?: number[][];
}) {
  const patternId = React.useId().replace(/:/g, "");

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      {squares ? (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy], index) => (
            <rect
              strokeWidth="0"
              key={`${sx}-${sy}-${index}`}
              width={width + 1}
              height={height + 1}
              x={sx * width}
              y={sy * height}
            />
          ))}
        </svg>
      ) : null}
    </svg>
  );
}
