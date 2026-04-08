'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { useMemo, useState } from 'react';
import { localDateKey, parseLocalDateKey } from '@/lib/local-date';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import { CheckCircle2, Circle, ListChecks, Star } from 'lucide-react';

type Props = { examId: string };

export default function ExamDetailPage({ examId }: Props) {
  const { exams, tasks, toggleTopicCovered, toggleTopicReview, repackExamSchedule, syncToSupabase } = useStore();
  const exam = exams.find((e) => e.id === examId);
  const todayKey = localDateKey(new Date());
  const [repacking, setRepacking] = useState(false);
  const [repackMsg, setRepackMsg] = useState<string | null>(null);
  const [syllabusFilter, setSyllabusFilter] = useState<'all' | 'not_done' | 'done' | 'flagged'>('all');

  const todaySessions = useMemo(() => {
    if (!exam) return [];
    const rows: { title: string; taskTitle: string; minutes: number; done: boolean }[] = [];
    const today = startOfDay(new Date());
    for (const task of tasks) {
      for (const mt of task.microTasks) {
        if (mt.examId !== exam.id) continue;
        const d = mt.scheduledStart || mt.scheduledDate;
        if (!d || !isSameDay(new Date(d), today)) continue;
        rows.push({
          title: mt.title,
          taskTitle: task.title,
          minutes: mt.estimatedMinutes,
          done: mt.completed,
        });
      }
    }
    return rows;
  }, [exam, tasks, todayKey]);

  const syllabusRows = useMemo(() => {
    if (!exam) return [];
    const topics = exam.topics ?? [];
    const covered = exam.coveredTopicIds ?? [];
    const review = exam.reviewTopicIds ?? [];
    return topics.map((topic, index) => ({
      topic,
      index,
      done: covered.includes(topic),
      flagged: review.includes(topic),
    }));
  }, [exam]);

  const filteredSyllabus = useMemo(() => {
    return syllabusRows.filter((r) => {
      if (syllabusFilter === 'all') return true;
      if (syllabusFilter === 'not_done') return !r.done;
      if (syllabusFilter === 'done') return r.done;
      return r.flagged;
    });
  }, [syllabusRows, syllabusFilter]);

  if (!exam) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
        <p className="text-sm text-[#B0AEA5]">Exam not found.</p>
        <Link href="/exams" className="ml-2 text-[#D97757] font-heading">
          Back
        </Link>
      </div>
    );
  }

  const examDateParsed = parseLocalDateKey(String(exam.examDate).slice(0, 10));
  const todayStart = startOfDay(new Date());
  const daysLeft = differenceInCalendarDays(examDateParsed, todayStart);

  async function handleRepack() {
    if (!exam) return;
    setRepacking(true);
    setRepackMsg(null);
    try {
      repackExamSchedule(exam.id);
      await syncToSupabase().catch(() => {});
      setRepackMsg('Schedule repacked into your current work window and calendar.');
    } catch {
      setRepackMsg('Could not repack — try again.');
    } finally {
      setRepacking(false);
    }
  }
  const topicList = exam.topics ?? [];
  const totalTopics = Math.max(1, topicList.length);
  const covered = (exam.coveredTopicIds ?? []).filter((id) => topicList.includes(id)).length;
  const pct = Math.min(100, Math.round((covered / totalTopics) * 100));
  const created = startOfDay(new Date(exam.createdAt));
  const totalPlanDays = Math.max(1, differenceInCalendarDays(examDateParsed, created));
  const elapsed = Math.max(0, differenceInCalendarDays(todayStart, created));
  const expected = Math.min(totalTopics, (elapsed / totalPlanDays) * totalTopics);
  let status: 'On track' | 'Behind' | 'Ahead' = 'On track';
  if (covered < expected * 0.85 && daysLeft > 0) status = 'Behind';
  if (covered > expected * 1.15) status = 'Ahead';

  const behindN = Math.max(0, Math.ceil(expected - covered));
  const flaggedCount = (exam.reviewTopicIds ?? []).filter((id) => topicList.includes(id)).length;

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          lead={
            <Link href="/exams" className="text-sm text-[#B0AEA5] hover:text-[#141413] font-heading inline-block">
              ← All exams
            </Link>
          }
          title={exam.name}
          subtitle={exam.subject}
        >
          <p className="text-3xl font-heading font-bold text-[#D97757]">
            {daysLeft < 0 ? 'Done' : daysLeft === 0 ? 'Today' : `${daysLeft}`}
            <span className="text-base font-medium text-[#B0AEA5] ml-2">
              {daysLeft >= 0 ? 'days to go' : ''}
            </span>
          </p>
          <span
            className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-heading ${
              status === 'Behind'
                ? 'bg-[#D97757]/15 text-[#D97757]'
                : status === 'Ahead'
                  ? 'bg-[#788C5D]/15 text-[#788C5D]'
                  : 'bg-[#6A9BCC]/15 text-[#6A9BCC]'
            }`}
          >
            {status}
          </span>
        </PageHeader>

        <main className={`${PAGE_MAIN_CLASSES} w-full max-w-[1600px] mx-auto space-y-6`}>
          <div className="flex flex-col gap-8 xl:grid xl:grid-cols-12 xl:gap-10 xl:items-start">
            <div className="space-y-6 xl:col-span-4 min-w-0">
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[#E8E6DC]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-[#141413]"
                      strokeDasharray={`${pct}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-heading font-semibold text-[#141413]">
                    {covered}/{totalTopics}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[#B0AEA5] font-heading">Topics covered</p>
                  <p className="font-heading font-semibold text-[#141413]">{pct}%</p>
                </div>
              </div>

              {status === 'Behind' && behindN > 0 && (
                <div className="p-4 rounded-xl border border-[#D97757]/30 bg-[#D97757]/5 text-sm text-[#141413]">
                  You&apos;re about {behindN} topic{behindN === 1 ? '' : 's'} behind where we hoped. Add a short catch-up
                  block on Today when you can.
                </div>
              )}

              <div>
                <h2 className="font-heading font-semibold text-[#141413] mb-2">Today&apos;s exam sessions</h2>
                {todaySessions.length === 0 ? (
                  <p className="text-sm text-[#B0AEA5]">Nothing scheduled for this exam today.</p>
                ) : (
                  <ul className="space-y-2">
                    {todaySessions.map((s, i) => (
                      <li key={i} className="p-3 rounded-lg border border-[#E8E6DC] bg-white text-sm">
                        <span className="font-heading font-medium text-[#141413]">{s.title}</span>
                        <span className="text-[#B0AEA5]"> · {s.taskTitle} · {s.minutes}m</span>
                        {s.done ? <span className="ml-2 text-[#788C5D] text-xs font-heading">Done</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 rounded-xl border border-[#E8E6DC] bg-white space-y-2">
                <h2 className="font-heading font-semibold text-[#141413]">Calendar</h2>
                <p className="text-xs text-[#B0AEA5]">
                  If your work hours or classes changed, repack open prep sessions for this exam into your current work
                  window (Settings).
                </p>
                <button
                  type="button"
                  disabled={repacking}
                  onClick={() => void handleRepack()}
                  className="px-4 py-2 rounded-lg bg-[#141413] text-white text-sm font-heading font-medium disabled:opacity-50 hover:bg-[#2a2a28]"
                >
                  {repacking ? 'Repacking…' : 'Repack exam schedule'}
                </button>
                {repackMsg ? <p className="text-xs text-[#788C5D] font-heading">{repackMsg}</p> : null}
              </div>

              <p className="text-xs text-[#B0AEA5]">
                Exam date: {format(examDateParsed, 'EEEE, MMM d, yyyy')}
              </p>
            </div>

            <section className="rounded-2xl border border-[#E8E6DC] bg-white p-5 sm:p-6 shadow-sm xl:col-span-8 min-w-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D97757]/10 text-[#D97757]">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-heading font-semibold text-[#141413] text-lg">Syllabus</h2>
                    <p className="text-sm text-[#B0AEA5] mt-0.5">
                      Tap the main area to mark a topic <span className="text-[#141413] font-medium">covered</span>. Use the{' '}
                      <Star className="inline h-3.5 w-3.5 -translate-y-px text-[#D97757]" aria-hidden fill="currentColor" />{' '}
                      star to <span className="text-[#141413] font-medium">flag for review</span> (clears when you mark
                      covered).
                    </p>
                    {flaggedCount > 0 ? (
                      <p className="text-xs font-heading text-[#D97757] mt-2">
                        {flaggedCount} flagged for review
                      </p>
                    ) : null}
                  </div>
                </div>
                <div
                  className="flex flex-wrap rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] p-1 gap-0.5 lg:max-w-md lg:justify-end"
                  role="group"
                  aria-label="Filter syllabus topics"
                >
                  {(
                    [
                      { id: 'all' as const, label: 'All' },
                      { id: 'not_done' as const, label: 'Not covered' },
                      { id: 'done' as const, label: 'Covered' },
                      { id: 'flagged' as const, label: 'Flagged' },
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSyllabusFilter(id)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors ${
                        syllabusFilter === id
                          ? 'bg-white text-[#141413] shadow-sm border border-[#E8E6DC]'
                          : 'text-[#B0AEA5] hover:text-[#141413]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-heading text-[#B0AEA5]">
                  <span>Progress</span>
                  <span className="text-[#141413]">
                    {covered} / {topicList.length} covered
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-[#E8E6DC] overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Syllabus coverage"
                >
                  <div
                    className="h-full rounded-full bg-[#788C5D] transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {filteredSyllabus.length === 0 ? (
                <p className="mt-6 text-sm text-[#B0AEA5] text-center py-8 rounded-xl border border-dashed border-[#E8E6DC] bg-[#FAF9F5]/50">
                  No topics in this view. Try another filter.
                </p>
              ) : (
                <ul className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredSyllabus.map(({ topic, index, done, flagged }) => (
                    <li key={`${index}-${topic.slice(0, 48)}`}>
                      <div
                        className={`flex rounded-2xl border overflow-hidden transition-all duration-200 ${
                          done
                            ? 'border-[#788C5D]/35 bg-gradient-to-br from-[#788C5D]/[0.08] to-white shadow-sm'
                            : 'border-[#E8E6DC] bg-white hover:border-[#D97757]/25 hover:shadow-md'
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={done}
                          title={topic}
                          onClick={() => toggleTopicCovered(exam.id, topic)}
                          className="group flex flex-1 min-w-0 gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97757]/40"
                        >
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              done
                                ? 'border-[#788C5D] bg-[#788C5D]/15 text-[#5A7A4E]'
                                : 'border-[#E8E6DC] bg-[#FAF9F5] text-[#B0AEA5] group-hover:border-[#D97757]/35'
                            }`}
                            aria-hidden
                          >
                            {done ? (
                              <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                            ) : (
                              <Circle className="h-5 w-5" strokeWidth={1.75} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm font-heading font-medium leading-snug line-clamp-4 ${
                                  done ? 'text-[#5A7A4E]' : 'text-[#141413]'
                                }`}
                              >
                                {topic}
                              </p>
                              <span className="shrink-0 tabular-nums text-[10px] font-heading font-semibold uppercase tracking-wide text-[#B0AEA5] bg-[#FAF9F5] border border-[#E8E6DC] px-1.5 py-0.5 rounded-md">
                                #{index + 1}
                              </span>
                            </div>
                            <p
                              className={`mt-2 text-xs font-heading ${
                                done ? 'text-[#788C5D]' : flagged ? 'text-[#D97757]' : 'text-[#B0AEA5]'
                              }`}
                            >
                              {done ? 'Marked covered' : flagged ? 'Flagged for review' : 'Tap when revised'}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-pressed={flagged}
                          aria-label={flagged ? 'Remove review flag' : 'Flag topic for review'}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleTopicReview(exam.id, topic);
                          }}
                          className={`shrink-0 w-12 flex items-center justify-center border-l border-[#E8E6DC] transition-colors ${
                            flagged
                              ? 'bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/15'
                              : 'bg-[#FAF9F5]/80 text-[#B0AEA5] hover:bg-[#FAF9F5] hover:text-[#D97757]'
                          }`}
                        >
                          <Star className={`h-5 w-5 ${flagged ? 'fill-current' : ''}`} strokeWidth={flagged ? 0 : 1.75} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
