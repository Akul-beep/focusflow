import { Clock, Sparkles, Timer } from "lucide-react";
import PageHeader, { PAGE_MAIN_CLASSES } from "@/components/PageHeader";

const STEPS = [
  {
    subject: "Physics HL",
    task: "Past paper · Section A",
    step: "Timed attempt, 45m",
    minutes: 45,
    done: false,
    time: "4:30 PM",
  },
  {
    subject: "English",
    task: "IO outline",
    step: "Global issue bullets",
    minutes: 25,
    done: false,
    time: "6:00 PM",
  },
  {
    subject: "Math AA",
    task: "Review set",
    step: "Mixed questions 1 to 8",
    minutes: 35,
    done: true,
    time: "Done",
  },
] as const;

function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-[#E8E6DC] bg-white md:flex lg:w-60">
      <div className="border-b border-[#E8E6DC] p-3">
        <h1 className="font-heading text-base font-bold text-[#141413]">Flowly</h1>
        <p className="text-[10px] text-[#B0AEA5]">Task Management</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        <div className="rounded-lg px-2.5 py-2 font-heading text-sm font-medium text-[#141413]">Dashboard</div>
        <div className="rounded-lg bg-[#D97757] px-2.5 py-2 font-heading text-sm font-medium text-white shadow-sm">
          Today
        </div>
        <div className="rounded-lg px-2.5 py-2 font-heading text-sm font-medium text-[#141413]">Focus</div>
      </nav>
    </aside>
  );
}

export function TodayScreenMock() {
  return (
    <div className="flex h-[600px] w-[1040px] shrink-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] shadow-[0_24px_80px_rgba(20,20,19,0.1)]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Today"
          subtitle={
            <span className="text-[#6f6d66]">
              Your scheduled steps for this calendar day, with recovery tools when the week slips.
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E8E6DC] bg-white px-3 font-heading text-xs font-medium text-[#141413]">
                <Sparkles className="h-4 w-4 text-[#D97757]" aria-hidden />
                Replan week
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#D97757] px-4 font-heading text-sm font-semibold text-white">
                <Timer className="h-4 w-4" aria-hidden />
                Start next step
              </div>
            </div>
          }
        />
        <main className={`${PAGE_MAIN_CLASSES} space-y-3`}>
          {STEPS.map((s) => (
            <div
              key={s.step}
              className={`flex flex-col gap-3 rounded-2xl border border-[#E8E6DC] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                s.done ? "opacity-70" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[#E8E6DC] bg-[#FAF9F5] px-2 py-0.5 font-heading text-[11px] font-medium text-[#141413]">
                    {s.subject}
                  </span>
                  <span className="font-heading text-xs text-[#B0AEA5]">{s.task}</span>
                </div>
                <p className="font-heading text-base font-semibold text-[#141413]">{s.step}</p>
                <p className="mt-1 flex items-center gap-1.5 font-heading text-xs text-[#B0AEA5]">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {s.minutes} min block
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-2 font-heading text-sm font-semibold tabular-nums text-[#141413]">
                  {s.time}
                </span>
                {s.done ? (
                  <span className="font-heading text-xs font-semibold text-[#788C5D]">Complete</span>
                ) : (
                  <span className="rounded-lg bg-[#141413] px-4 py-2 font-heading text-xs font-semibold text-white">
                    Focus
                  </span>
                )}
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
