"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LandingAiSchedulingPipelinePreview,
  LandingExamListPreview,
  LandingFocusSessionPreview,
  LandingScheduleMonthPreview,
  LandingTodayAgendaPreview,
} from "@/components/landing/LandingAppFeaturePreviews";

const revealEase = [0.22, 1, 0.36, 1] as const;

function useReveal() {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.28, margin: "0px 0px -8% 0px" } as const,
    transition: { duration: reduce ? 0 : 0.65, ease: revealEase },
  };
}

type BlockProps = {
  kicker: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  graphic: ReactNode;
  reverse?: boolean;
};

function FeatureBlock({ kicker, title, description, href, linkLabel, graphic, reverse }: BlockProps) {
  const r = useReveal();
  return (
    <section className="border-t border-[#e8e6dc] bg-[#faf9f5] py-10 md:min-h-0 md:py-14">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-10 md:px-8">
        <motion.div {...r} className={cn(reverse && "md:order-2")}>
          <div className="pointer-events-none mx-auto w-full max-w-2xl select-none">{graphic}</div>
        </motion.div>
        <motion.div
          {...r}
          transition={{ ...r.transition, delay: 0.08 }}
          className={cn("space-y-3", reverse && "md:order-1")}
        >
          <p className="font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
            {kicker}
          </p>
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl">
            {title}
          </h2>
          <p className="max-w-lg font-[family-name:var(--font-lora)] text-base leading-relaxed text-[#6f6d66]">{description}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#d97757] transition-[transform,colors] duration-200 hover:text-[#c96b4f] active:scale-[0.99] pointer-events-auto"
          >
            {linkLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Product-accurate previews (same UI building blocks as the app) with light scroll motion.
 */
export function LandingFeatureMotionScroll() {
  return (
    <div className="relative z-[1] bg-[#faf9f5]">
      <section className="border-t border-[#e8e6dc] bg-[#faf9f5] px-4 py-8 text-center md:py-10">
        <p className="font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase tracking-[0.2em] text-[#b0aea5]">
          Built for workloads that refuse to stay still
        </p>
        <h2 className="mx-auto mt-2 max-w-2xl font-[family-name:var(--font-poppins)] text-2xl font-semibold tracking-tight text-[#141413] md:text-3xl">
          Scheduling that adapts. Exams you can feel ready for. Tasks that move your calendar.
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-lora)] text-sm leading-relaxed text-[#6f6d66] md:text-base">
          Add work, get AI breakdowns, and let{" "}
          <span className="font-medium text-[#141413]">adaptive scheduling</span> pack steps around class and free
          windows. Fall behind? Rebalance reshuffles what is left. Exams get their own layer plus a bulk planner. Paste
          syllabus text, spread prep before the date, walk in feeling ready. Focus mode keeps timer, forest, and
          motivation on one screen.
        </p>
      </section>

      <FeatureBlock
        kicker="New task, real minutes on real days"
        title="AI breaks the work down. Scheduling moves your calendar so time stops feeling like a wall."
        description="Describe the assignment. Flowly drafts micro-steps with estimates, then places them into your week around school, buffers, and the hours you said you can work. When the week changes, rebalance instead of starting over. The calendar shows where each block landed."
        href="/today"
        linkLabel="Start from Today"
        graphic={<LandingAiSchedulingPipelinePreview />}
      />
      <FeatureBlock
        kicker="Constantly changing week"
        title="Adaptive scheduling repacks when you slip. No shame spiral required."
        description="Miss a block or take a lighter day? Rebalance pulls the open steps forward and refits them into the windows you still have. The engine is built for real student weeks, not perfect robots."
        href="/today"
        linkLabel="See today after a rebalance"
        graphic={<LandingTodayAgendaPreview />}
        reverse
      />
      <FeatureBlock
        kicker="Exam planner plus syllabus"
        title="Give the syllabus. Track topics. Let AI help you feel ready before you walk in."
        description="Each exam holds dates, a topic board, and coverage you can tick off. Open Add task on the dashboard to reach the bulk exam planner. Paste syllabus text, get structured topics, and schedule prep across the days you have left. Repack when the plan drifts."
        href="/exams"
        linkLabel="Open exams and syllabus boards"
        graphic={<LandingExamListPreview />}
      />
      <FeatureBlock
        kicker="One timeline for school and study"
        title="Classes, events, and AI-placed study blocks in the same month and week views."
        description="When school and personal study live apart, you double-book yourself. Here, scheduled study sits next to what is already on your calendar so overload shows up early, not the night before."
        href="/calendar"
        linkLabel="View the merged calendar"
        graphic={<LandingScheduleMonthPreview />}
        reverse
      />
      <FeatureBlock
        kicker="Focus mode with motivation"
        title="One step, one timer, forest growth, and the nudge to stay with it."
        description="Pick the micro-step you are actually doing. Focus locks the timer to that choice, grows your forest as minutes stack, and keeps motivation visible so five minutes can turn into real progress."
        href="/focus"
        linkLabel="Start focus with motivation"
        graphic={<LandingFocusSessionPreview />}
      />
    </div>
  );
}
