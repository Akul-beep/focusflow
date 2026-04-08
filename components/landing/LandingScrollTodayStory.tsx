"use client";

import { useLayoutEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "framer-motion";
import { TodayScreenMock } from "@/components/landing/mocks/TodayScreenMock";

const MOCK_W = 1040;

/**
 * Scroll chapter: Today view as the daily operating screen after planning.
 */
export function LandingScrollTodayStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fitMv = useMotionValue(1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.88", "end 0.12"],
  });

  const p = useTransform(scrollYProgress, (v) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return Math.min(1, Math.max(0, n));
  });

  const leadOpacity = useTransform(p, [0, 0.18, 0.34, 0.44, 1], [1, 1, 0.35, 0, 0]);
  const detailOpacity = useTransform(p, [0.4, 0.52, 0.88, 1], [0, 1, 1, 1]);
  const mockY = useTransform(p, [0, 0.35, 0.55], [48, 20, 0]);
  const mockScale = useTransform(p, [0, 0.4], [0.94, 1]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 12;
      fitMv.set(Math.min(1, w / MOCK_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMv]);

  const combinedScale = useTransform([mockScale, fitMv], ([ms, f]) => Number(ms) * Number(f));

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-[#e8e6dc] bg-gradient-to-b from-[#faf9f5] via-white to-[#faf9f5]"
      style={{ minHeight: "220vh" }}
      aria-labelledby="today-story-heading"
    >
      <div className="sticky top-0 grid min-h-[100svh] grid-cols-1 items-center gap-10 px-4 py-16 lg:grid-cols-12 lg:gap-0 lg:px-12">
        <div className="mx-auto max-w-xl lg:col-span-5 lg:mx-0 lg:max-w-none lg:pr-8">
          <p className="mb-3 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
            Today
          </p>
          <h2
            id="today-story-heading"
            className="font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl"
          >
            One lane for what the calendar actually assigned you.
          </h2>

          <div className="relative mt-8 min-h-[9rem] md:min-h-[10rem]">
            <motion.p
              style={{ opacity: leadOpacity }}
              className="absolute inset-0 text-base leading-relaxed text-[#6f6d66] md:text-lg"
            >
              After AI and exams do the heavy structuring, Today is where you execute: ordered steps, honest times, and
              buttons that jump straight into Focus.
            </motion.p>
            <motion.p
              style={{ opacity: detailOpacity }}
              className="absolute inset-0 text-base leading-relaxed text-[#6f6d66] md:text-lg"
            >
              Recovery and replanning stay one tap away, so a rough week does not mean a ruined plan.
            </motion.p>
          </div>
        </div>

        <div
          ref={measureRef}
          className="flex min-h-[320px] items-center justify-center lg:col-span-7 lg:min-h-[min(86vh,820px)] [overflow-x:clip]"
        >
          <motion.div
            style={{ y: mockY, scale: combinedScale }}
            className="pointer-events-none select-none will-change-transform"
          >
            <div className="overflow-hidden rounded-2xl shadow-[0_32px_100px_rgba(20,20,19,0.12)]">
              <TodayScreenMock />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
