'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { resolveTopicKeyForExam } from '@/lib/skip-work-day';

type Props = {
  open: boolean;
  onClose: () => void;
  taskId: string | null;
  microTaskId: string | null;
  /** When the calendar groups adjacent steps, complete or reopen all of them together. */
  clusterMicroTaskIds?: string[];
};

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarItemDetailSheet({
  open,
  onClose,
  taskId,
  microTaskId,
  clusterMicroTaskIds,
}: Props) {
  const tasks = useStore((s) => s.tasks);
  const exams = useStore((s) => s.exams);
  const updateMicroTaskSchedule = useStore((s) => s.updateMicroTaskSchedule);
  const completeMicroTask = useStore((s) => s.completeMicroTask);
  const toggleMicroTaskComplete = useStore((s) => s.toggleMicroTaskComplete);
  const toggleTopicCovered = useStore((s) => s.toggleTopicCovered);

  const sessionIds = useMemo(() => {
    if (!microTaskId) return [];
    if (clusterMicroTaskIds?.length) return clusterMicroTaskIds;
    return [microTaskId];
  }, [microTaskId, clusterMicroTaskIds]);

  const { task, micro, exam } = useMemo(() => {
    if (!taskId || !microTaskId) return { task: undefined, micro: undefined, exam: undefined };
    const t = tasks.find((x) => x.id === taskId);
    const m = t?.microTasks.find((x) => x.id === microTaskId);
    const ex = m?.examId ? exams.find((e) => e.id === m.examId) : undefined;
    return { task: t, micro: m, exam: ex };
  }, [tasks, exams, taskId, microTaskId]);

  const clusterMicros = useMemo(() => {
    if (!task) return [];
    return sessionIds
      .map((id) => task.microTasks.find((mt) => mt.id === id))
      .filter(Boolean) as NonNullable<typeof task>['microTasks'];
  }, [task, sessionIds]);

  const allSessionComplete =
    clusterMicros.length > 0 && clusterMicros.every((m) => m.completed);
  const openInBlock = clusterMicros.filter((m) => !m.completed).length;

  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [plannedMins, setPlannedMins] = useState(30);

  useEffect(() => {
    if (!open || !micro) return;
    const s = micro.scheduledStart
      ? new Date(micro.scheduledStart)
      : micro.scheduledDate
        ? new Date(micro.scheduledDate)
        : new Date();
    const e = micro.scheduledEnd
      ? new Date(micro.scheduledEnd)
      : new Date(s.getTime() + Math.max(5, micro.estimatedMinutes) * 60_000);
    setStartVal(toDatetimeLocalValue(s));
    setEndVal(toDatetimeLocalValue(e));
    setPlannedMins(Math.max(5, Math.round((e.getTime() - s.getTime()) / 60_000)));
  }, [open, micro?.id, micro?.scheduledStart, micro?.scheduledEnd, micro?.scheduledDate, micro?.estimatedMinutes]);

  if (!open || !task || !micro) return null;

  const displayStart = micro.scheduledStart
    ? new Date(micro.scheduledStart)
    : micro.scheduledDate
      ? new Date(micro.scheduledDate)
      : null;
  const displayEnd = micro.scheduledEnd ? new Date(micro.scheduledEnd) : null;

  const showTopicToggles = !!micro.examId && !!exam;

  const markSessionDone = () => {
    for (const id of sessionIds) {
      const m = task.microTasks.find((x) => x.id === id);
      if (m && !m.completed) completeMicroTask(id);
    }
    onClose();
  };

  const markSessionUndone = () => {
    for (const id of sessionIds) {
      const m = task.microTasks.find((x) => x.id === id);
      if (m?.completed) toggleMicroTaskComplete(id);
    }
    onClose();
  };

  const applySchedule = () => {
    if (!startVal || !endVal) return;
    const s = new Date(startVal);
    const e = new Date(endVal);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;
    const mins = Math.max(5, Math.round((e.getTime() - s.getTime()) / 60_000));
    updateMicroTaskSchedule(micro.id, {
      scheduledStart: s,
      scheduledEnd: e,
      scheduledDate: new Date(s.getFullYear(), s.getMonth(), s.getDate()),
      estimatedMinutes: mins,
    });
    onClose();
  };

  const applyPlannedMinutes = (raw: string) => {
    const n = parseInt(raw, 10);
    const mins = Number.isFinite(n) ? Math.max(5, Math.min(480, n)) : plannedMins;
    setPlannedMins(mins);
    const s = new Date(startVal);
    if (Number.isNaN(s.getTime())) return;
    setEndVal(toDatetimeLocalValue(new Date(s.getTime() + mins * 60_000)));
  };

  const singleTopicKey = exam
    ? resolveTopicKeyForExam(micro.examTopicKey || micro.title || '', exam)
    : null;

  return (
    <div className="fixed inset-0 z-[11000] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/25 backdrop-blur-[2px] z-[11000]" aria-label="Close" onClick={onClose} />
      <aside className="relative z-[11001] w-full max-w-md h-full bg-[#FAF9F5] shadow-2xl border-l border-[#E8E6DC] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E6DC]">
          <h2 className="text-lg font-heading font-semibold text-[#141413] tracking-tight">Session</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#B0AEA5] hover:bg-[#E8E6DC]/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <p className="text-xs text-[#B0AEA5] font-heading mb-1">Topic / step</p>
            {clusterMicros.length > 1 ? (
              <ul className="text-sm font-medium text-[#141413] leading-snug space-y-1.5">
                {clusterMicros.map((m) => (
                  <li key={m.id} className={m.completed ? 'text-[#B0AEA5] line-through' : ''}>
                    {m.completed ? 'Done · ' : ''}
                    {m.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-sm font-medium leading-snug ${micro.completed ? 'text-[#B0AEA5] line-through' : 'text-[#141413]'}`}>
                {micro.title}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-[#B0AEA5] font-heading mb-1">Part of</p>
            <p className="text-sm font-heading font-medium text-[#141413]">{task.title}</p>
            {task.subject ? <p className="text-xs text-[#B0AEA5] mt-0.5">{task.subject}</p> : null}
            {micro.unitSectionLabel ? (
              <p className="text-xs text-[#6A9BCC] font-heading font-medium mt-2">{micro.unitSectionLabel}</p>
            ) : null}
            {exam ? (
              <Link
                href={`/exams/${encodeURIComponent(exam.id)}`}
                className="text-sm font-heading font-medium text-[#D97757] hover:underline mt-2 inline-block"
              >
                View exam plan & syllabus
              </Link>
            ) : null}
          </div>

          {micro.subtopics && micro.subtopics.length > 0 ? (
            <div>
              <p className="text-xs text-[#B0AEA5] font-heading mb-2">Topics in this session</p>
              {showTopicToggles && exam ? (
                <ul className="space-y-2">
                  {micro.subtopics.map((st) => {
                    const key = resolveTopicKeyForExam(String(st), exam);
                    const covered = key ? exam.coveredTopicIds.includes(key) : false;
                    return (
                      <li key={st}>
                        {key ? (
                          <label className="flex items-start gap-2 cursor-pointer text-sm text-[#141413]">
                            <input
                              type="checkbox"
                              checked={covered}
                              onChange={() => toggleTopicCovered(exam.id, key)}
                              className="mt-0.5 rounded border-[#E8E6DC]"
                            />
                            <span>{st}</span>
                          </label>
                        ) : (
                          <div className="text-sm text-[#141413]">
                            <p>{st}</p>
                            <p className="text-xs text-[#B0AEA5] mt-1 leading-snug">
                              This label doesn&apos;t match a line on your exam syllabus, so progress won&apos;t sync to the
                              exam ring. Edit the topic list on the exam page to align wording.
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="text-sm text-[#141413] space-y-1.5 list-disc list-inside leading-snug">
                  {micro.subtopics.map((st) => (
                    <li key={st}>{st}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : showTopicToggles && exam ? (
            <div>
              <p className="text-xs text-[#B0AEA5] font-heading mb-2">Exam topic</p>
              {singleTopicKey ? (
                <label className="flex items-start gap-2 cursor-pointer text-sm text-[#141413]">
                  <input
                    type="checkbox"
                    checked={exam.coveredTopicIds.includes(singleTopicKey)}
                    onChange={() => toggleTopicCovered(exam.id, singleTopicKey)}
                    className="mt-0.5 rounded border-[#E8E6DC]"
                  />
                  <span>{micro.examTopicKey || micro.title}</span>
                </label>
              ) : (
                <div className="text-sm text-[#141413]">
                  <p>{micro.examTopicKey || micro.title}</p>
                  <p className="text-xs text-[#B0AEA5] mt-1 leading-snug">
                    Doesn&apos;t match your exam syllabus list — open the exam plan to fix topic names so coverage syncs.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Planned time</p>
              <label className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={plannedMins}
                  onChange={(e) => applyPlannedMinutes(e.target.value)}
                  className="w-[4.5rem] rounded-lg border border-[#E8E6DC] px-3 py-2 text-sm font-medium text-[#141413] bg-white"
                />
                <span className="text-sm font-medium text-[#141413]">min</span>
              </label>
              <p className="text-[11px] text-[#B0AEA5] mt-1.5 leading-snug">
                Updates the end time below. Save times to keep it.
              </p>
            </div>
            <div>
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Priority</p>
              <p className="text-sm font-medium text-[#141413] capitalize">{task.priority}</p>
            </div>
          </div>

          {clusterMicros.length > 1 ? (
            <p className="text-xs text-[#B0AEA5]">
              {openInBlock === 0 ? 'All steps in this block are done.' : `${openInBlock} of ${clusterMicros.length} steps still open.`}
            </p>
          ) : null}

          {micro.description ? (
            <div>
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Note</p>
              <p className="text-sm text-[#141413] leading-relaxed">{micro.description}</p>
            </div>
          ) : null}

          <div className="rounded-xl bg-white border border-[#E8E6DC] p-4 space-y-3 card-shadow">
            <p className="text-xs font-heading font-medium text-[#141413]">Reschedule</p>
            <p className="text-[11px] text-[#B0AEA5] leading-snug">
              {clusterMicros.length > 1
                ? `This calendar block combines ${clusterMicros.length} steps. Start and end below apply only to the first step (“${(micro.title || '').trim() || 'step 1'}”). Open each step from the dashboard task list or tap other blocks on the calendar to move the rest.`
                : 'Adjust when this step sits in your day. Times apply to this step only.'}
            </p>
            <label className="block text-xs text-[#B0AEA5] font-heading">
              Start
              <input
                type="datetime-local"
                value={startVal}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartVal(next);
                  const s = new Date(next);
                  if (!Number.isNaN(s.getTime())) {
                    setEndVal(toDatetimeLocalValue(new Date(s.getTime() + plannedMins * 60_000)));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E8E6DC] px-3 py-2 text-sm text-[#141413] bg-white"
              />
            </label>
            <label className="block text-xs text-[#B0AEA5] font-heading">
              End
              <input
                type="datetime-local"
                value={endVal}
                onChange={(e) => {
                  const next = e.target.value;
                  setEndVal(next);
                  const s = new Date(startVal);
                  const t = new Date(next);
                  if (!Number.isNaN(s.getTime()) && !Number.isNaN(t.getTime())) {
                    setPlannedMins(Math.max(5, Math.round((t.getTime() - s.getTime()) / 60_000)));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E8E6DC] px-3 py-2 text-sm text-[#141413] bg-white"
              />
            </label>
            <button
              type="button"
              onClick={applySchedule}
              className="w-full py-2.5 rounded-lg bg-[#D97757] text-white text-sm font-heading font-semibold hover:bg-[#c96b4f]"
            >
              Save times
            </button>
          </div>

          {displayStart ? (
            <p className="text-xs text-[#B0AEA5]">
              Scheduled {format(displayStart, 'EEE, MMM d · h:mm a')}
              {displayEnd ? ` → ${format(displayEnd, 'h:mm a')}` : ''}
            </p>
          ) : null}
        </div>

        <div className="p-5 border-t border-[#E8E6DC] space-y-3">
          {allSessionComplete ? (
            <button
              type="button"
              onClick={markSessionUndone}
              className="flex items-center justify-center w-full py-3 rounded-xl border border-[#E8E6DC] text-[#141413] text-sm font-heading font-semibold hover:bg-white"
            >
              Mark not done
            </button>
          ) : (
            <button
              type="button"
              onClick={markSessionDone}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#788C5D] text-white text-sm font-heading font-semibold hover:bg-[#6d8054]"
            >
              <CheckCircle2 className="w-5 h-5" />
              {clusterMicros.length > 1
                ? `Mark block done (${openInBlock} left)`
                : 'Mark session done'}
            </button>
          )}
          <Link
            href={`/focus?task=${task.id}&micro=${micro.id}`}
            className="flex items-center justify-center w-full py-3 rounded-xl bg-[#141413] text-white text-sm font-heading font-semibold hover:bg-[#2a2a28]"
          >
            Focus on this
          </Link>
        </div>
      </aside>
    </div>
  );
}
