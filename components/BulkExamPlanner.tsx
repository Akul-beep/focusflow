'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { useStore } from '@/lib/store';
import { mergeSchedulePackOptions, scheduleMicroTasksIntoTimesAdaptive, type ScheduledMicroTask } from '@/lib/scheduler';
import type { CalendarEvent, MicroTask, Task } from '@/types';
import { makeId } from '@/lib/ids';
import { parseLocalDateKey } from '@/lib/local-date';
import {
  extractSyllabusTopicsHeuristic,
  rowsToSections,
  type SyllabusTopicRow,
} from '@/lib/exam-syllabus-extract';
import { buildSyllabusExternalFormatPrompt, EXTERNAL_AI_URLS } from '@/lib/syllabus-external-format-prompt';
import {
  planMultiSubjectExamPrep,
  typicalBlockMinutesHint,
  type SubjectPrepInput,
  type DatedPrepSession,
} from '@/lib/exam-prep-schedule';
import { fetchTopicMinutesMap } from '@/lib/exam-topic-minutes';

type BulkExamPlannerProps = {
  onDone?: () => void;
};

type QueuedSubject = {
  id: string;
  examName: string;
  subject: string;
  examDate: string;
  syllabus: string;
  rows: SyllabusTopicRow[];
};

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    return j.message || j.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export default function BulkExamPlanner({ onDone }: BulkExamPlannerProps) {
  const { addExam, addTask, updateExam, tasks, calendarEvents, schedulePreferences, addMotivationalMessage } =
    useStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState({
    examName: '',
    subject: '',
    examDate: '',
    syllabus: '',
  });
  const [subjects, setSubjects] = useState<QueuedSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [createdExamIds, setCreatedExamIds] = useState<string[]>([]);
  const [externalPasteHint, setExternalPasteHint] = useState<string | null>(null);

  const previewRows = useMemo(
    () => extractSyllabusTopicsHeuristic(draft.syllabus, draft.subject),
    [draft.syllabus, draft.subject]
  );

  const formatPromptOpts = useMemo(
    () =>
      draft.subject.trim()
        ? { selectedSubjectName: draft.subject.trim() }
        : undefined,
    [draft.subject]
  );

  const externalFormatPromptPreview = useMemo(
    () => buildSyllabusExternalFormatPrompt(draft.syllabus, formatPromptOpts),
    [draft.syllabus, formatPromptOpts]
  );

  const addCurrentSubject = () => {
    if (!draft.subject.trim() || !draft.examDate || !draft.syllabus.trim()) {
      setError('Add subject name, exam date, and syllabus text first.');
      return;
    }
    const rows = extractSyllabusTopicsHeuristic(draft.syllabus, draft.subject);
    if (rows.length === 0) {
      setError('No topics found. Paste your syllabus (semicolons and unit headings both work).');
      return;
    }
    const examName = draft.examName.trim() || `${draft.subject.trim()} exam`;
    setSubjects((prev) => [
      ...prev,
      {
        id: makeId('subj'),
        examName,
        subject: draft.subject.trim(),
        examDate: draft.examDate,
        syllabus: draft.syllabus.trim(),
        rows,
      },
    ]);
    setDraft({ examName: '', subject: '', examDate: '', syllabus: '' });
    setError(null);
  };

  const removeSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const copyFormatPromptOpenChatGpt = async () => {
    setError(null);
    setExternalPasteHint(null);
    const raw = draft.syllabus.trim();
    const prompt = buildSyllabusExternalFormatPrompt(raw, formatPromptOpts);
    try {
      await navigator.clipboard.writeText(prompt);
      setExternalPasteHint(
        'Prompt copied. ChatGPT cannot auto-paste from another site — in the new tab, press ⌘V (Mac) or Ctrl+V (Windows/Linux) to paste, then copy the model’s reply back here.'
      );
      window.setTimeout(() => setExternalPasteHint(null), 14000);
    } catch {
      setError(
        'Could not copy to clipboard. Allow clipboard access, open ChatGPT manually, then copy the prompt from “View / copy prompt only” below and paste it there yourself.'
      );
    }
    window.open(EXTERNAL_AI_URLS.chatgpt, '_blank', 'noopener,noreferrer');
  };

  const reparseLocal = (q: QueuedSubject) => {
    const rows = extractSyllabusTopicsHeuristic(q.syllabus, q.subject);
    setSubjects((prev) => prev.map((s) => (s.id === q.id ? { ...s, rows } : s)));
  };

  const handleGenerateAll = async () => {
    if (subjects.length === 0) {
      setError('Add at least one subject first.');
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    setNotes([]);
    setCreatedExamIds([]);

    const createdTasks: Task[] = [];
    const createdIds: string[] = [];
    const planNotes: string[] = [];
    let unscheduledTotal = 0;
    const warningParts: string[] = [];

    try {
      const ordered = [...subjects].sort(
        (a, b) => parseLocalDateKey(a.examDate).getTime() - parseLocalDateKey(b.examDate).getTime()
      );

      const minutesBySubject = new Map<string, Map<string, number>>();
      let aiEstimatesOk = true;
      for (const s of ordered) {
        const topicTitles = s.rows.map((r) => r.topic);
        try {
          const m = await fetchTopicMinutesMap(
            s.subject,
            topicTitles,
            schedulePreferences,
            (label) => setProgressText(label)
          );
          minutesBySubject.set(s.id, m);
        } catch {
          aiEstimatesOk = false;
          minutesBySubject.set(s.id, new Map());
        }
      }
      if (!aiEstimatesOk) {
        warningParts.push(
          'AI time estimates were not available (check API key / network). Used built-in heuristics per topic instead.'
        );
      }

      const inputs: SubjectPrepInput[] = ordered.map((s) => ({
        id: s.id,
        subject: s.subject,
        examName: s.examName,
        examDateKey: s.examDate,
        rows: s.rows,
        topicMinutes: minutesBySubject.get(s.id),
      }));

      planNotes.push(
        aiEstimatesOk
          ? 'One block per subject per calendar day (topics for that day grouped together). Times use AI per-topic estimates scaled for exam review, grade defaults to 10 if unset; daily total capped (~95 min max per subject per day).'
          : 'One block per subject per day. Times use built-in heuristics (grade defaults to 10); daily total capped.'
      );

      setProgressText('Building balanced multi-subject plan…');
      const planned = planMultiSubjectExamPrep(inputs, schedulePreferences, new Date());
      const bySubject = new Map<string, DatedPrepSession[]>();
      for (const p of planned) {
        if (!bySubject.has(p.subjectId)) bySubject.set(p.subjectId, []);
        bySubject.get(p.subjectId)!.push(p);
      }

      for (const s of ordered) {
        const sessions = (bySubject.get(s.id) || []).sort((a, b) => {
          const da = startOfDay(a.scheduledDate).getTime();
          const db = startOfDay(b.scheduledDate).getTime();
          if (da !== db) return da - db;
          return a.order - b.order;
        });
        if (sessions.length === 0) throw new Error(`No sessions for ${s.subject}.`);

        const examDay = startOfDay(parseLocalDateKey(s.examDate));
        const todayStart = startOfDay(new Date());
        const daysAvailable = Math.max(1, differenceInCalendarDays(examDay, todayStart) + 1);
        const byDay = new Map<string, number>();
        for (const se of sessions) {
          const k = format(startOfDay(se.scheduledDate), 'yyyy-MM-dd');
          byDay.set(k, (byDay.get(k) ?? 0) + se.estimatedMinutes);
        }
        const peakDay = byDay.size > 0 ? Math.max(...byDay.values()) : 0;
        const avgMins =
          sessions.length > 0
            ? Math.round(sessions.reduce((a, x) => a + x.estimatedMinutes, 0) / sessions.length)
            : 0;
        planNotes.push(
          `${s.subject}: ${sessions.length} blocks · ${s.rows.length} topics · ~${avgMins} min average per block · busiest day ~${peakDay} min before calendar packing.`
        );

        setProgressText(`Placing ${s.subject} on the calendar…`);
        const taskId = makeId('task-exam');
        const packWallClock = new Date();
        const microTasks: MicroTask[] = sessions.map((se, idx) => ({
          id: makeId(`micro-exam-${idx}`),
          parentTaskId: taskId,
          title: `${s.subject} · ${format(startOfDay(se.scheduledDate), 'EEE MMM d')}${
            sessions.length > 1 ? ` (${idx + 1}/${sessions.length})` : ''
          }`,
          description: `${se.sectionTitle}\n${se.topics.map((t) => `- ${t}`).join('\n')}`,
          subtopics: se.topics,
          unitSectionLabel: se.sectionTitle,
          estimatedMinutes: se.estimatedMinutes,
          completed: false,
          order: idx + 1,
          source: 'exam-planner',
          examId: '',
          examTopicKey: se.topics[0],
          scheduledDate: se.scheduledDate,
        }));

        const scheduled = scheduleMicroTasksIntoTimesAdaptive({
          microTasks,
          startDay: packWallClock,
          dueDay: examDay,
          prefs: schedulePreferences,
          calendarEvents,
          existingTasks: [...tasks, ...createdTasks],
          options: mergeSchedulePackOptions(schedulePreferences),
        });
        unscheduledTotal += scheduled.unscheduled.length;
        if (scheduled.expanded) {
          planNotes.push(`${s.subject}: widened your work window slightly to fit every session.`);
        }
        if (scheduled.unscheduled.length > 0) {
          planNotes.push(`${s.subject}: ${scheduled.unscheduled.length} block(s) still need more free time.`);
        }

        const finalMicroTasks = [...scheduled.scheduled, ...scheduled.unscheduled].map((mt, idx) => ({
          ...mt,
          order: idx + 1,
          scheduledDate: mt.scheduledDate || (mt.scheduledStart ? new Date(mt.scheduledStart) : mt.scheduledDate),
        }));

        let examId: string | null = null;
        try {
          const topicTitles = s.rows.map((r) => r.topic);
          const derivedDailyHours = Number(
            (
              finalMicroTasks.reduce((a, b) => a + b.estimatedMinutes, 0) /
              60 /
              Math.max(1, daysAvailable)
            ).toFixed(1)
          );
          examId = addExam({
            name: s.examName,
            subject: s.subject,
            examDate: s.examDate,
            dailyHours: Math.max(0.5, derivedDailyHours),
            topics: topicTitles,
            coveredTopicIds: [],
            reviewTopicIds: [],
            sessionsGenerated: false,
          });
          if (!examId) throw new Error(`Failed to create exam for ${s.subject}.`);
          const withExam = finalMicroTasks.map((mt) => ({ ...mt, examId: examId as string }));

          const task: Task = {
            id: taskId,
            title: `${s.subject} exam prep`,
            description: `Balanced plan for ${s.examName}`,
            dueDate: examDay,
            priority: 'high',
            subject: s.subject,
            microTasks: withExam,
            completed: false,
            createdAt: new Date(),
            estimatedTotalMinutes: withExam.reduce((sum, mt) => sum + mt.estimatedMinutes, 0),
          };
          addTask(task);
          createdTasks.push(task);
          updateExam(examId, { sessionsGenerated: true });
          createdIds.push(examId);
        } catch (inner) {
          if (examId) useStore.getState().deleteExam(examId);
          throw inner;
        }
      }

      if (unscheduledTotal > 0) {
        warningParts.push(
          `${unscheduledTotal} session block(s) could not fit your calendar. Widen your work window in Settings or clear conflicting tasks.`
        );
      }
      if (warningParts.length > 0) setWarning(warningParts.join(' '));
      setNotes(planNotes);
      addMotivationalMessage({
        message: `Exam prep: every prep day has topics; times from ${aiEstimatesOk ? 'AI' : 'heuristics'}—${ordered.length} subject(s).`,
        type: 'encouragement',
      });
      setCreatedExamIds(createdIds);
      setSubjects([]);
      setDraft({ examName: '', subject: '', examDate: '', syllabus: '' });
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate schedules.');
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  if (createdExamIds.length > 0) {
    return (
      <div className="rounded-lg border border-[#788C5D]/30 bg-[#788C5D]/10 p-5 space-y-3">
        <p className="font-heading font-semibold text-[#141413]">Exam schedules ready</p>
        <p className="text-sm text-[#57544d]">
          Topics are assigned across each prep day; block times follow AI (or heuristic) estimates. Subjects are
          mixed so one course does not monopolize the last week.
        </p>
        {warning ? <p className="text-xs text-[#D97757]">{warning}</p> : null}
        <div className="flex flex-wrap gap-2">
          {createdExamIds.slice(0, 6).map((id) => (
            <Link
              key={id}
              href={`/exams/${encodeURIComponent(id)}`}
              className="inline-flex px-3 py-2 rounded-lg bg-white border border-[#E8E6DC] text-xs font-heading font-medium hover:bg-[#F0EEE6]"
            >
              Open exam
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setCreatedExamIds([]);
              setWarning(null);
              onDone?.();
            }}
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-sm font-heading font-medium hover:bg-[#2a2a28]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] p-4 space-y-4">
      <div>
        <p className="font-heading font-medium text-[#141413]">Exam syllabus scheduler</p>
        <p className="text-xs text-[#57544d] leading-snug mt-1">
          <span className="font-heading text-[#141413]">Step {step} of 2.</span> Fill one subject, then{' '}
          <strong className="text-[#141413]">Add to queue</strong>. Repeat for as many courses as you like — nothing is
          final until you generate on step 2.
        </p>
        <details className="mt-2 text-xs text-[#57544d] rounded-lg border border-[#E8E6DC] bg-white px-3 py-2">
          <summary className="cursor-pointer font-heading text-[#6A9BCC] select-none">How scheduling works</summary>
          <p className="mt-2 leading-relaxed">
            Topics come from your paste (semicolons + unit headings). We spread them across days until each exam,{' '}
            <strong className="text-[#141413]">one calendar block per subject per day</strong>. AI estimates minutes per
            topic (exam-review style); grade defaults to <strong>10</strong> in Settings if unset. Subjects are mixed so
            one course does not take the whole last week.
          </p>
        </details>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`px-3 py-1.5 rounded-md font-heading ${step === 1 ? 'bg-[#141413] text-white' : 'bg-white border border-[#E8E6DC]'}`}
        >
          1 · Add subjects
        </button>
        <button
          type="button"
          disabled={subjects.length === 0}
          onClick={() => setStep(2)}
          className={`px-3 py-1.5 rounded-md font-heading disabled:opacity-40 ${step === 2 ? 'bg-[#141413] text-white' : 'bg-white border border-[#E8E6DC]'}`}
        >
          2 · Review & generate
        </button>
      </div>

      {step === 1 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Subject name (e.g. Extended Mathematics)"
              className="w-full px-3 py-2 rounded-lg border border-[#E8E6DC] text-sm text-[#141413]"
            />
            <input
              value={draft.examName}
              onChange={(e) => setDraft({ ...draft, examName: e.target.value })}
              placeholder="Exam label (optional)"
              className="w-full px-3 py-2 rounded-lg border border-[#E8E6DC] text-sm text-[#141413]"
            />
            <input
              type="date"
              value={draft.examDate}
              onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E8E6DC] text-sm text-[#141413]"
            />
          </div>

          <textarea
            value={draft.syllabus}
            onChange={(e) => setDraft({ ...draft, syllabus: e.target.value })}
            placeholder="Paste the full syllabus for this subject only. Semicolons separate topics. Headings like “Unit 2 – …:” or “Algebra:” start a new section."
            rows={10}
            className="w-full px-3 py-2 rounded-lg border border-[#E8E6DC] text-sm text-[#141413] font-body leading-relaxed"
          />

          <p className="text-xs text-[#57544d] leading-relaxed">
            <span className="font-heading font-medium text-[#141413]">Messy syllabus?</span> Use{' '}
            <strong className="text-[#141413]">Copy for ChatGPT</strong> — it copies a formatting prompt (with your
            subject name) and opens ChatGPT. <strong className="text-[#141413]">You must paste it yourself</strong>{' '}
            (⌘V / Ctrl+V); websites cannot inject text into ChatGPT for you. Then paste the model&apos;s cleaned list
            back here and add to queue.
          </p>
          {externalPasteHint ? (
            <p className="text-xs text-[#2d6a4f] leading-relaxed rounded-lg border border-[#95d5b2]/60 bg-[#d8f3dc]/40 px-3 py-2 font-body">
              {externalPasteHint}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addCurrentSubject}
              className="px-4 py-2 rounded-lg bg-[#141413] text-white text-sm font-heading font-medium hover:bg-[#2a2a28]"
            >
              Add to queue
            </button>
            <button
              type="button"
              onClick={() => void copyFormatPromptOpenChatGpt()}
              className="px-4 py-2 rounded-lg border border-[#6A9BCC] text-[#6A9BCC] text-sm font-heading font-medium hover:bg-[#6A9BCC]/10"
              title="Copies prompt to clipboard and opens ChatGPT — you paste with ⌘V or Ctrl+V in that tab"
            >
              Copy for ChatGPT
            </button>
            <span className="text-xs text-[#B0AEA5]">
              Detected: <strong className="text-[#141413]">{previewRows.length}</strong> topics
            </span>
          </div>

          <details className="text-xs text-[#57544d] rounded-lg border border-[#E8E6DC] bg-white px-3 py-2">
            <summary className="cursor-pointer font-heading text-[#6A9BCC] select-none">
              View / copy prompt only (no new tab)
            </summary>
            <textarea
              readOnly
              rows={6}
              value={externalFormatPromptPreview}
              className="mt-2 w-full rounded-md border border-[#E8E6DC] bg-[#FAF9F5] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-[#141413]"
              aria-label="Formatting prompt for external AI"
              onFocus={(e) => e.target.select()}
            />
          </details>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#57544d] rounded-lg border border-[#E8E6DC] bg-white px-3 py-2">
            <strong className="text-[#141413]">Generate</strong> creates exams + calendar tasks for{' '}
            <strong className="text-[#141413]">every subject in the list below</strong>. AI estimates minutes per topic
            (needs API key; otherwise heuristics). Cap ~{typicalBlockMinutesHint(schedulePreferences)} min per block.{' '}
            <strong className="text-[#141413]">Re-parse locally</strong> if you edited pasted text.
          </p>
          {subjects.map((q) => {
            const sections = rowsToSections(q.rows);
            return (
              <div key={q.id} className="rounded-lg border border-[#E8E6DC] bg-white p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-heading font-semibold text-sm text-[#141413]">{q.subject}</p>
                    <p className="text-xs text-[#B0AEA5]">
                      {q.examName} · Exam {q.examDate} · {q.rows.length} topics · {sections.length} sections
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => reparseLocal(q)}
                      className="px-2.5 py-1 rounded-md border border-[#E8E6DC] text-xs font-heading hover:bg-[#FAF9F5]"
                    >
                      Re-parse locally
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSubject(q.id)}
                      className="px-2.5 py-1 rounded-md border border-[#E8E6DC] text-xs font-heading text-[#D97757] hover:bg-[#FAF9F5]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer font-heading text-[#6A9BCC]">Sections & topics</summary>
                  <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto text-[#57544d]">
                    {sections.map((sec) => (
                      <li key={sec.title}>
                        <span className="font-heading text-[#141413]">{sec.title}</span>
                        <ul className="list-disc list-inside ml-1 mt-0.5">
                          {sec.topics.slice(0, 12).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                          {sec.topics.length > 12 ? (
                            <li className="text-[#B0AEA5]">… +{sec.topics.length - 12} more</li>
                          ) : null}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {error ? <p className="text-xs text-[#D97757]">{error}</p> : null}
      {warning ? <p className="text-xs text-[#D97757]">{warning}</p> : null}
      {notes.length > 0 ? (
        <div className="text-xs text-[#57544d] space-y-1 bg-white border border-[#E8E6DC] rounded-lg p-2.5">
          {notes.map((n, i) => (
            <p key={i}>• {n}</p>
          ))}
        </div>
      ) : null}
      {loading && progressText ? <p className="text-xs text-[#6A9BCC]">{progressText}</p> : null}

      {step === 2 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || subjects.length === 0}
            onClick={() => void handleGenerateAll()}
            className="px-4 py-2 rounded-lg bg-[#141413] text-white text-sm font-heading font-medium disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate balanced schedules'}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-lg border border-[#E8E6DC] bg-white text-sm font-heading font-medium hover:bg-[#F0EEE6]"
          >
            Back
          </button>
        </div>
      ) : null}

      {step === 1 && subjects.length > 0 ? (
        <div className="rounded-lg border border-[#E8E6DC] bg-white p-3">
          <p className="text-xs font-heading font-medium text-[#141413] mb-2">Queue ({subjects.length})</p>
          <ul className="text-sm space-y-1.5">
            {subjects.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {s.subject} · {s.examDate} · {s.rows.length} topics
                </span>
                <button
                  type="button"
                  onClick={() => removeSubject(s.id)}
                  className="text-xs text-[#D97757] shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-3 w-full sm:w-auto px-4 py-2 rounded-lg bg-[#6A9BCC] text-white text-sm font-heading font-medium"
          >
            Continue to review
          </button>
        </div>
      ) : null}

      {onDone ? (
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-[#B0AEA5] underline"
        >
          Close planner
        </button>
      ) : null}
    </div>
  );
}
