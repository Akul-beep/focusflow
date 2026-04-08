import { CheckCircle2, Circle, ListChecks, Star } from "lucide-react";
import PageHeader, { PAGE_MAIN_CLASSES } from "@/components/PageHeader";

const TOPICS = [
  { topic: "Topic 1: Measurements & uncertainties", done: true, flagged: false, n: 1 },
  { topic: "Topic 2: Mechanics", done: true, flagged: false, n: 2 },
  { topic: "Topic 3: Thermal", done: false, flagged: true, n: 3 },
  { topic: "Topic 4: Waves", done: false, flagged: false, n: 4 },
] as const;

function MiniSidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-[#E8E6DC] bg-white md:flex lg:w-60">
      <div className="border-b border-[#E8E6DC] p-3">
        <h1 className="font-heading text-base font-bold text-[#141413]">Flowly</h1>
        <p className="text-[10px] text-[#B0AEA5]">Task Management</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        <div className="rounded-lg px-2.5 py-2 font-heading text-sm font-medium text-[#141413]">Dashboard</div>
        <div className="rounded-lg bg-[#D97757] px-2.5 py-2 font-heading text-sm font-medium text-white shadow-sm">
          Exams
        </div>
      </nav>
    </aside>
  );
}

/**
 * Cropped exam detail: countdown, coverage ring, syllabus header + topic grid.
 */
export function ExamDetailScreenMock() {
  const pct = 48;
  const covered = 7;
  const total = 15;

  return (
    <div className="flex h-[700px] w-[1120px] shrink-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] shadow-[0_24px_80px_rgba(20,20,19,0.1)]">
      <MiniSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <PageHeader
          lead={
            <span className="inline-block font-heading text-sm text-[#B0AEA5]">← All exams</span>
          }
          title="Physics HL Paper 2"
          subtitle="Group 4"
        >
          <p className="font-heading text-3xl font-bold text-[#D97757]">
            12<span className="ml-2 text-base font-medium text-[#B0AEA5]">days to go</span>
          </p>
          <span className="mt-3 inline-block rounded-full bg-[#6A9BCC]/15 px-3 py-1 font-heading text-xs text-[#6A9BCC]">
            On track
          </span>
        </PageHeader>

        <main className={`${PAGE_MAIN_CLASSES} space-y-5 pb-6`}>
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-[#E8E6DC] bg-white p-5 shadow-sm">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#E8E6DC]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  strokeDasharray={`${pct}, 100`}
                  className="text-[#141413]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-heading font-semibold text-[#141413]">
                {covered}/{total}
              </div>
            </div>
            <div>
              <p className="font-heading text-sm text-[#B0AEA5]">Topics covered</p>
              <p className="font-heading font-semibold text-[#141413]">{pct}%</p>
            </div>
            <div className="min-w-[200px] flex-1 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] p-4">
              <h2 className="mb-1 font-heading text-sm font-semibold text-[#141413]">Calendar</h2>
              <p className="mb-3 text-xs text-[#B0AEA5]">
                Repack open prep sessions when your week shifts.
              </p>
              <div className="rounded-lg bg-[#141413] px-4 py-2 text-center font-heading text-xs font-medium text-white">
                Repack exam schedule
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-[#E8E6DC] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D97757]/10 text-[#D97757]">
                  <ListChecks className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-semibold text-[#141413]">Syllabus</h2>
                  <p className="mt-0.5 text-sm text-[#B0AEA5]">
                    Tap to mark covered. Star to flag for review.
                  </p>
                  <p className="mt-2 font-heading text-xs text-[#D97757]">1 flagged for review</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-0.5 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] p-1">
                {(["All", "Not covered", "Covered", "Flagged"] as const).map((label, i) => (
                  <div
                    key={label}
                    className={`rounded-lg px-3 py-1.5 font-heading text-xs font-medium ${
                      i === 0
                        ? "border border-[#E8E6DC] bg-white text-[#141413] shadow-sm"
                        : "text-[#B0AEA5]"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs font-heading text-[#B0AEA5]">
              <span>Progress</span>
              <span className="text-[#141413]">
                {covered} / {total} covered
              </span>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#E8E6DC]">
              <div className="h-full w-[48%] rounded-full bg-[#788C5D]" />
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {TOPICS.map((row) => (
                <li key={row.n}>
                  <div
                    className={`flex overflow-hidden rounded-2xl border ${
                      row.done
                        ? "border-[#788C5D]/35 bg-gradient-to-br from-[#788C5D]/[0.08] to-white shadow-sm"
                        : "border-[#E8E6DC] bg-white"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 gap-3 p-4">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                          row.done
                            ? "border-[#788C5D] bg-[#788C5D]/15 text-[#5A7A4E]"
                            : "border-[#E8E6DC] bg-[#FAF9F5] text-[#B0AEA5]"
                        }`}
                        aria-hidden
                      >
                        {row.done ? (
                          <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                        ) : (
                          <Circle className="h-5 w-5" strokeWidth={1.75} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`line-clamp-3 font-heading text-sm font-medium leading-snug ${
                              row.done ? "text-[#5A7A4E]" : "text-[#141413]"
                            }`}
                          >
                            {row.topic}
                          </p>
                          <span className="shrink-0 rounded-md border border-[#E8E6DC] bg-[#FAF9F5] px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wide text-[#B0AEA5]">
                            #{row.n}
                          </span>
                        </div>
                        {!row.done ? (
                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-heading text-[#D97757]">
                            <Star className="h-3 w-3 fill-current" aria-hidden />
                            Flag for review
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
