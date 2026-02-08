'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Square, Coffee } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PomodoroSession } from '@/types';

interface PomodoroTimerProps {
  taskId: string;
  microTaskId?: string;
  onComplete?: () => void;
}

export default function PomodoroTimer({ taskId, microTaskId, onComplete }: PomodoroTimerProps) {
  const { currentPomodoro, setCurrentPomodoro, addPomodoroSession } = useStore();
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const handleComplete = () => {
    if (currentPomodoro) {
      const completedSession = {
        ...currentPomodoro,
        endTime: new Date(),
        completed: true,
      };
      addPomodoroSession(completedSession);
      setCurrentPomodoro(null);
      
      if (!isBreak) {
        setIsBreak(true);
        setTimeLeft(5 * 60); // 5 minute break
        if (onComplete) onComplete();
      } else {
        setIsBreak(false);
        setTimeLeft(25 * 60);
      }
    }
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isRunning, timeLeft, currentPomodoro, isBreak, addPomodoroSession, setCurrentPomodoro, onComplete]);

  const handleStart = () => {
    if (!currentPomodoro) {
      const session: PomodoroSession = {
        id: `pomodoro-${Date.now()}`,
        taskId,
        microTaskId,
        duration: isBreak ? 5 : 25,
        startTime: new Date(),
        completed: false,
        type: isBreak ? 'break' : 'focus',
      };
      setCurrentPomodoro(session);
      setTimeLeft((isBreak ? 5 : 25) * 60);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setCurrentPomodoro(null);
    setTimeLeft(25 * 60);
    setIsBreak(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((isBreak ? 5 * 60 : 25 * 60) - timeLeft) / (isBreak ? 5 * 60 : 25 * 60);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E8E6DC]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
          {isBreak ? (
            <Coffee className="w-5 h-5 text-[#141413]" />
          ) : (
            <div className="w-5 h-5 rounded border-2 border-[#141413]" />
          )}
        </div>
        <div>
          <h3 className="font-heading font-semibold text-base text-[#141413]">
            {isBreak ? 'Break Session' : 'Focus Session'}
          </h3>
          <p className="text-xs text-[#B0AEA5]">Pomodoro timer</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative w-48 h-48">
          <svg className="transform -rotate-90 w-48 h-48">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="#E8E6DC"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={isBreak ? '#D97757' : '#141413'}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-heading font-semibold text-[#141413]">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#B0AEA5] text-white rounded-lg font-heading font-medium hover:bg-[#9a988f] transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
