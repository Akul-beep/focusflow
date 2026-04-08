"use client";

import Image from "next/image";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  LANDING_DASHBOARD,
  LANDING_SCROLL_MOCK_H,
  LANDING_SCROLL_MOCK_W,
} from "@/lib/landing-assets";

/** Inset from measureRef edges so the scaled mock never touches or clips the viewport */
const MOCK_FIT_PAD = 12;
/** Final scale relative to strict fit-to-column (1 = full fit) */
const MOCK_DISPLAY_SCALE = 0.95;

/** Nudge mock + chaos layer left inside the animation column */
const MOCK_NUDGE_LEFT_CLASS = "-translate-x-3 sm:-translate-x-5 md:-translate-x-7 lg:-translate-x-8";

/** Set to e.g. `/landing/messy-focused.webm` after you export a clip. Scroll scrubs `currentTime` (smooth, GPU-decoded). */
const MESSY_SCROLL_VIDEO_SRC = process.env.NEXT_PUBLIC_LANDING_MESSY_VIDEO?.trim() || "";

/**
 * Scroll span beyond one viewport: Framer progress 0→1 matches scrollY in [top, top + range].
 * Wheel is clamped to this range so the sticky scene stays put until the scrub finishes.
 */
const MESSY_SCRUB_MIN_HEIGHT = "calc(100dvh + min(110vh, 960px))";

function wheelDeltaPixels(e: WheelEvent): number {
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  else if (e.deltaMode === 2) dy *= window.innerHeight;
  return dy;
}

function getMessyScrubBounds(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const top = window.scrollY + rect.top;
  const h = section.offsetHeight;
  const vh = window.innerHeight;
  const range = Math.max(0, h - vh);
  const maxY = top + range;
  return { top, maxY, range };
}

const CHAOS = [
  { id: "1", label: "Presentation script", sx: -48, sy: -36, bg: "bg-[#D97757]/15 border-[#D97757]/35" },
  { id: "2", label: "Lab report data", sx: 44, sy: -40, bg: "bg-[#6A9BCC]/14 border-[#6A9BCC]/40" },
  { id: "3", label: "Math problem set", sx: -40, sy: 30, bg: "bg-[#788C5D]/14 border-[#788C5D]/38" },
  { id: "4", label: "Volunteer log", sx: 48, sy: 26, bg: "bg-amber-100/90 border-amber-200/80" },
  { id: "5", label: "History essay", sx: -10, sy: -44, bg: "bg-[#FAF9F5] border-[#E8E6DC]" },
  { id: "6", label: "Research fair board", sx: 20, sy: 42, bg: "bg-[#D97757]/12 border-[#E8E6DC]" },
] as const;

const ChaosCard = memo(function ChaosCard({
  item,
  progress,
  index,
}: {
  item: (typeof CHAOS)[number];
  progress: MotionValue<number>;
  index: number;
}) {
  const stagger = index * 0.025;
  const shifted = useTransform(progress, (v) => Math.max(0, Math.min(1, v - stagger)));
  /* Longer gather + later fade so “messy” stays readable while scrolling */
  const x = useTransform(shifted, [0, 0.1, 0.52], [item.sx * 4.5, item.sx * 4.5, 0]);
  const y = useTransform(shifted, [0, 0.1, 0.52], [item.sy * 4.5, item.sy * 4.5, -6]);
  const opacity = useTransform(shifted, [0.52, 0.8], [1, 0]);

  return (
    <motion.div
      style={{ x, y, opacity, willChange: "transform, opacity" }}
      className={`pointer-events-none absolute left-1/2 top-[44%] z-20 w-[min(32vw,12rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 font-[family-name:var(--font-poppins)] text-xs font-semibold text-[#141413] shadow-md sm:w-[13rem] sm:text-[13px] ${item.bg}`}
    >
      {item.label}
    </motion.div>
  );
});

ChaosCard.displayName = "ChaosCard";

