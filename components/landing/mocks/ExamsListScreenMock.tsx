import { BookMarked, CalendarDays, ChevronRight } from "lucide-react";
import PageHeader, { PAGE_MAIN_CLASSES } from "@/components/PageHeader";

function MiniSidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-[#E8E6DC] bg-white md:flex lg:w-60">
      <div className="border-b border-[#E8E6DC] p-3">
        <h1 className="font-heading text-base font-bold text-[#141413]">Flowly</h1>
        <p className="text-[10px] text-[#B0AEA5]">Task Management</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        <div className="rounded-lg px-2.5 py-2 font-heading text-sm font-medium text-[#141413]">
          Dashboard
        </div>
        <div className="rounded-lg bg-[#D97757] px-2.5 py-2 font-heading text-sm font-medium text-white shadow-sm">
          Exams
        </div>
      </nav>
    </aside>
  );
}

const ROWS = [
  {
    badge: "12d left",
    badgeClass: "bg-[#FAF9F5] text-[#141413] border border-[#E8E6DC]",
    subject: "Group 4",
    name: "Physics HL Paper 2",
    date: "Wednesday, Apr 17, 2026",
  },
  {
    badge: "Today",
    badgeClass: "bg-[#D97757]/15 text-[#b35a40]",
    subject: "Group 1",
    name: "English IO",
    date: "Saturday, Apr 5, 2026",
  },
] as const;

/**
 * Exams list screen (two rows) matching ExamsListPage layout.
 */
export function ExamsListScreenMock() {
  return (
    <div className="flex h-[620px] w-[1040px] shrink-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-[#FAF9F5] shadow-[0_24px_80px_rgba(20,20,19,0.1)]">
      <MiniSidebar />
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Exams"
          subtitle="Plans, syllabi, and countdowns in one place"
          actions={
            <div className="h-10 w-full rounded-lg bg-[#141413] px-4 font-heading text-sm font-medium leading-10 text-white sm:w-auto">
              New exam plan
            </div>
          }
        />
        <main className={`${PAGE_MAIN_CLASSES} space-y-3`}>
          <ul className="grid grid-cols-1 gap-3">
            {ROWS.map((exam) => (
              <li key={exam.name}>
                <div className="group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-[#E8E6DC] bg-white shadow-sm">
                  <div
                    className="w-1.5 shrink-0 bg-gradient-to-b from-[#D97757] to-[#6A9BCC]"
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E8E6DC] bg-[#FAF9F5]">
                      <CalendarDays className="h-6 w-6 text-[#D97757]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2 gap-y-1">
                        <span
                          className={`rounded-md px-2 py-0.5 font-heading text-[11px] font-semibold uppercase tracking-wide ${exam.badgeClass}`}
                        >
                          {exam.badge}
                        </span>
                        <span className="truncate font-heading text-xs text-[#B0AEA5]">{exam.subject}</span>
                      </div>
                      <p className="truncate font-heading text-lg font-bold leading-tight text-[#141413]">
                        {exam.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#B0AEA5]">
                        <span className="tabular-nums">{exam.date}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#B0AEA5]" aria-hidden />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-dashed border-[#E8E6DC] bg-white/60 p-4 text-center">
            <BookMarked className="mx-auto mb-2 h-6 w-6 text-[#6A9BCC]" aria-hidden />
            <p className="font-heading text-xs text-[#B0AEA5]">
              Each exam opens a syllabus board, coverage ring, and repack tools.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
