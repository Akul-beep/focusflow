import Link from "next/link";
import { ArrowRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type LandingStaticHeroProps = {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
};

/**
 * Static hero (no motion library). Palette matches :root tokens (cream / ink / terracotta).
 */
export function LandingStaticHero({
  badge = "When your week moves, your plan catches up",
  title1 = "What do I do next?",
  title2 = "Today tells you.",
  description = "Adaptive AI for weeks that never sit still. Slip? Rebalance repacks your calendar. Add a task, get AI steps dropped into real time blocks. Paste your syllabus, spread exam prep, walk in feeling ready. Focus mode keeps timer, forest, and motivation in one place.",
}: LandingStaticHeroProps) {
  return (
    <header className="relative overflow-x-clip bg-[#faf9f5] pb-16 pt-14 md:pb-24 md:pt-20">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#d97757]/[0.12] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full bg-[#6a9bcc]/[0.14] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-96 rounded-full bg-[#788c5d]/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto max-w-3xl px-4 text-center md:px-6">
        <div
          className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-full border border-[#e8e6dc] bg-white/90 px-3 py-1.5 shadow-sm md:mb-8"
          )}
        >
          <Circle className="h-2 w-2 fill-[#d97757] text-[#d97757]" aria-hidden />
          <span className="font-[family-name:var(--font-poppins)] text-sm font-medium tracking-wide text-[#6f6d66]">
            {badge}
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-poppins)] text-4xl font-bold tracking-tight text-[#141413] sm:text-5xl md:text-6xl md:leading-[1.08]">
          {title1}
          <br />
          <span className="bg-gradient-to-r from-[#c96b4f] via-[#d97757] to-[#6a9bcc] bg-clip-text text-transparent">
            {title2}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl font-[family-name:var(--font-lora)] text-base leading-relaxed text-[#6f6d66] md:mt-8 md:text-lg">
          {description}
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4 md:mt-10">
          <Link
            href="/today"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d97757] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(217,119,87,0.35)] transition-colors hover:bg-[#c96b4f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97757]"
          >
            See my next steps
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
          <Link
            href="/focus"
            className="inline-flex items-center justify-center rounded-full border border-[#e8e6dc] bg-white px-7 py-3.5 text-sm font-semibold text-[#141413] shadow-sm transition-colors hover:border-[#d97757]/40 hover:bg-[#faf9f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97757]"
          >
            Run one focus block
          </Link>
        </div>
      </div>
    </header>
  );
}