function StaticFallback() {
  return (
    <section
      className="border-t border-[#e8e6dc] bg-[#faf9f5] pt-20 pb-10 md:pt-28 md:pb-12"
      aria-labelledby="focused-heading-static"
    >
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-xl text-center md:text-left lg:mx-0">
          <p className="font-[family-name:var(--font-poppins)] text-sm font-medium text-[#d97757]">
            The freeze, then the fix
          </p>
          <h2
            id="focused-heading-static"
            className="mt-2 text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl"
          >
            Life was messy. Now it&apos;s focused.
          </h2>
          <p className="mt-4 text-lg text-[#6f6d66]">
            Real dashboard from the app. Not a marketing mock.
          </p>
        </div>
        <div className="relative mt-12 aspect-[2012/1176] w-full max-w-5xl overflow-hidden rounded-2xl border-2 border-[#E8E6DC] bg-[#faf9f5] shadow-[0_32px_100px_rgba(20,20,19,0.1)] ring-1 ring-[#141413]/[0.06]">
          <Image
            src={LANDING_DASHBOARD.src}
            alt="Flowly dashboard"
            fill
            className="object-contain object-top"
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
          />
        </div>
      </div>
    </section>
  );
}

function CopyColumn({
  messyLineOpacity,
  messySubOpacity,
  focusedLineOpacity,
  focusedSubOpacity,
  leadDashboardOpacity,
}: {
  messyLineOpacity: MotionValue<number>;
  messySubOpacity: MotionValue<number>;
  focusedLineOpacity: MotionValue<number>;
  focusedSubOpacity: MotionValue<number>;
  leadDashboardOpacity: MotionValue<number>;
}) {
  return (
    <div className="relative z-30 flex flex-col justify-center px-4 pb-0 pt-6 md:px-8 lg:w-[min(40%,420px)] lg:flex-shrink-0 lg:py-0 xl:pl-12">
      <div className="relative min-h-[11rem] lg:min-h-[16rem]">
        <motion.p
          style={{ opacity: messyLineOpacity }}
          className="absolute inset-x-0 top-0 font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl"
          aria-hidden
        >
          Life was messy.
        </motion.p>
        <motion.p
          style={{ opacity: messySubOpacity }}
          className="absolute inset-x-0 top-[3.25rem] text-base leading-relaxed text-[#6f6d66] md:top-[4.5rem] md:text-lg"
          aria-hidden
        >
          Tabs, deadlines, and half-finished work all shouting at once.
        </motion.p>

        <motion.p
          style={{ opacity: focusedLineOpacity }}
          className="absolute inset-x-0 top-0 font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl"
          aria-hidden
        >
          Now it&apos;s focused.
        </motion.p>
        <motion.p
          style={{ opacity: focusedSubOpacity }}
          className="absolute inset-x-0 top-[3.25rem] text-base leading-relaxed text-[#6f6d66] md:top-[4.5rem] md:text-lg"
          aria-hidden
        >
          One dashboard: priorities, steps, and due dates where you actually work.
        </motion.p>

        <motion.p
          style={{ opacity: leadDashboardOpacity }}
          className="absolute inset-x-0 bottom-0 hidden text-sm font-medium text-[#d97757] lg:block"
          aria-hidden
        >
          Scroll into the real dashboard →
        </motion.p>
      </div>
    </div>
  );
}

function VideoScrollPanel({
  src,
  scrollProgress,
}: {
  src: string;
  scrollProgress: MotionValue<number>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const d = video.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        const t = scrollProgress.get() * d;
        const clamped = Math.min(Math.max(0, t), Math.max(0, d - 1 / 30));
        if (Math.abs(video.currentTime - clamped) > 0.001) {
          video.currentTime = clamped;
        }
      });
    };

    tick();
    const unsub = scrollProgress.on("change", tick);
    return () => {
      unsub();
      cancelAnimationFrame(rafRef.current);
    };
  }, [scrollProgress]);

  return (
    <div
      className="relative w-full max-w-[min(100%,1360px)] transform-gpu will-change-transform"
      style={{ aspectRatio: `${LANDING_SCROLL_MOCK_W} / ${LANDING_SCROLL_MOCK_H}` }}
    >
      <video
        ref={videoRef}
        className="h-full w-full rounded-2xl border border-[#E8E6DC] object-cover shadow-[0_24px_80px_rgba(20,20,19,0.1)]"
        src={src}
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
    </div>
  );
}

