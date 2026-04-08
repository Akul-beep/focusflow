'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GraduationCap, BookMarked } from 'lucide-react';
import type { Task } from '@/types';
import TaskCard from '@/components/TaskCard';

type Props = { tasks: Task[] };

export default function ExamSyllabusTaskGroup({ tasks }: Props) {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    const subjects = new Set<string>();
    for (const t of tasks) {
      subjects.add((t.subject && t.subject.trim()) || 'General');
    }
    const done = tasks.filter((t) => t.completed).length;
    const totalSteps = tasks.reduce((n, t) => n + t.microTasks.length, 0);
    const doneSteps = tasks.reduce(
      (n, t) => n + t.microTasks.filter((m) => m.completed).length,
      0
    );
    return {
      subjectCount: subjects.size,
      taskCount: tasks.length,
      doneCount: done,
      totalSteps,
      doneSteps,
    };
  }, [tasks]);

  if (tasks.length === 0) return null;

  const subjectLabel =
    summary.subjectCount === 1 ? '1 subject' : `${summary.subjectCount} subjects`;
  const stepPct =
    summary.totalSteps > 0 ? Math.round((summary.doneSteps / summary.totalSteps) * 100) : 0;

  return (
    <div className="relative flex rounded-xl border bg-[var(--surface)] shadow-sm transition-shadow hover:shadow-md border-[var(--border-default)] overflow-hidden">
      <div className="w-1 shrink-0 bg-[#6A9BCC]" aria-hidden />
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-start gap-3 text-left rounded-lg -m-1 p-1 hover:bg-[var(--surface-muted)] transition-colors min-w-0"
          aria-expanded={open}
        >
          <span
            className={`mt-0.5 p-1.5 rounded-lg shrink-0 transition-colors ${
              open ? 'bg-[var(--surface-muted)] text-[#6A9BCC]' : 'text-[var(--text-muted)]'
            }`}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h3 className="font-heading font-semibold text-base sm:text-[17px] text-[var(--foreground)] leading-snug">
                    Exam syllabus
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-heading font-semibold uppercase tracking-wide border bg-[#6A9BCC]/12 text-[#4a7aad] border-[#6A9BCC]/25">
                    Syllabus
                  </span>
                </div>
                <p className="text-sm text-[var(--text-subtle)] mt-1.5 leading-relaxed font-body">
                  {subjectLabel} · {summary.taskCount} task{summary.taskCount !== 1 ? 's' : ''}
                  {summary.doneCount > 0 ? ` · ${summary.doneCount} task${summary.doneCount !== 1 ? 's' : ''} done` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-heading text-[var(--text-muted)]">
                <GraduationCap className="w-4 h-4 shrink-0 opacity-80" />
                Syllabus prep
              </span>
              <span className="inline-flex items-center gap-1.5 font-heading text-[var(--text-muted)]">
                <BookMarked className="w-4 h-4 shrink-0 opacity-80" />
                {summary.doneSteps} of {summary.totalSteps} steps
              </span>
            </div>

            {summary.totalSteps > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-heading font-medium text-[var(--foreground)]">Overall step progress</span>
                  <span className="text-sm font-heading font-bold text-[#6A9BCC] tabular-nums">{stepPct}%</span>
                </div>
                <div className="h-2 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6A9BCC] transition-all duration-500"
                    style={{ width: `${stepPct}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </button>

        {open ? (
          <div className="mt-4 pt-4 border-t border-[var(--border-default)] space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
