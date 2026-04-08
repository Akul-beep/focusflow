"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    q: "What is Flowly?",
    a: "A student planner with AI adaptive scheduling: tasks, calendar, exams, syllabus-style topic boards, focus sessions with forest growth, and rebalance when the week shifts. Built to support school, not become a second job.",
  },
  {
    q: "What does rebalance do?",
    a: "When you fall behind or your availability changes, rebalance reshuffles open micro-steps into your remaining work windows and buffers. Your calendar updates to match reality without you rebuilding every task by hand.",
  },
  {
    q: "How does exam prep with a syllabus work?",
    a: "Add exams on the Exams page with topics you care about. For a full syllabus dump, open Add task on the dashboard and use the bulk exam planner. Paste syllabus text, review extracted topics, and schedule prep blocks across the days before the test so you feel ready, not rushed. You can repack from the exam detail when plans drift.",
  },
  {
    q: "Does it work offline?",
    a: "Core planning and focus work on your device. Sync uses your account only when you connect. Nothing leaves the device until you opt in.",
  },
  {
    q: "Is it only for one program or country?",
    a: "No. It fits any term where you mix classes, deadlines, and long projects. Heavier courses get more out of it.",
  },
  {
    q: "How does the AI help with normal homework?",
    a: "You describe an assignment in your own words. Flowly suggests subtasks and times you can edit, then adaptive scheduling tries to place those blocks on your calendar. It is a draft to start from, not a substitute for rubrics or teacher feedback.",
  },
  {
    q: "Is my data private?",
    a: "Local-first by default. We do not sell your data. Sync uses normal sign-in when you turn it on. Settings shows what lives where.",
  },
  {
    q: "Does it cost money?",
    a: "Core use is free without a subscription. If paid options appear later, they will be extras. Your basic list and planning stay usable.",
  },
] as const;

export function LandingFaq() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      className="border-t border-[#e8e6dc] bg-white py-16 md:py-24"
      aria-labelledby="landing-faq-heading"
    >
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        <p className="text-center font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
          FAQ
        </p>
        <h2
          id="landing-faq-heading"
          className="mt-3 text-center font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight text-[#141413] md:text-4xl"
        >
          Still deciding?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-[#6f6d66] md:text-base">
          The questions people ask before they commit to one more school app.
        </p>

        <ul className="mt-10 space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="overflow-hidden rounded-xl border border-[#e8e6dc] bg-[#faf9f5]/50">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-[#faf9f5]"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                >
                  <span className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-[#141413] md:text-[15px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-[#b0aea5] transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      initial={{ height: 0, opacity: reduce ? 1 : 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: reduce ? 1 : 0 }}
                      transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-[#e8e6dc]/80 px-4 pb-4 pt-3 font-[family-name:var(--font-lora)] text-sm leading-relaxed text-[#6f6d66]">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