function DomAnimationPanel({ p, fitMv }: { p: MotionValue<number>; fitMv: MotionValue<number> }) {
  /*
   * Drive almost all scroll toward the transition: dashboard only reads “finished” near p→1
   * so there’s no long tail of full-opacity dashboard while you’re still inside this section.
   */
  const chaosLayerOpacity = useTransform(p, [0, 0.52, 0.66, 0.78, 0.88, 0.96, 1], [1, 1, 1, 0.45, 0.12, 0, 0]);
  const dashOpacity = useTransform(p, [0.16, 0.34, 0.52, 0.68, 0.8, 0.9, 0.97, 1], [0, 0.06, 0.22, 0.45, 0.68, 0.86, 0.98, 1]);
  const dashScale = useTransform(p, [0.16, 0.44, 0.68, 0.86, 0.96, 1], [0.9, 0.93, 0.97, 1, 1, 1]);
  const dashCombinedScale = useTransform([dashScale, fitMv], ([ds, f]) => Number(ds) * Number(f));

  return (
    <div className={`relative ${MOCK_NUDGE_LEFT_CLASS}`}>
      {/* z above dashboard so task chips stay readable over the mock */}
      <motion.div
        style={{ opacity: chaosLayerOpacity, willChange: "opacity" }}
        className="absolute inset-0 z-[25] flex transform-gpu items-center justify-center"
        aria-hidden
      >
        {CHAOS.map((item, index) => (
          <ChaosCard key={item.id} item={item} progress={p} index={index} />
        ))}
      </motion.div>

      <motion.div
        style={{
          opacity: dashOpacity,
          scale: dashCombinedScale,
          width: LANDING_SCROLL_MOCK_W,
          height: LANDING_SCROLL_MOCK_H,
          transformOrigin: "center center",
          willChange: "transform, opacity",
        }}
        className="relative z-[12] mx-auto transform-gpu shrink-0"
      >
        <div className="pointer-events-none relative h-full w-full select-none overflow-hidden rounded-2xl border-2 border-[#E8E6DC] bg-[#faf9f5] shadow-[0_24px_80px_rgba(20,20,19,0.1)] ring-1 ring-[#141413]/[0.06]">
          <Image
            src={LANDING_DASHBOARD.src}
            alt="Flowly dashboard"
            fill
            className="object-contain object-top"
            sizes="(max-width: 1400px) 95vw, 1360px"
            priority={false}
            draggable={false}
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Scroll-scrubbed story: Framer Motion + transform/opacity only.
 * Optional: set NEXT_PUBLIC_LANDING_MESSY_VIDEO to scrub a video instead of live DOM.
 */
export function LandingMessyToFocusedScroll() {
  const prefersReduced = useReducedMotion();
  const trackRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fitMv = useMotionValue(1);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const p = useTransform(scrollYProgress, (v) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return Math.min(1, Math.max(0, n));
  });

  /*
   * Lock wheel to the section scrub: scrolling moves scrollY only between top and maxY.
   * Until you reach maxY (animation at p=1), downward wheel cannot advance the page past this section.
   */
  useEffect(() => {
    if (prefersReduced) return;
    const section = trackRef.current;
    if (!section) return;

    const onWheel = (e: WheelEvent) => {
      const { top, maxY, range } = getMessyScrubBounds(section);
      if (range <= 1) return;

      const y = window.scrollY;
      const dy = wheelDeltaPixels(e);
      if (Math.abs(dy) < 1e-3) return;
      const down = dy > 0;

      // Not yet at this section (still in hero / above)
      if (y + 3 < top) return;

      // Scrub complete: scrolling down hands control back so the next section can enter
      if (y >= maxY - 0.5 && down) return;

      // Section entrance: scrolling up returns to content above without fighting the scrub
      if (y <= top + 3 && !down) return;

      e.preventDefault();
      const next = Math.max(top, Math.min(maxY, y + dy));
      window.scrollTo({ top: next, behavior: "auto" });
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [prefersReduced]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth - MOCK_FIT_PAD * 2;
        const h = el.clientHeight - MOCK_FIT_PAD * 2;
        if (w <= 0) return;
        const scaleW = w / LANDING_SCROLL_MOCK_W;
        const scaleH = h > 24 ? h / LANDING_SCROLL_MOCK_H : Number.POSITIVE_INFINITY;
        fitMv.set(Math.min(1, scaleW, scaleH) * MOCK_DISPLAY_SCALE);
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitMv]);

  /* Copy tracks the visual handoff: keep scrolling only once the dashboard is nearly done. */
  const messyLineOpacity = useTransform(p, [0, 0.26, 0.38], [1, 1, 0]);
  const messySubOpacity = useTransform(p, [0, 0.24, 0.36], [1, 1, 0]);
  const focusedLineOpacity = useTransform(p, [0.34, 0.44, 0.54, 1], [0, 1, 1, 1]);
  const focusedSubOpacity = useTransform(p, [0.38, 0.5, 0.62, 1], [0, 1, 1, 1]);
  const leadDashboardOpacity = useTransform(p, [0.86, 0.94, 1], [0, 1, 1]);

  if (prefersReduced) {
    return <StaticFallback />;
  }

  const copyProps = {
    messyLineOpacity,
    messySubOpacity,
    focusedLineOpacity,
    focusedSubOpacity,
    leadDashboardOpacity,
  };

  return (
    <section
      ref={trackRef}
      className="relative mb-0 border-t border-[#e8e6dc] bg-[#faf9f5] pb-0 overscroll-y-contain"
      style={{ minHeight: MESSY_SCRUB_MIN_HEIGHT }}
      aria-labelledby="messy-scroll-heading"
    >
      {/* Out of flow so the sticky parent below can be the full track height (sticky releases when its parent ends). */}
      <h2
        id="messy-scroll-heading"
        className="sr-only absolute left-0 top-0 -z-10 m-0 h-px w-px overflow-hidden border-0 p-0"
      >
        Life was messy, now it is focused: scroll through the dashboard story
      </h2>

      <div className="pointer-events-none absolute inset-0 z-0 opacity-40 bg-[repeating-linear-gradient(-12deg,transparent,transparent_40px,rgba(20,20,19,0.035)_40px,rgba(20,20,19,0.035)_41px)] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_48%,#000_25%,transparent_72%)]" aria-hidden />

      {/* Same min-height as the section: sticky pins for the entire scrub until progress hits 1 */}
      <div className="relative z-[1]" style={{ minHeight: MESSY_SCRUB_MIN_HEIGHT }}>
        <div className="sticky top-0 z-20 min-h-[100dvh] w-full bg-[#faf9f5]">
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-40 bg-[repeating-linear-gradient(-12deg,transparent,transparent_40px,rgba(20,20,19,0.035)_40px,rgba(20,20,19,0.035)_41px)] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_48%,#000_25%,transparent_72%)]"
            aria-hidden
          />
          <div className="relative z-[1] flex min-h-[100dvh] w-full min-w-0 flex-col lg:flex-row lg:items-stretch">
            <CopyColumn {...copyProps} />
            <div
              ref={measureRef}
              className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-start overflow-x-clip px-2 pb-0 pt-2 md:px-4 lg:min-h-[100dvh] lg:justify-center lg:pt-0"
            >
              {MESSY_SCROLL_VIDEO_SRC ? (
                <div className={MOCK_NUDGE_LEFT_CLASS}>
                  <VideoScrollPanel src={MESSY_SCROLL_VIDEO_SRC} scrollProgress={p} />
                </div>
              ) : (
                <DomAnimationPanel p={p} fitMv={fitMv} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
