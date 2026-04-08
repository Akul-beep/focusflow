"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, CalendarDays, CheckCircle2, Sparkles, Timer } from "lucide-react";

const STEP_MS = 520;

function useStopMotionFrame(length: number, ms = STEP_MS) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % length), ms);
    return () => clearInterval(id);
  }, [length, ms]);
  return i;
}

function WeekCalendarMotion() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const f = useStopMotionFrame(7);
  return (
    <div className="relative flex h-full min-h-[200px] flex-col bg-[#faf9f5] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[#e8e6dc] pb-2">
        <CalendarDays className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-heading text-xs font-semibold text-[#141413]">This week</span>
      </div>
      <div className="flex justify-between gap-1">
        {days.map((d, i) => (
          <motion.div
            key={`${d}-${i}`}
            animate={{
              scale: i === f ? 1.08 : 1,
              backgroundColor: i === f ? "rgba(217, 119, 87, 0.18)" : "rgba(255,255,255,1)",
              borderColor: i === f ? "rgba(217, 119, 87, 0.45)" : "rgba(232, 230, 220, 1)",
            }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex h-10 w-9 items-center justify-center rounded-lg border font-heading text-[11px] font-semibold text-[#141413] shadow-sm"
          >
            {d}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[
          { t: "Physics · Paper drill", start: 3 },
          { t: "English · IO bullets", start: 4 },
          { t: "Math · Review set", start: 5 },
        ].map((row, idx) => (
          <motion.div
            key={row.t}
            animate={{
              opacity: f >= row.start ? 1 : 0.32,
              x: f >= row.start ? 0 : -6,
            }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2 rounded-lg border border-[#e8e6dc] bg-white px-3 py-2"
          >
            <motion.div
              animate={{ opacity: f >= row.start + 1 + idx ? 1 : 0.25 }}
              transition={{ duration: 0.1 }}
            >
              <CheckCircle2 className="h-4 w-4 text-[#788c5d]" aria-hidden />
            </motion.div>
            <span className="font-heading text-[11px] font-medium text-[#141413]">{row.t}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FocusTimerMotion() {
  const f = useStopMotionFrame(5);
  const pct = [0, 0.22, 0.45, 0.68, 0.88][f];
  const R = 52;
  const c = 2 * Math.PI * R;
  const off = c * (1 - pct);
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center bg-[#faf9f5] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Timer className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-heading text-xs font-semibold text-[#141413]">Focus</span>
      </div>
      <div className="relative h-[132px] w-[132px]">
        <svg className="-rotate-90" width={132} height={132} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#e8e6dc" strokeWidth="8" />
          <motion.circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="#141413"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            animate={{ strokeDashoffset: off }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={f}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="font-heading text-2xl font-bold tabular-nums text-[#141413]"
            >
              {["25:00", "19:18", "13:42", "08:05", "02:20"][f]}
            </motion.span>
          </AnimatePresence>
          <span className="font-heading text-[9px] text-[#b0aea5]">session</span>
        </div>
      </div>
      <p className="mt-3 max-w-[200px] text-center font-heading text-[10px] leading-snug text-[#6f6d66]">
        Timer, forest, and streak use the same screen as the live app.
      </p>
    </div>
  );
}

function AiStepsMotion() {
  const f = useStopMotionFrame(7);
  const lines = [
    "",
    "Chem lab: ",
    "Chem lab: data and graph",
    "Chem lab: data and graph",
    "Chem lab: data and graph",
    "Chem lab: data and graph",
    "Chem lab: data and graph",
  ];
  const visibleSteps = Math.max(0, Math.min(3, f - 3));
  const line = lines[f] ?? "";
  return (
    <div className="flex h-full min-h-[200px] flex-col bg-[#faf9f5] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[#e8e6dc] pb-2">
        <Sparkles className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-heading text-xs font-semibold text-[#141413]">AI task input</span>
      </div>
      <div className="rounded-lg border border-[#e8e6dc] bg-white p-3">
        <p className="min-h-[2.75rem] font-body text-[11px] leading-relaxed">
          {line ? (
            <>
              <span className="text-[#141413]">{line}</span>
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 0.15 }}
                className="ml-0.5 font-heading text-[#d97757]"
              >
                |
              </motion.span>
            </>
          ) : (
            <span className="text-[#b0aea5]">Describe a task…</span>
          )}
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {["Outline variables", "Collect data", "Write analysis"].map((label, i) => (
          <motion.div
            key={label}
            initial={false}
            animate={{
              opacity: i < visibleSteps ? 1 : 0.22,
              x: i < visibleSteps ? 0 : -4,
            }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2 rounded-md border border-[#e8e6dc] bg-white px-2.5 py-1.5"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#e8e6dc] font-heading text-[9px] text-[#b0aea5]">
              {i + 1}
            </span>
            <span className="font-heading text-[10px] font-medium text-[#141413]">{label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: "Plans that match your week",
    body: "Your classes and deadlines stay visible so nothing important gets buried under busywork.",
    icon: CalendarDays,
    motion: WeekCalendarMotion,
  },
  {
    title: "Focus without the guilt spiral",
    body: "Start a session in one tap and come back to a queue that still makes sense when you pause.",
    icon: Timer,
    motion: FocusTimerMotion,
  },
  {
    title: "AI that shrinks the blank page",
    body: "Describe a task in plain language and get steps you can tick off instead of staring at a wall of text.",
    icon: Brain,
    motion: AiStepsMotion,
  },
] as const;

/**
 * Feature grid with stop-motion style UI loops (no photos).
 */
export function LandingFeatureStopMotion() {
  return (
    <ul className="mx-auto mt-14 grid max-w-6xl gap-8 md:grid-cols-3 md:gap-6">
      {CARDS.map((item) => {
        const Icon = item.icon;
        const MotionPanel = item.motion;
        return (
          <li
            key={item.title}
            className="flex flex-col overflow-hidden rounded-2xl border border-[#e8e6dc] bg-white shadow-[0_12px_40px_rgba(20,20,19,0.06)]"
          >
            <div className="relative aspect-[16/11] w-full overflow-hidden border-b border-[#e8e6dc] bg-white">
              <MotionPanel />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf9f5] text-[#d97757]">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#141413]">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[#b0aea5]">{item.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
