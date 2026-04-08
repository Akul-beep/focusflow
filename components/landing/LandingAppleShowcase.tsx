"use client";

import { LandingScrollExamStory } from "@/components/landing/LandingScrollExamStory";
import { LandingScrollJourney } from "@/components/landing/LandingScrollJourney";
import { LandingScrollTodayStory } from "@/components/landing/LandingScrollTodayStory";

/**
 * Apple-style scroll narrative: chaos → dashboard → focus, then exam and Today chapters.
 */
export function LandingAppleShowcase() {
  return (
    <div className="relative">
      <LandingScrollJourney />
      <LandingScrollExamStory />
      <LandingScrollTodayStory />
    </div>
  );
}
