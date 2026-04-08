import type { ReactNode } from "react";
import { DashboardScreenMock } from "@/components/landing/DashboardScreenMock";
import { ExamDetailScreenMock } from "@/components/landing/mocks/ExamDetailScreenMock";
import { ExamsListScreenMock } from "@/components/landing/mocks/ExamsListScreenMock";
import { FocusModeScreenMock } from "@/components/landing/mocks/FocusModeScreenMock";
import { TodayScreenMock } from "@/components/landing/mocks/TodayScreenMock";

function ScrollMockFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] shadow-[0_24px_80px_rgba(20,20,19,0.1)] [scrollbar-width:thin]">
      <div className="inline-block min-w-min">{children}</div>
    </div>
  );
}

function SectionIntro({
  id,
  kicker,
  title,
  body,
  dark,
}: {
  id?: string;
  kicker: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center md:mx-0 md:max-w-lg md:text-left">
      <p className="mb-3 font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase tracking-[0.2em] text-[#d97757]">
        {kicker}
      </p>
      <h2
        id={id}
        className={`font-[family-name:var(--font-poppins)] text-2xl font-semibold tracking-tight md:text-3xl ${dark ? "text-white" : "text-[#141413]"}`}
      >
        {title}
      </h2>
      <p className={`mt-4 text-base leading-relaxed md:text-[17px] ${dark ? "text-[#b0aea5]" : "text-[#6f6d66]"}`}>
        {body}
      </p>
    </div>
  );
}

/**
 * Static product showcase using existing screen mocks (scroll horizontally on narrow viewports).
 */
export function LandingStaticShowcase() {
  return (
    <div className="bg-[#faf9f5]">
      <section className="border-t border-[#e8e6dc] py-16 md:py-24" aria-labelledby="showcase-dashboard-heading">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <SectionIntro
            id="showcase-dashboard-heading"
            kicker="Dashboard"
            title="Everything on one timeline you already understand"
            body="Tasks, filters, forest, and motivation use the same chrome as the live app. Not a fake marketing skin."
          />
          <div className="mt-10 md:mt-12">
            <ScrollMockFrame>
              <DashboardScreenMock />
            </ScrollMockFrame>
          </div>
        </div>
      </section>

      <section
        className="border-t border-[#e8e6dc] bg-[#141413] py-16 text-white md:py-24"
        aria-labelledby="showcase-focus-heading"
      >
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionIntro
                id="showcase-focus-heading"
                kicker="Focus"
                title="One tap into timer, forest, and streaks"
                body="Pick a step and focus without leaving the flow. When you pause, your queue still makes sense."
                dark
              />
            </div>
            <div className="lg:col-span-7">
              <ScrollMockFrame>
                <FocusModeScreenMock />
              </ScrollMockFrame>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e8e6dc] py-16 md:py-24" aria-labelledby="showcase-exams-heading">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <SectionIntro
            id="showcase-exams-heading"
            kicker="Exams"
            title="Papers, syllabi, and countdowns in one place"
            body="List and detail views mirror what you use when revising: coverage, filters, and the same topic rows."
          />
          <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-6 md:mt-12">
            <ScrollMockFrame>
              <ExamsListScreenMock />
            </ScrollMockFrame>
            <ScrollMockFrame>
              <ExamDetailScreenMock />
            </ScrollMockFrame>
          </div>
        </div>
      </section>

      <section
        className="border-t border-[#e8e6dc] bg-white py-16 md:py-24"
        aria-labelledby="showcase-today-heading"
      >
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="order-2 lg:order-1 lg:col-span-7">
              <ScrollMockFrame>
                <TodayScreenMock />
              </ScrollMockFrame>
            </div>
            <div className="order-1 lg:order-2 lg:col-span-5">
              <SectionIntro
                id="showcase-today-heading"
                kicker="Today"
                title="What the calendar actually assigned you"
                body="Ordered steps, honest times, and shortcuts into Focus. Replanning stays one tap away when the week shifts."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
