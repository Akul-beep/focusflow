'use client';

import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, Play, Pause, Square, Sparkles, Clock, List, Coins } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Task, MicroTask, PomodoroSession } from '@/types';
import Link from 'next/link';
import MoodTracker from '@/components/MoodTracker';
import { generateMotivationalMessage } from '@/components/MotivationalMessages';
import TaskSelectionModal from '@/components/TaskSelectionModal';
import { makeId } from '@/lib/ids';
import { isSameDay } from 'date-fns';
import TreeForest from '@/components/TreeForest';

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
    stats,
    schedulePreferences,
    motivationPreferences,
  } = useStore();

  const [timeLeft, setTimeLeft] = useState(schedulePreferences.defaultSessionMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showTaskSelection, setShowTaskSelection] = useState(false);

  const getNextMicroTask = (taskList: Task[]): { task: Task; microTask: MicroTask } | null => {
    const allMicroTasks: Array<{ task: Task; microTask: MicroTask; when: number }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    taskList
      .filter((t) => !t.completed)
      .map((task) => ({
        ...task,
        dueDate: task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate),
      }))
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      })
      .forEach((task) => {
        task.microTasks
          .filter((mt) => !mt.completed)
          .sort((a, b) => a.order - b.order)
          .forEach((microTask) => {
            const scheduledStart = microTask.scheduledStart ? new Date(microTask.scheduledStart) : null;
            const scheduledDate = microTask.scheduledDate ? new Date(microTask.scheduledDate) : null;
            const isTodayTask =
              (scheduledStart && isSameDay(scheduledStart, today)) ||
              (!scheduledStart && scheduledDate && isSameDay(scheduledDate, today));
            const when = scheduledStart ? scheduledStart.getTime() : isTodayTask ? today.getTime() : Number.MAX_SAFE_INTEGER;
            allMicroTasks.push({ task, microTask, when });
          });
      });

    allMicroTasks.sort((a, b) => a.when - b.when);
    return allMicroTasks[0] ? { task: allMicroTasks[0].task, microTask: allMicroTasks[0].microTask } : null;
  };

  const taskId = searchParams?.get('task') || '';
  const microTaskId = searchParams?.get('micro') || '';

  const currentTask = taskId ? tasks.find((t) => t.id === taskId) || null : null;
  const currentMicroTask =
    currentTask && microTaskId ? currentTask.microTasks.find((mt) => mt.id === microTaskId && !mt.completed) || null : null;
  const nextUp = getNextMicroTask(tasks);

  useEffect(() => {
    if (taskId && microTaskId) return;
    const next = getNextMicroTask(tasks);
    if (next) {
      router.replace(`/focus?task=${next.task.id}&micro=${next.microTask.id}`);
    }
  }, [taskId, microTaskId, tasks, router]);

  const handleStart = () => {
    if (!currentPomodoro && currentMicroTask) {
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
        currentMicroTask.scheduledEnd && currentMicroTask.scheduledStart
          ? Math.max(5, Math.min(capByEvent, Math.ceil((currentMicroTask.scheduledEnd.getTime() - now.getTime()) / 60000)))
          : capByEvent;

      const session: PomodoroSession = {
        id: makeId('pomodoro'),
        taskId: currentTask!.id,
        microTaskId: currentMicroTask.id,
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
  };

  const handleComplete = () => {
    if (currentPomodoro && currentMicroTask) {
      const completedSession = {
        ...currentPomodoro,
        endTime: new Date(),
        completed: true,
      };
      addPomodoroSession(completedSession);
      setCurrentPomodoro(null);

      if (!isBreak) {
        completeMicroTask(currentMicroTask.id);
        updateStats();

        addMotivationalMessage({
          message: generateMotivationalMessage('progress', currentMicroTask.title, stats),
          type: 'progress',
        });

        const next = getNextMicroTask(useStore.getState().tasks);
        if (next) {
          router.replace(`/focus?task=${next.task.id}&micro=${next.microTask.id}`);
        }

        setIsBreak(true);
        setTimeLeft(schedulePreferences.breakMinutes * 60);
      } else {
        setIsBreak(false);
        setTimeLeft(schedulePreferences.defaultSessionMinutes * 60);
      }
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, currentPomodoro, currentMicroTask, isBreak]);

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

  const liveSessionCoins = Math.floor(liveFocusMinutes); // +1 coin per focus minute (live preview)

  const motivationLine = (() => {
    if (isBreak) return 'Breathe. Small breaks make big focus possible.';
    const stage = !isRunning ? 'start' : timeLeft <= 60 ? 'finish' : progress >= 0.5 ? 'mid' : 'start';
    const poolByStage: Record<typeof stage, string[]> = {
      start: [
        'Start now. Earn the first coins.',
        'One session. One win. Begin.',
        'Five minutes. Start the engine.',
      ],
      mid: [
        'Halfway. Don’t drop the streak now.',
        'Stay locked. Your future is being built.',
        'Keep going—momentum is priceless.',
      ],
      finish: [
        'Last minute—finish and collect the win.',
        'Close it. Coins + progress.',
        'Finish strong. Then breathe.',
      ],
    };
    const pool = poolByStage[stage];
    const seed = (currentMicroTask?.id?.length || 0) + stage.length * 13;
    return pool[seed % pool.length];
  })();

  if (!currentMicroTask) {
    return (
      <>
        <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center bg-white rounded-xl border border-[#E8E6DC] p-8">
            <h1 className="font-heading font-bold text-2xl text-[#141413] mb-3">No active task</h1>
            <p className="text-[#B0AEA5] mb-6 font-body text-sm">
              Add a task on your dashboard, then come back here to start a focus session.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
        <TaskSelectionModal isOpen={showTaskSelection} onClose={() => setShowTaskSelection(false)} />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#FAF9F5]">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-[#141413] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors font-heading text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <div className="text-center">
                <h1 className="font-heading font-bold text-xl text-[#141413]">{isBreak ? 'Break Time' : 'Focus Mode'}</h1>
                <p className="text-xs text-[#B0AEA5]">{isBreak ? 'Relax for a few minutes' : 'Work in a short focused session'}</p>
                {motivationPreferences.personalGoal && (
                  <p className="text-xs text-[#D97757] font-heading mt-1">{motivationPreferences.personalGoal}</p>
                )}
              </div>
              <button
                onClick={() => setShowTaskSelection(true)}
                className="flex items-center gap-2 px-3 py-2 text-[#141413] hover:text-[#D97757] hover:bg-[#FAF9F5] rounded-lg transition-colors font-heading text-sm"
              >
                <List className="w-4 h-4" />
                <span>Change task</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-10">
          {currentTask && !isBreak && (
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

          <div className="bg-white rounded-xl p-8 border border-[#E8E6DC]">
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
                  {currentMicroTask.description && <p className="text-sm text-[#B0AEA5] mb-4">{currentMicroTask.description}</p>}
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
                <div className="w-full max-w-xl mb-8">
                  <div className="flex items-center justify-between bg-white border border-[#E8E6DC] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-[#D97757]" />
                      <span className="text-xs font-heading text-[#B0AEA5]">FocusCoins</span>
                    </div>
                    <div className="text-sm font-heading font-semibold text-[#141413]">
                      {stats.focusCoins} <span className="text-[#B0AEA5] font-semibold">• L{stats.level}</span>
                      {isRunning ? <span className="text-[#D97757] font-semibold"> • +{liveSessionCoins}</span> : null}
                    </div>
                  </div>
                </div>
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
      <TaskSelectionModal isOpen={showTaskSelection} onClose={() => setShowTaskSelection(false)} />
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

