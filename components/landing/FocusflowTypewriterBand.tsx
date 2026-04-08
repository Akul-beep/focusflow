"use client";

import { Typewriter } from "@/components/ui/typewriter";

const LINES = [
  "turn big deadlines into steps you can start today",
  "open a focus block without bargaining with yourself",
  "keep papers, orals, and revision on one honest list",
  "grow your forest for showing up, not for being perfect",
];

export function FocusflowTypewriterBand() {
  return (
    <section
      className="relative border-y border-[#e8e6dc] bg-white py-12 md:py-14"
      aria-label="What Flowly helps you do"
    >
      <div className="container mx-auto max-w-4xl px-4 text-center md:px-6">
        <p className="font-[family-name:var(--font-poppins)] text-2xl font-medium leading-snug text-[#141413] sm:text-3xl md:text-4xl md:leading-tight">
          <span className="text-[#b0aea5]">Flowly is where you </span>
          <Typewriter
            text={LINES}
            speed={42}
            waitTime={2200}
            deleteSpeed={28}
            loop
            initialDelay={400}
            className="font-semibold text-[#d97757]"
            cursorChar="_"
            cursorClassName="ml-1 text-[#6a9bcc] font-normal"
          />
        </p>
      </div>
    </section>
  );
}
