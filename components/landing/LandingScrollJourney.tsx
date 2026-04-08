"use client";

import { useLayoutEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Sparkles } from "lucide-react";
import { DashboardScreenMock } from "@/components/landing/DashboardScreenMock";
import { FocusModeScreenMock } from "@/components/landing/mocks/FocusModeScreenMock";

const MOCK_W = 1360;
const MOCK_H = 800;

const CHAOS = [
  { id: "a", label: "IO script", sx: -48, sy: -40, r: -16, bg: "bg-[#D97757]/12 border-[#D97757]/30" },
  { id: "b", label: "Chem IA data", sx: 52, sy: -36, r: 14, bg: "bg-[#6A9BCC]/12 border-[#6A9BCC]/35" },
  { id: "c", label: "Math problem set", sx: -54, sy: 26, r: -10, bg: "bg-[#788C5D]/12 border-[#788C5D]/35" },
  { id: "d", label: "CAS reflections", sx: 50, sy: 30, r: 11, bg: "bg-amber-50 border-amber-200/80" },
  { id: "e", label: "History essay", sx: -12, sy: -46, r: 7, bg: "bg-[#FAF9F5] border-[#E8E6DC]" },
  { id: "f", label: "TOK exhibition", sx: 18, sy: 44, r: -13, bg: "bg-[#D97757]/10 border-[#E8E6DC]" },
] as const;

function ChaosCard({
  item,
  progress,
}: {
  item: (typeof CHAOS)[number];
  progress: MotionValue<number>;
}) {
  const x = useTransform(progress, [0, 0.36], [item.sx * 5.5, 0]);
  const y = useTransform(progress, [0, 0.36], [item.sy * 5.5, -12]);
  const rotate = useTransform(progress, [0, 0.36], [item.r, 0]);
  const scale = useTransform(progress, [0, 0.32, 0.44], [1, 0.5, 0.06]);
  const opacity = useTransform(progress, [0.28, 0.44], [1, 0]);

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity }}
      className={`pointer-events-none absolute left-1/2 top-[42%] z-20 w-[min(36vw,14rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-4 py-3 font-heading text-sm font-semibold text-[#141413] shadow-lg backdrop-blur-sm sm:w-[15rem] sm:text-[15px] ${item.bg}`}
    >
      {item.label}
    </motion.div>
  );
}

/**
 * Scroll-driven story: chaotic tasks → AI-organized dashboard → Focus mode.
 */
export function LandingScrollJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fitMv = useMotionValue(1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /** Keep 0 to 1 so opacity/scales never extrapolate past keyframes (fixes blank after fast scroll). */
  const p = useTransform(scrollYProgress, (v) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return Math.min(1, Math.max(0, n));
  });

  const chaosLayerOpacity = useTransform(p, [0, 0.08, 0.42, 0.5], [1, 1, 0.35, 0]);
  const dashOpacity = useTransform(p, [0.2, 0.38, 0.72, 0.86], [0, 1, 1, 0]);
  const dashScale = useTransform(p, [0.2, 0.42, 0.78], [0.9, 1, 0.96]);
  const focusOpacity = useTransform(p, [0.7, 0.82, 0.92, 1], [0, 1, 1, 1]);
  const focusY = useTransform(p, [0.7, 0.88], [28, 0]);
  const aiBadgeOpacity = useTransform(p, [0.32, 0.42, 0.55, 0.68], [0, 1, 1, 0]);
  const aiBadgeY = useTransform(p, [0.32, 0.5], [12, 0]);

  const narrativeOpacity = useTransform(p, [0, 0.12, 0.22, 0.28], [1, 1, 0.4, 0]);
  const narrative2Opacity = useTransform(p, [0.32, 0.45, 0.58, 0.7], [0, 1, 1, 0]);
  const narrative3Opacity = useTransform(p, [0.72, 0.82, 0.92, 1], [0, 1, 1, 1]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 8;
      fitMv.set(Math.min(1, w / MOCK_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMv]);

  const dashCombinedScale = useTransform([dashScale, fitMv], ([ds, f]) => Number(ds) * Number(f));

  return (
    <section
      ref={sectionRef}
      className="relative bg-gradient-to-b from-[#faf9f5] via-white to-[#faf9f5]"
      style={{ minHeight: "340vh" }}
      aria-label="From chaos to focus"
    >
      <div className="pointer-events-none absolute left-0 right-0 top-14 z-30 flex flex-col items-center gap-2 px-4 text-center md:top-16 md:gap-2.5">
        <motion.p
          style={{ opacity: narrativeOpacity }}
          className="max-w-lg font-[family-name:var(--font-poppins)] text-xl font-semibold tracking-tight text-[#141413] md:text-2xl"
        >
          Everything lands in your head at once.
        </motion.p>
        <motion.p
          style={{ opacity: narrative2Opacity }}
          className="max-w-md text-sm text-[#6f6d66] md:text-base"
        >
          AI breaks it into tasks on your real dashboard: priorities, steps, and due dates in the same chrome you use
          every day.
        </motion.p>
        <motion.p
          style={{ opacity: narrative3Opacity }}
          className="max-w-md text-sm text-[#6f6d66] md:text-base"
        >
          Pick one step and drop into Focus: timer, forest growth, and streaks without leaving the flow.
        </motion.p>
      </div>

      <motion.div
        style={{ opacity: aiBadgeOpacity, y: aiBadgeY }}
        className="pointer-events-none absolute left-1/2 top-[18%] z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#E8E6DC] bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md md:top-[16%]"
      >
        <Sparkles className="h-4 w-4 text-[#D97757]" aria-hidden />
        <span className="font-heading text-sm font-semibold text-[#141413]">Sorted with AI</span>
      </motion.div>

      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-1 py-4 md:px-3 md:py-6 [perspective:2000px] [overflow-x:clip]">
        <div
          ref={measureRef}
          className="relative flex w-full max-w-[min(92rem,calc(100vw-0.75rem))] flex-1 items-center justify-center"
        >
          <motion.div
            style={{ opacity: chaosLayerOpacity }}
            className="absolute inset-0 z-10 flex items-center justify-center"
            aria-hidden
          >
            {CHAOS.map((item) => (
              <ChaosCard key={item.id} item={item} progress={p} />
            ))}
          </motion.div>

          <motion.div
            style={{
              opacity: dashOpacity,
              scale: dashCombinedScale,
              transformStyle: "preserve-3d",
              width: MOCK_W,
              height: MOCK_H,
            }}
            className="relative z-[15] shrink-0 will-change-transform"
          >
            <div className="pointer-events-none h-full w-full select-none overflow-hidden rounded-2xl border border-[#E8E6DC] shadow-[0_32px_100px_rgba(20,20,19,0.14)]">
              <DashboardScreenMock />
            </div>
          </motion.div>

          <motion.div
            style={{
              opacity: focusOpacity,
              y: focusY,
              scale: fitMv,
            }}
            className="absolute inset-0 z-20 flex items-center justify-center will-change-transform"
          >
            <div className="pointer-events-none select-none">
              <FocusModeScreenMock />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
