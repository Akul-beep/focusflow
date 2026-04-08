"use client";

import { useReducedMotion } from "framer-motion";
import { Typewriter } from "@/components/ui/typewriter";

/** Rotating completions: answers to what do I do next */
const LINES = [
  "let adaptive scheduling repack the week when you fall behind",
  "add a task, get an AI breakdown, and watch blocks land on your calendar",
  "paste a syllabus and spread prep until you feel ready for test day",
  "open Today and run the one block worth doing right now",
  "rebalance so no single afternoon looks like a brick wall",
  "use Focus mode with timer, forest growth, and light motivation",
  "merge class and study on one timeline and catch double-books early",
] as const;

/**
 * Full-width typewriter band after the scroll story (21st / Kokonut style landing pattern).
 */
export function LandingFocusflowTypewriterBand() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <section
        className="border-y border-[#e8e6dc] bg-[#faf9f5] pb-10 pt-6 md:pb-14 md:pt-8"
        aria-labelledby="typewriter-band-heading"
      >
        <div className="container mx-auto max-w-4xl px-4 md:px-6">
          <p id="typewriter-band-heading" className="sr-only">
            How Flowly answers what to do next
          </p>
          <p className="text-center font-[family-name:var(--font-poppins)] text-xl font-semibold leading-snug text-[#141413] md:text-2xl">
            What do I do next? Adaptive scheduling, syllabus exam prep so you feel ready, task breakdowns on your calendar,
            rebalance when life happens, Focus with motivation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-y border-[#e8e6dc] bg-[#faf9f5] pb-10 pt-6 md:pb-14 md:pt-8"
      aria-labelledby="typewriter-band-heading"
    >
      <div className="container mx-auto max-w-4xl px-4 md:px-6">
        <h2 id="typewriter-band-heading" className="sr-only">
          How Flowly answers what to do next
        </h2>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="font-[family-name:var(--font-poppins)] text-2xl font-semibold tracking-tight text-[#141413] sm:text-3xl md:text-4xl">
            What do I do next?
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-lg font-medium leading-snug text-[#141413] sm:text-xl md:text-2xl md:leading-tight">
            <span className="text-[#b0aea5]">You can </span>
            <Typewriter
              text={[...LINES]}
              speed={38}
              waitTime={2400}
              deleteSpeed={26}
              loop
              initialDelay={600}
              className="font-semibold text-[#d97757]"
              cursorChar="_"
              cursorClassName="ml-1 inline-block min-w-[0.6ch] text-[#6a9bcc] font-normal"
            />
          </p>
        </div>
      </div>
    </section>
  );
}
