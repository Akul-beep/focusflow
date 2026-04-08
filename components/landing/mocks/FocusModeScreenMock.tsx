import { ArrowLeft, Clock, List, NotebookPen, Pause, Sparkles, Square, TreePine } from "lucide-react";

const R = 132;
const CIRC = 2 * Math.PI * R;
const progress = 0.38;
const strokeDashoffset = CIRC * (1 - progress);

/**
 * Static replica of Focus mode (timer running, one step) for landing motion.
 */
export function FocusModeScreenMock() {
  return (
    <div className="h-[780px] w-[800px] shrink-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] shadow-[0_24px_80px_rgba(20,20,19,0.12)]">
      <header className="sticky top-0 z-10 border-b border-[#E8E6DC] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 shrink items-center gap-1">
            <div className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 font-heading text-xs font-medium text-[#141413] sm:inline-flex">
              Today
            </div>
            <div className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-2 font-heading text-xs font-medium text-[#141413] sm:text-sm">
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Home</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 px-1 text-center">
            <h1 className="font-heading text-lg font-bold text-[#141413] sm:text-xl">Focus</h1>
            <p className="text-[10px] leading-tight text-[#B0AEA5] sm:text-xs">
              Timer saves to your forest & streak
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 font-heading text-xs font-medium text-[#141413] sm:text-sm">
            <List className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Change step</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-7 py-9">
        <div className="mb-6 rounded-xl border border-[#E8E6DC] bg-white p-5">
          <p className="mb-1 font-heading text-xs text-[#B0AEA5]">Current task</p>
          <h2 className="mb-2 font-heading text-lg font-semibold text-[#141413]">
            HL Physics: past paper walkthrough
          </h2>
          <div className="mb-3 flex items-center gap-4 text-xs text-[#B0AEA5]">
            <span>Step 2 of 4</span>
            <span>•</span>
            <span>Progress 38%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E6DC]">
            <div className="h-full w-[38%] rounded-full bg-[#D97757]" />
          </div>
        </div>

        <div className="rounded-xl border border-[#E8E6DC] bg-white p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="relative mb-8 h-[280px] w-[280px]">
              <svg className="h-[280px] w-[280px] -rotate-90 transform" viewBox="0 0 280 280">
                <circle cx="140" cy="140" r={R} fill="none" stroke="#E8E6DC" strokeWidth="11" />
                <circle
                  cx="140"
                  cy="140"
                  r={R}
                  fill="none"
                  stroke="#141413"
                  strokeWidth="11"
                  strokeDasharray={CIRC}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="mb-1 font-heading text-7xl font-bold text-[#141413]">15:24</span>
                <span className="font-heading text-xs text-[#B0AEA5]">Focus session</span>
              </div>
            </div>

            <div className="mb-8 w-full max-w-xl text-center">
              <p className="mb-2 font-heading text-xs uppercase tracking-wide text-[#B0AEA5]">
                Current step
              </p>
              <p className="mb-2 font-heading text-lg font-semibold text-[#141413]">
                Section A · timed attempt
              </p>
              <p className="mb-4 text-sm text-[#B0AEA5]">45 minutes, no notes, then compare to markscheme.</p>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-1.5">
                <Clock className="h-4 w-4 text-[#D97757]" aria-hidden />
                <span className="font-heading text-xs text-[#141413]">~45 minutes</span>
              </div>
              <button
                type="button"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E8E6DC] bg-white px-4 py-2.5 font-heading text-sm font-semibold text-[#141413]"
              >
                <List className="h-4 w-4 text-[#6A9BCC]" aria-hidden />
                Change step
              </button>
            </div>

            <div className="mb-8 w-full max-w-xl">
              <div className="rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] p-4 text-center">
                <div className="border-l-4 border-[#D97757] pl-4 text-left">
                  <p className="font-body text-sm italic leading-relaxed text-[#141413]">
                    Halfway through. Stay with the step you chose.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-2 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#141413] bg-[#141413] px-4 py-3 text-white shadow-lg">
                <NotebookPen className="h-4 w-4" aria-hidden />
                <span className="pr-1 font-heading text-sm">Note</span>
              </div>
            </div>

            <div className="mb-8 w-full max-w-sm">
              <div className="rounded-lg border border-[#E8E6DC] bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#788C5D]/15 to-[#6A9BCC]/15">
                    <TreePine className="h-4 w-4 text-[#788C5D]" aria-hidden />
                  </div>
                  <h3 className="font-heading text-sm font-medium text-[#141413]">Growth forest</h3>
                </div>
                <div className="relative mb-3 h-24 overflow-hidden rounded-lg border border-[#E8E6DC] bg-gradient-to-b from-[#FAF9F5] to-[#E8E6DC]">
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#788C5D]/30 to-transparent" />
                </div>
                <div className="flex items-center justify-between text-xs font-heading text-[#141413]">
                  <span>Trees planted</span>
                  <span className="font-semibold">3</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-6 py-3 font-heading font-medium text-white"
              >
                <Pause className="h-5 w-5" aria-hidden />
                Pause
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-[#E8E6DC] bg-white px-6 py-3 font-heading font-medium text-[#141413]"
              >
                <Square className="h-4 w-4 fill-current" aria-hidden />
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8E6DC] bg-white px-3 py-1.5 font-heading text-[10px] text-[#6f6d66]">
            <Sparkles className="h-3.5 w-3.5 text-[#D97757]" aria-hidden />
            Session feeds FocusCoins & your streak
          </div>
        </div>
      </main>
    </div>
  );
}
