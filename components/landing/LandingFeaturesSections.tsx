"use client";

import { Brain, CalendarDays, Pencil, Shield, Sparkles, Timer } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { FeatureCard } from "@/components/ui/grid-feature-cards";

const GRID_FEATURES = [
  {
    title: "Week at a glance",
    icon: CalendarDays,
    description: "Classes, deadlines, and tasks share one timeline so nothing important hides in a tab you forgot.",
    patternKey: "week",
  },
  {
    title: "Deep focus",
    icon: Timer,
    description: "Start a session in one tap. Timer, forest, and streaks live on the same screen as the real app.",
    patternKey: "focus",
  },
  {
    title: "AI that drafts steps",
    icon: Sparkles,
    description: "Describe a messy assignment in plain language and get subtasks you can tick off instead of stalling.",
    patternKey: "ai",
  },
  {
    title: "Exams & syllabi",
    icon: Brain,
    description: "Coverage, papers, and countdowns stay tied together so revision matches what you actually owe.",
    patternKey: "exams",
  },
  {
    title: "Your wording, your plan",
    icon: Pencil,
    description: "Rename, split, and reprioritize without fighting a rigid template. It stays your semester.",
    patternKey: "custom",
  },
  {
    title: "Privacy-first",
    icon: Shield,
    description: "Your week stays on this device until you choose to sync. No surprise uploads.",
    patternKey: "privacy",
  },
] as const;

type AnimatedBlockProps = {
  delay?: number;
  className?: string;
  children: React.ReactNode;
};

function AnimatedBlock({ className, delay = 0.1, children }: AnimatedBlockProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 1, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05, margin: "0px 0px -10% 0px" }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Grid feature cards only (mockup section removed). */
export function LandingFeaturesSections() {
  return (
    <section className="border-t border-[#e8e6dc] bg-[#faf9f5] py-16 md:py-28" aria-labelledby="grid-features-heading">
      <div className="mx-auto w-full max-w-5xl space-y-10 px-4 md:space-y-12">
        <AnimatedBlock className="mx-auto max-w-3xl text-center">
          <p className="font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
            Built for IB weeks
          </p>
          <h2
            id="grid-features-heading"
            className="mt-3 text-balance font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl lg:text-[2.75rem] lg:leading-tight"
          >
            Power over your week. Calm in your head.
          </h2>
          <p className="mt-4 text-balance text-sm leading-relaxed tracking-wide text-[#b0aea5] md:text-base">
            Everything you need to plan, focus, and revise without juggling five different apps.
          </p>
        </AnimatedBlock>

        <AnimatedBlock
          delay={0.25}
          className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-dashed border-[#e8e6dc] bg-[#e8e6dc] p-px sm:grid-cols-2 md:grid-cols-3"
        >
          {GRID_FEATURES.map((feature) => (
            <FeatureCard key={feature.patternKey} feature={feature} patternKey={feature.patternKey} />
          ))}
        </AnimatedBlock>
      </div>
    </section>
  );
}
