"use client";

import { useLayoutEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "framer-motion";
import { ExamDetailScreenMock } from "@/components/landing/mocks/ExamDetailScreenMock";
import { ExamsListScreenMock } from "@/components/landing/mocks/ExamsListScreenMock";

const DETAIL_W = 1120;

/**
 * Scroll chapter: Exams list → exam detail (syllabus, coverage, repack).
 */
export function LandingScrollExamStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fitMv = useMotionValue(1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.85", "end 0.15"],
  });

  const p = useTransform(scrollYProgress, (v) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return Math.min(1, Math.max(0, n));
  });

  const t1 = useTransform(p, [0, 0.15, 0.28, 0.38], [1, 1, 0.25, 0]);
  const t2 = useTransform(p, [0.22, 0.38, 0.52, 0.65, 0.78], [0, 1, 1, 0.3, 0]);
  const t3 = useTransform(p, [0.62, 0.78, 0.92], [0, 1, 1]);

  const listOpacity = useTransform(p, [0, 0.42, 0.52, 1], [1, 1, 0, 0]);
  const listScale = useTransform(p, [0, 0.45, 1], [1, 0.94, 0.94]);
  const detailOpacity = useTransform(p, [0.38, 0.52, 0.96, 1], [0, 1, 1, 1]);
  const detailY = useTransform(p, [0.38, 0.55], [36, 0]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 12;
      fitMv.set(Math.min(1, w / DETAIL_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMv]);

  const listScaleFit = useTransform([listScale, fitMv], ([ls, f]) => Number(ls) * Number(f));

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-[#e8e6dc] bg-[#141413] text-white"
      style={{ minHeight: "300vh" }}
      aria-labelledby="exam-story-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d97757]/[0.12] via-transparent to-[#6a9bcc]/[0.1]" aria-hidden />

      <div className="sticky top-0 grid min-h-[100svh] grid-cols-1 items-center gap-8 px-4 py-16 md:grid-cols-2 md:gap-12 md:px-10 lg:px-16">
        <div className="order-2 flex max-h-[min(72vh,640px)] min-h-0 flex-col justify-center md:order-1 md:max-h-none">
          <p className="mb-3 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
            Exam prep
          </p>
          <h2
            id="exam-story-heading"
            className="font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight md:text-4xl"
          >
            Papers, syllabi, and countdowns stay cousins, not strangers.
          </h2>

          <div className="relative mt-8 min-h-[8rem] md:min-h-[10rem]">
            <motion.p
              style={{ opacity: t1 }}
              className="absolute inset-0 text-base leading-relaxed text-[#b0aea5] md:text-lg"
            >
              Every exam card is the same chrome as the rest of Flowly: subject, date badge, and one tap into the
              plan you already started.
            </motion.p>
            <motion.p
              style={{ opacity: t2 }}
              className="absolute inset-0 text-base leading-relaxed text-[#b0aea5] md:text-lg"
            >
              Inside, the real screen: coverage ring against your syllabus list, filters for not covered and flagged,
              and the same topic rows you use when revising for real.
            </motion.p>
            <motion.p
              style={{ opacity: t3 }}
              className="absolute inset-0 text-base leading-relaxed text-[#b0aea5] md:text-lg"
            >
              When the week reshapes, repack pushes open sessions into your current work window without you rebuilding
              the whole plan by hand.
            </motion.p>
          </div>
        </div>

        <div
          ref={measureRef}
          className="relative order-1 flex min-h-[300px] items-center justify-center md:order-2 md:min-h-[min(82vh,800px)] [overflow-x:clip]"
        >
          <motion.div
            style={{ opacity: listOpacity, scale: listScaleFit }}
            className="absolute inset-0 z-10 flex items-center justify-center will-change-transform"
          >
            <div className="pointer-events-none select-none overflow-hidden rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
              <ExamsListScreenMock />
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: detailOpacity, y: detailY, scale: fitMv }}
            className="absolute inset-0 z-20 flex items-center justify-center will-change-transform"
          >
            <div className="pointer-events-none select-none overflow-hidden rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
              <ExamDetailScreenMock />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
