import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ShapeLandingHero } from "@/components/ui/shape-landing-hero";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFeatureMotionScroll } from "@/components/landing/LandingFeatureMotionScroll";
import { LandingFocusflowTypewriterBand } from "@/components/landing/LandingFocusflowTypewriterBand";
import { LandingMessyToFocusedScroll } from "@/components/landing/LandingMessyToFocusedScroll";

/**
 * Marketing landing. Used at `/` and (optionally) `/landing`.
 */
export default function LandingPageContent() {
  return (
    <main className="landing-scale-reset min-h-screen bg-[#faf9f5] text-[#141413]">
      <ShapeLandingHero
        badge="When your week moves, your plan catches up"
        title1="What do I do next?"
        title2="Today tells you."
        description="Adaptive AI for weeks that never sit still. Slip? Rebalance repacks your calendar. Add a task, get AI steps dropped into real time blocks. Paste your syllabus, spread exam prep, walk in feeling ready. Focus mode keeps timer, forest, and motivation in one place."
      >
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d97757] px-7 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(217,119,87,0.35)] transition-[transform,colors] duration-200 hover:bg-[#c96b4f] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97757]"
        >
          Start free
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-full border border-[#faf9f5]/25 bg-[#faf9f5]/[0.06] px-7 py-3 text-sm font-semibold text-[#faf9f5]/90 backdrop-blur-sm transition-[transform,colors,border-color,background-color] duration-200 hover:border-[#faf9f5]/40 hover:bg-[#faf9f5]/10 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#faf9f5]/60"
        >
          Sign in
        </Link>
      </ShapeLandingHero>

      <LandingFocusflowTypewriterBand />

      <LandingMessyToFocusedScroll />

      {/* Pull up 1px so no subpixel seam between the scroll story and features */}
      <div className="relative -mt-px bg-[#faf9f5]">
        <LandingFeatureMotionScroll />
        <LandingFaq />
      </div>

      <section className="border-t border-[#e8e6dc] bg-white py-16 md:py-20">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4 text-center md:px-6">
          <p className="max-w-xl font-[family-name:var(--font-lora)] text-lg text-[#141413] md:text-xl">
            Syllabus to schedule, tasks to blocks, rebalance when life hits. Local until you turn sync on.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#141413] px-8 py-3.5 text-sm font-semibold text-[#faf9f5] transition-[transform,colors] duration-200 hover:bg-[#2a2a28] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141413]"
            >
              Get started free
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
            <p className="text-sm text-[#6f6d66]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#d97757] underline-offset-4 transition hover:text-[#c96b4f] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
