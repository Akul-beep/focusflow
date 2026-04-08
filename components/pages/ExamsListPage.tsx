'use client';

import { useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import { differenceInCalendarDays, format } from 'date-fns';
import AddTaskModal from '@/components/AddTaskModal';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import { BookMarked, CalendarDays, ChevronRight, Trash2 } from 'lucide-react';

export default function ExamsListPage() {
  const { exams, deleteExam } = useStore();
  const [showPlanner, setShowPlanner] = useState(false);
  const today = new Date();

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          title="Exams"
          subtitle="Plans, syllabi, and countdowns in one place"
          actions={
            <button
              type="button"
              onClick={() => setShowPlanner(true)}
              className="h-10 px-4 rounded-lg bg-[#141413] text-white font-heading font-medium hover:bg-[#2a2a28] transition-colors w-full sm:w-auto"
            >
              New exam plan
            </button>
          }
        />
        <main className={`${PAGE_MAIN_CLASSES} space-y-4`}>
          {exams.length === 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-[#E8E6DC] bg-white p-8 shadow-sm">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#D97757]/10" aria-hidden />
              <div className="relative flex flex-col sm:flex-row sm:items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#6A9BCC]/12 flex items-center justify-center shrink-0">
                  <BookMarked className="w-7 h-7 text-[#6A9BCC]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading font-bold text-lg text-[#141413] mb-2">No exams yet</h2>
                  <p className="text-sm text-[#B0AEA5] leading-relaxed mb-6 max-w-lg">
                    Create a plan to attach subjects, topics, and automatic scheduling — then open each exam from this
                    list anytime.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPlanner(true)}
                    className="h-11 px-5 rounded-xl bg-[#141413] text-white font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                  >
                    Create exam plan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:gap-4">
              {exams.map((exam) => {
                const daysLeft = differenceInCalendarDays(new Date(exam.examDate), today);
                const badge =
                  daysLeft < 0
                    ? { label: 'Past', className: 'bg-[#E8E6DC] text-[#6f6d66]' }
                    : daysLeft === 0
                      ? { label: 'Today', className: 'bg-[#D97757]/15 text-[#b35a40]' }
                      : daysLeft <= 7
                        ? { label: `${daysLeft}d left`, className: 'bg-amber-50 text-amber-900 border border-amber-200/80' }
                        : { label: `${daysLeft} days`, className: 'bg-[#FAF9F5] text-[#141413] border border-[#E8E6DC]' };

                return (
                  <li key={exam.id}>
                    <div className="relative">
                    <Link
                      href={`/exams/${encodeURIComponent(exam.id)}`}
                      className="group flex items-stretch gap-0 rounded-2xl border border-[#E8E6DC] bg-white shadow-sm transition-all hover:border-[#D97757]/35 hover:shadow-md overflow-hidden"
                    >
                      <div className="w-1.5 shrink-0 bg-gradient-to-b from-[#D97757] to-[#6A9BCC]" aria-hidden />
                      <div className="flex flex-1 min-w-0 items-center gap-4 p-4 sm:p-5">
                        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#E8E6DC] flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                          <CalendarDays className="w-6 h-6 text-[#D97757]" aria-hidden />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-1">
                            <span
                              className={`text-[11px] font-heading font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-xs text-[#B0AEA5] font-heading truncate">{exam.subject}</span>
                          </div>
                          <p className="font-heading font-bold text-[#141413] text-lg leading-tight truncate group-hover:text-[#D97757] transition-colors">
                            {exam.name}
                          </p>
                          <p className="text-sm text-[#B0AEA5] mt-1 flex items-center gap-1.5">
                            <span className="tabular-nums">{format(new Date(exam.examDate), 'EEEE, MMM d, yyyy')}</span>
                          </p>
                        </div>
                        <ChevronRight
                          className="w-5 h-5 text-[#B0AEA5] shrink-0 group-hover:text-[#D97757] transition-colors"
                          aria-hidden
                        />
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${exam.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Delete exam syllabus "${exam.name}"?`)) deleteExam(exam.id);
                      }}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E6DC] bg-white/95 text-[#B0AEA5] hover:text-[#D97757] hover:border-[#D97757]/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
      <AddTaskModal
        isOpen={showPlanner}
        onClose={() => setShowPlanner(false)}
        initialMode="exam"
        lockMode
      />
    </div>
  );
}
