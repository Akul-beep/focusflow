'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { ArrowLeft, Play, Pause, Square, Sparkles, Clock, List, NotebookPen, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Task, MicroTask, PomodoroSession } from '@/types';
import Link from 'next/link';
import MoodTracker from '@/components/MoodTracker';
import { generateMotivationalMessage } from '@/components/MotivationalMessages';
import TaskSelectionModal from '@/components/TaskSelectionModal';
import { makeId } from '@/lib/ids';
import TreeForest from '@/components/TreeForest';
import { getNextFocusMicroTask } from '@/lib/focus-next-step';
import { getDayAgenda } from '@/lib/agenda';

function FocusModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    tasks,
    calendarEvents,
    currentPomodoro,
    setCurrentPomodoro,
    addPomodoroSession,
    completeMicroTask,
    updateStats,
    addMotivationalMessage,
    updateTask,
    schedulePreferences,
    motivationPreferences,
  } = useStore();

  const [timeLeft, setTimeLeft] = useState(schedulePreferences.defaultSessionMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showTaskSelection, setShowTaskSelection] = useState(false);
  const [taskPickerScope, setTaskPickerScope] = useState<'all' | 'today'>('today');
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [sessionWrapUp, setSessionWrapUp] = useState<{ focusMinutes: number } | null>(null);

  const isBreakRef = useRef(isBreak);
  useEffect(() => {
    isBreakRef.current = isBreak;
  }, [isBreak]);

  const completeTimerRef = useRef<() => void>(() => {});
  completeTimerRef.current = () => {
    const st = useStore.getState();
    const prefs = st.schedulePreferences;
    const cp = st.currentPomodoro;
    if (!cp) return;

    if (isBreakRef.current) {
      st.addPomodoroSession({
        ...cp,
        endTime: new Date(),
        completed: true,
      });
      st.setCurrentPomodoro(null);
      setIsBreak(false);
      setTimeLeft(prefs.defaultSessionMinutes * 60);
      return;
    }

    const completed = {
      ...cp,
      endTime: new Date(),
      completed: true,
    };
    st.addPomodoroSession(completed);
    st.setCurrentPomodoro(null);
    setSessionWrapUp({ focusMinutes: completed.duration });
  };

  const taskId = searchParams?.get('task') || '';
  const microTaskId = searchParams?.get('micro') || '';

  const currentTask = taskId ? tasks.find((t) => t.id === taskId) || null : null;
  const currentMicroTask =
    currentTask && microTaskId ? currentTask.microTasks.find((mt) => mt.id === microTaskId && !mt.completed) || null : null;
  const anchorTask = currentTask ?? (taskId ? tasks.find((t) => t.id === taskId) ?? null : null);
  const nextUp = getNextFocusMicroTask(tasks);

  const todayScheduledStepCount = useMemo(
    () => getDayAgenda({ day: new Date(), tasks, calendarEvents }).taskSteps.length,
    [tasks, calendarEvents]
  );

  const openStepPicker = () => {
    setTaskPickerScope(todayScheduledStepCount > 0 ? 'today' : 'all');
    setShowTaskSelection(true);
  };

  useEffect(() => {
    if (taskId && microTaskId) return;
    const next = getNextFocusMicroTask(tasks);
    if (next) {
      router.replace(`/focus?task=${next.task.id}&micro=${next.microTask.id}`);
    }
  }, [taskId, microTaskId, tasks, router]);

  // Default timer length should track the scheduled step estimate (still capped when you press Start).
  useEffect(() => {
    if (currentPomodoro) return;
    if (isBreak) {
      setTimeLeft(schedulePreferences.breakMinutes * 60);
      return;
    }
    if (!currentMicroTask) return;
    const est = Math.max(
      5,
      Math.round(Number(currentMicroTask.estimatedMinutes)) || schedulePreferences.defaultSessionMinutes
    );
    const sessionMin = Math.min(120, Math.max(5, schedulePreferences.defaultSessionMinutes), est);
    setTimeLeft(sessionMin * 60);
  }, [
    currentMicroTask?.id,
    isBreak,
    schedulePreferences.breakMinutes,
    schedulePreferences.defaultSessionMinutes,
    currentPomodoro,
  ]);

  useEffect(() => {
    if (!taskId || !microTaskId || !currentTask) return;
    if (currentMicroTask) return;
    const next = getNextFocusMicroTask(tasks);
    if (next) {
      router.replace(`/focus?task=${next.task.id}&micro=${next.microTask.id}`);
    }
  }, [taskId, microTaskId, currentTask, currentMicroTask, tasks, router]);

  const proceedToBreakAfterWrap = () => {
    setSessionWrapUp(null);
    setIsBreak(true);
    setTimeLeft(schedulePreferences.breakMinutes * 60);
  };

  const handleMarkStepDoneAfterSession = () => {
    if (currentMicroTask) {
      completeMicroTask(currentMicroTask.id);
      updateStats();
      addMotivationalMessage({
        message: generateMotivationalMessage('progress', currentMicroTask.title, useStore.getState().stats),
        type: 'progress',
      });
      const next = getNextFocusMicroTask(useStore.getState().tasks);
      if (next) {
        router.replace(`/focus?task=${next.task.id}&micro=${next.microTask.id}`);
      }
    }
    proceedToBreakAfterWrap();
  };

  const handleStart = () => {
    if (!currentPomodoro) {
      if (isBreak) {
        if (!anchorTask) return;
      } else if (!currentMicroTask || !anchorTask) {
        return;
      }

      const now = new Date();
      const upcoming = calendarEvents
        .map((e) => ({ start: e.start instanceof Date ? e.start : new Date(e.start) }))
        .filter((e) => e.start > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
      const minutesUntilNextEvent = upcoming ? Math.floor((upcoming.start.getTime() - now.getTime()) / 60000) : null;

      const plannedMinutes = isBreak ? schedulePreferences.breakMinutes : schedulePreferences.defaultSessionMinutes;
      const capByEvent =
        minutesUntilNextEvent !== null
          ? Math.max(5, Math.min(plannedMinutes, minutesUntilNextEvent - schedulePreferences.bufferMinutes))
          : plannedMinutes;
      const capByMicroTask =
        !isBreak && currentMicroTask?.scheduledEnd && currentMicroTask?.scheduledStart
          ? Math.max(5, Math.min(capByEvent, Math.ceil((currentMicroTask.scheduledEnd.getTime() - now.getTime()) / 60000)))
          : capByEvent;

      const session: PomodoroSession = {
        id: makeId('pomodoro'),
        taskId: anchorTask.id,
        microTaskId: currentMicroTask?.id,
        duration: capByMicroTask,
        startTime: new Date(),
        completed: false,
        type: isBreak ? 'break' : 'focus',
      };
      setCurrentPomodoro(session);
      setTimeLeft(capByMicroTask * 60);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setCurrentPomodoro(null);
    setTimeLeft(schedulePreferences.defaultSessionMinutes * 60);
    setIsBreak(false);
    setSessionWrapUp(null);
  };

  const saveQuickNote = () => {
    if (!currentTask || !currentMicroTask || !quickNote.trim()) return;
    const nextMicroTasks = currentTask.microTasks.map((mt) =>
      mt.id === currentMicroTask.id
        ? { ...mt, notes: [...(mt.notes || []), quickNote.trim()] }
        : mt
    );
    updateTask(currentTask.id, { microTasks: nextMicroTasks });
    setQuickNote('');
    setShowQuickNote(false);
  };

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          queueMicrotask(() => completeTimerRef.current());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const baseSeconds = (isBreak ? schedulePreferences.breakMinutes : schedulePreferences.defaultSessionMinutes) * 60;
  const progress = (baseSeconds - timeLeft) / baseSeconds;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const taskProgress = currentTask ? currentTask.microTasks.filter((mt) => mt.completed).length / currentTask.microTasks.length : 0;
  const completedMicroTasks = currentTask ? currentTask.microTasks.filter((mt) => mt.completed).length : 0;
  const totalMicroTasks = currentTask ? currentTask.microTasks.length : 0;

  const liveFocusMinutes = (() => {
    if (!currentPomodoro) return 0;
    if (isBreak) return 0;
    if (!isRunning) return 0;
    const total = currentPomodoro.duration * 60;
    const elapsed = Math.max(0, Math.min(total, total - timeLeft));
    return elapsed / 60;
  })();

  const motivationLine = (() => {
    if (isBreak) return 'Step away from the screen for a few minutes. Breaks help your brain lock in what you learned.';
    const stage = !isRunning ? 'start' : timeLeft <= 60 ? 'finish' : progress >= 0.5 ? 'mid' : 'start';
    const poolByStage: Record<typeof stage, string[]> = {
      start: [
        'Pick one step. Start the timer. You only need to begin.',
        'Short sessions beat perfect plans. Press start when you are ready.',
        'One focused block is enough to move the needle today.',
      ],
      mid: [
        'Halfway through—stay with the step you chose.',
        'Let the rest of the class chat stay in the background. You are working now.',
        'Keep your attention on this one task. That is the whole trick.',
      ],
      finish: [
        'Last minute—stay with it until the timer ends.',
        'Almost there. Finish this block, then you can decide if the step is done.',
        'Close the session cleanly. You will choose what counts as “done” next.',
      ],
    };
    const pool = poolByStage[stage];
    const seed = (currentMicroTask?.id?.length || 0) + stage.length * 13;
    return pool[seed % pool.length];
  })();

  if (!currentMicroTask && !sessionWrapUp && !(isBreak && anchorTask)) {
    return (
      <>
        <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center bg-white rounded-xl border border-[#E8E6DC] p-8 shadow-sm">
            <h1 className="font-heading font-bold text-2xl text-[#141413] mb-3">Start with one step</h1>
            <p className="text-[#6f6d66] mb-2 font-body text-sm leading-relaxed">
              Focus mode runs a Pomodoro timer for a single step. Time counts toward your{' '}
              <span className="font-heading font-medium text-[#141413]">growth forest</span>, streak, and FocusCoins.
            </p>
            <p className="text-[#B0AEA5] mb-6 font-body text-xs">
              Add tasks on the dashboard, then choose which step to work on.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={openStepPicker}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#D97757] text-white rounded-lg font-heading font-semibold hover:bg-[#c96b4f] transition-colors"
              >
                <Play className="w-4 h-4" />
                {todayScheduledStepCount > 0 ? "Today's steps" : 'Pick a step'}
              </button>
              <Link
                href="/today"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
              >
                Today&apos;s plan
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-heading">
              <Link
                href="/today"
                className="inline-flex items-center gap-2 text-[#6A9BCC] hover:text-[#4a7aad]"
              >
                <ArrowLeft className="w-4 h-4" />
                Today
              </Link>
              <Link href="/dashboard" className="text-[#B0AEA5] hover:text-[#D97757]">
                Task board
              </Link>
            </div>
          </div>
        </div>
        <TaskSelectionModal
          isOpen={showTaskSelection}
          onClose={() => setShowTaskSelection(false)}
          scheduleScope={taskPickerScope}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#FAF9F5]">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0 shrink">
                <Link
                  href="/today"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-[#141413] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors font-heading text-xs sm:text-sm font-medium min-w-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span className="truncate">Today</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 text-[#B0AEA5] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors font-heading text-xs font-medium"
                >
                  Tasks
                </Link>
              </div>
              <div className="text-center flex-1 min-w-0 px-1">
                <h1 className="font-heading font-bold text-lg sm:text-xl text-[#141413]">
                  {isBreak ? 'Break' : 'Focus'}
                </h1>
                <p className="text-[10px] sm:text-xs text-[#B0AEA5] leading-tight">
                  {isBreak ? 'Step away — you earned this' : 'Timer saves to your forest & streak'}
                </p>
                {motivationPreferences.personalGoal && (
                  <p className="text-[10px] text-[#D97757] font-heading mt-0.5 truncate">{motivationPreferences.personalGoal}</p>
                )}
              </div>
              <button
                type="button"
                onClick={openStepPicker}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-[#141413] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors font-heading text-xs sm:text-sm font-medium shrink-0"
                title={todayScheduledStepCount > 0 ? 'Pick another step from today or your backlog' : 'Pick another step'}
              >
                <List className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Change step</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-10">
          {currentTask && !isBreak && currentMicroTask && (
            <div className="mb-8 bg-white rounded-xl p-5 border border-[#E8E6DC]">
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Current task</p>
              <h2 className="font-heading font-semibold text-lg text-[#141413] mb-2">{currentTask.title}</h2>
              <div className="flex items-center gap-4 text-xs text-[#B0AEA5] mb-3">
                <span>
                  Step {completedMicroTasks + 1} of {totalMicroTasks}
                </span>
                <span>•</span>
                <span>Progress {Math.round(taskProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-[#E8E6DC] rounded-full overflow-hidden">
                <div className="h-full bg-[#D97757] transition-all duration-500 rounded-full" style={{ width: `${taskProgress * 100}%` }} />
              </div>
            </div>
          )}

          {isBreak && anchorTask && !currentMicroTask && (
            <div className="mb-8 bg-white rounded-xl p-5 border border-[#E8E6DC]">
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Taking a break from</p>
              <h2 className="font-heading font-semibold text-lg text-[#141413]">{anchorTask.title}</h2>
            </div>
          )}

          <div className="bg-white rounded-xl p-8 border border-[#E8E6DC]">
            {sessionWrapUp ? (
              <div className="flex flex-col items-center max-w-lg mx-auto text-center py-2">
                <CheckCircle2 className="w-14 h-14 text-[#788C5D] mb-4" aria-hidden />
                <h2 className="font-heading font-bold text-xl text-[#141413] mb-2">Session complete</h2>
                <p className="text-sm text-[#B0AEA5] mb-4 leading-relaxed">
                  You focused for {sessionWrapUp.focusMinutes} minutes. That time is saved and counts toward your Growth
                  Forest—separate from whether the step is finished.
                </p>
                {currentMicroTask ? (
                  <p className="text-sm text-[#141413] font-heading font-medium mb-6 px-2">
                    Step: &ldquo;{currentMicroTask.title}&rdquo;
                  </p>
                ) : null}
                <div className="flex flex-col sm:flex-row gap-3 w-full mb-4">
                  <button
                    type="button"
                    onClick={handleMarkStepDoneAfterSession}
                    className="flex-1 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                  >
                    Mark step done
                  </button>
                  <button
                    type="button"
                    onClick={proceedToBreakAfterWrap}
                    className="flex-1 px-6 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold hover:bg-[#FAF9F5] transition-colors"
                  >
                    Still on this step
                  </button>
                </div>
                <p className="text-xs text-[#B0AEA5] mb-6">
                  Next, press <span className="font-heading font-semibold text-[#141413]">Start break</span> on the timer
                  when you are ready. Honesty beats checking boxes early.
                </p>
                <div className="w-full max-w-sm">
                  <TreeForest variant="compact" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-64 h-64 mb-8">
                  <svg className="transform -rotate-90 w-64 h-64">
                    <circle cx="128" cy="128" r={radius} stroke="#E8E6DC" strokeWidth="10" fill="none" />
                    <circle
                      cx="128"
                      cy="128"
                      r={radius}
                      stroke={isBreak ? '#D97757' : '#141413'}
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-700"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-heading font-bold text-[#141413] mb-1">{formatTime(timeLeft)}</span>
                    <span className="text-xs font-heading text-[#B0AEA5]">{isBreak ? 'Break session' : 'Focus session'}</span>
                  </div>
                </div>

                {!isBreak && currentMicroTask && (
                  <div className="w-full max-w-xl text-center mb-8">
                    <p className="text-xs text-[#B0AEA5] font-heading mb-2 uppercase tracking-wide">Current step</p>
                    <p className="font-heading font-semibold text-lg text-[#141413] mb-2">{currentMicroTask.title}</p>
                    {currentMicroTask.description && <p className="text-sm text-[#B0AEA5] mb-4 whitespace-pre-line">{currentMicroTask.description}</p>}
                    {currentMicroTask.unitSectionLabel ? (
                      <p className="text-xs text-[#6A9BCC] font-heading mb-2">{currentMicroTask.unitSectionLabel}</p>
                    ) : null}
                    {currentMicroTask.subtopics && currentMicroTask.subtopics.length > 0 ? (
                      <div className="text-left max-w-lg mx-auto mb-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] p-3">
                        <p className="text-[11px] font-heading text-[#B0AEA5] mb-2 uppercase tracking-wide">
                          In this block (any order)
                        </p>
                        <ul className="text-sm text-[#141413] space-y-1.5 list-disc list-inside">
                          {currentMicroTask.subtopics.map((st) => (
                            <li key={st}>{st}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
                      <Clock className="w-4 h-4 text-[#D97757]" />
                      <span className="text-xs font-heading text-[#141413]">~{currentMicroTask.estimatedMinutes} minutes</span>
                    </div>
                  </div>
                )}

                {isBreak && (
                  <div className="w-full max-w-xl text-center mb-8">
                    <p className="font-heading font-semibold text-lg text-[#141413] mb-2">Break time</p>
                    <p className="text-sm text-[#B0AEA5]">Look away from the screen, stretch, or grab some water while the timer runs.</p>
                  </div>
                )}

                <div className="w-full max-w-xl mb-8">
                  <div className="bg-[#FAF9F5] border border-[#E8E6DC] rounded-xl p-4 text-center">
                    {motivationPreferences.personalGoal ? <p className="text-xs font-heading text-[#B0AEA5] mb-1">Your goal</p> : null}
                    {motivationPreferences.personalGoal ? (
                      <p className="text-sm font-heading font-semibold text-[#141413] mb-2">{motivationPreferences.personalGoal}</p>
                    ) : null}
                    <div className="border-l-4 border-[#D97757] pl-4 text-left">
                      <p className="text-sm text-[#141413] font-body italic leading-relaxed">{motivationLine}</p>
                    </div>
                  </div>
                </div>

                {!isBreak && (
                  <button
                    type="button"
                    onClick={() => setShowQuickNote(true)}
                    className="fixed bottom-24 right-4 md:bottom-8 md:right-10 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#141413] text-white shadow-lg border border-[#141413] hover:bg-[#2a2a28]"
                    aria-label="Quick note"
                  >
                    <NotebookPen className="w-4 h-4" />
                    <span className="font-heading text-sm pr-1">Note</span>
                  </button>
                )}

                {!isBreak && (
                  <div className="w-full max-w-sm mx-auto mb-8">
                    <TreeForest variant="compact" extraGrowthMinutes={liveFocusMinutes} />
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  {!isRunning ? (
                    <button
                      onClick={handleStart}
                      className="flex items-center gap-2 px-8 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      {isBreak ? 'Start break' : 'Start focus'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePause}
                        className="flex items-center gap-2 px-6 py-3 bg-[#D97757] text-white rounded-lg font-heading font-medium hover:bg-[#c96a4d] transition-colors"
                      >
                        <Pause className="w-5 h-5" />
                        Pause
                      </button>
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
                      >
                        <Square className="w-5 h-5" />
                        Stop
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isBreak && currentMicroTask && nextUp && nextUp.microTask.id !== currentMicroTask.id && (
            <div className="mt-6 bg-white rounded-xl p-4 border border-[#E8E6DC]">
              <p className="text-xs text-[#B0AEA5] font-heading mb-1">Next step</p>
              <p className="font-heading font-medium text-sm text-[#141413]">{nextUp.microTask.title}</p>
            </div>
          )}

          {isBreak && (
            <div className="mt-8">
              <MoodTracker pomodoroSessionId={currentPomodoro?.id} />
            </div>
          )}
        </main>
      </div>
      <TaskSelectionModal
        isOpen={showTaskSelection}
        onClose={() => setShowTaskSelection(false)}
        scheduleScope={taskPickerScope}
      />
      {showQuickNote && (
        <div className="fixed inset-0 bg-[#141413]/30 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#E8E6DC] p-4">
            <h3 className="font-heading font-semibold text-[#141413] mb-2">Quick note</h3>
            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413]"
              placeholder="Write a quick note for this study block..."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowQuickNote(false)}
                className="px-3 py-2 border border-[#E8E6DC] rounded-lg text-[#141413] hover:bg-[#FAF9F5]"
              >
                Cancel
              </button>
              <button
                onClick={saveQuickNote}
                className="px-3 py-2 bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function FocusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-10 h-10 text-[#B0AEA5] mx-auto mb-4 animate-pulse" />
            <p className="text-[#B0AEA5] font-heading text-sm">Loading Focus Mode...</p>
          </div>
        </div>
      }
    >
      <FocusModeContent />
    </Suspense>
  );
}

