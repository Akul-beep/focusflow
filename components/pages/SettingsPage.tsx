'use client';

import { format } from 'date-fns';
import { flushSyncPushToCloud, useStore } from '@/lib/store';
import {
  clearFocusflowStorageForSuffix,
  FOCUSFLOW_ZUSTAND_PERSIST_NAME,
  getFocusflowStorageSuffix,
} from '@/lib/focusflow-storage-scope';
import { parseLocalDateKey } from '@/lib/local-date';
import { useAuth } from '@/components/AuthProvider';
import { signOutAndRedirectToLogin } from '@/lib/auth-actions';
import Sidebar from '@/components/Sidebar';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Bell,
  Shield,
  Target,
  LogIn,
  LogOut,
  MessageSquareText,
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Moon,
  Sun,
  KeyRound,
} from 'lucide-react';
import { applyThemePreference, readThemePreference, type ThemePreference } from '@/lib/theme';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { STUDENT_GRADE_CUSTOM, STUDENT_GRADE_OPTION_VALUES } from '@/lib/grade-options';
import { useFeedback } from '@/components/FeedbackProvider';
import { isPosthogConfigured } from '@/lib/posthog-config';

export default function SettingsPage() {
  const {
    stats,
    schedulePreferences,
    updateSchedulePreferences,
    motivationPreferences,
    updateMotivationPreferences,
    updateWeeklyGoal,
    isSyncing,
    lastSync,
    syncError,
    syncFromSupabase,
    rebalanceSchedule,
    removeNoTaskSchedulingDate,
    clearAllTasksAndEvents,
    clearAllExams,
    recordGettingStartedVisitedSettings,
  } = useStore();
  const { user, authLoading } = useAuth();
  const { openFeedback } = useFeedback();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTasksEventsConfirm, setDeleteTasksEventsConfirm] = useState('');
  const [deleteExamsConfirm, setDeleteExamsConfirm] = useState('');
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readThemePreference());
  const [groqKeyDraft, setGroqKeyDraft] = useState('');
  const [groqKeyBusy, setGroqKeyBusy] = useState(false);
  const [groqKeyNotice, setGroqKeyNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [aiQuotaUi, setAiQuotaUi] = useState<{
    configured: boolean;
    sharedAi: { limit: number; used: number; byok: boolean } | null;
  } | null>(null);

  useEffect(() => {
    recordGettingStartedVisitedSettings();
  }, [recordGettingStartedVisitedSettings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/gemini', { credentials: 'same-origin' });
        const d = (await r.json()) as {
          configured?: boolean;
          sharedAi?: { limit: number; used: number; byok: boolean } | null;
        };
        if (cancelled) return;
        setAiQuotaUi({
          configured: !!d.configured,
          sharedAi: d.sharedAi ?? null,
        });
      } catch {
        if (!cancelled) setAiQuotaUi(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutAndRedirectToLogin();
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (nextTheme: ThemePreference) => {
    setThemePreference(nextTheme);
    applyThemePreference(nextTheme);
    if (!user) return;
    try {
      await getSupabaseBrowser()
        .from('user_preferences')
        .upsert({ user_id: user.id, theme_preference: nextTheme }, { onConflict: 'user_id' });
    } catch {
      // Local preference is already applied; failing cloud write should not block UX.
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader title="Settings" subtitle="Preferences, motivation, and account" />

        <main className={PAGE_MAIN_CLASSES}>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-6">
              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#6A9BCC]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Focus Settings</h2>
                    <p className="text-sm text-[#B0AEA5]">Customize your focus experience</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#FAF9F5] rounded-lg">
                    <div>
                      <div className="font-heading font-medium text-[#141413] mb-1">Weekly Goal</div>
                      <div className="text-sm text-[#B0AEA5]">Set your weekly focus hour target</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={stats.weeklyGoal}
                        onChange={(e) => updateWeeklyGoal(parseInt(e.target.value) || 20)}
                        className="w-20 px-3 py-2 border border-[#E8E6DC] rounded-lg text-[#141413] font-heading"
                        min="1"
                        max="40"
                      />
                      <span className="text-sm text-[#B0AEA5]">hours</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-[#6A9BCC]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Appearance</h2>
                    <p className="text-sm text-[#B0AEA5]">Choose your default theme</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleThemeChange('light')}
                    className={`rounded-lg border px-3 py-3 text-sm font-heading font-medium transition-colors ${
                      themePreference === 'light'
                        ? 'border-[#D97757] bg-[#fff3ee] text-[#141413]'
                        : 'border-[#E8E6DC] bg-white text-[#5C5B56] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Sun className="h-4 w-4" />
                      Light
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleThemeChange('dark')}
                    className={`rounded-lg border px-3 py-3 text-sm font-heading font-medium transition-colors ${
                      themePreference === 'dark'
                        ? 'border-[#D97757] bg-[#fff3ee] text-[#141413]'
                        : 'border-[#E8E6DC] bg-white text-[#5C5B56] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="h-4 w-4" />
                      Dark
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleThemeChange('system')}
                    className={`rounded-lg border px-3 py-3 text-sm font-heading font-medium transition-colors ${
                      themePreference === 'system'
                        ? 'border-[#D97757] bg-[#fff3ee] text-[#141413]'
                        : 'border-[#E8E6DC] bg-white text-[#5C5B56] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Monitor className="h-4 w-4" />
                      System
                    </span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#D97757]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Scheduling Preferences</h2>
                    <p className="text-sm text-[#B0AEA5]">Tell the AI when you can work</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#FAF9F5] rounded-lg sm:col-span-2">
                    <div className="text-sm font-heading font-medium text-[#141413] mb-2">Weekday window (Mon–Fri)</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="time"
                        value={schedulePreferences.workStart}
                        onChange={(e) => updateSchedulePreferences({ ...schedulePreferences, workStart: e.target.value })}
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                      />
                      <span className="text-sm text-[#B0AEA5]">to</span>
                      <input
                        type="time"
                        value={schedulePreferences.workEnd}
                        onChange={(e) => updateSchedulePreferences({ ...schedulePreferences, workEnd: e.target.value })}
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                      />
                    </div>
                    <p className="text-xs text-[#B0AEA5] mt-2">Default study blocks on school nights.</p>
                    <div className="mt-4 text-sm font-heading font-medium text-[#141413] mb-2">Weekend window (Sat–Sun)</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="time"
                        value={schedulePreferences.weekendWorkStart ?? '10:00'}
                        onChange={(e) =>
                          updateSchedulePreferences({
                            ...schedulePreferences,
                            weekendWorkStart: e.target.value,
                          })
                        }
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                      />
                      <span className="text-sm text-[#B0AEA5]">to</span>
                      <input
                        type="time"
                        value={schedulePreferences.weekendWorkEnd ?? '18:00'}
                        onChange={(e) =>
                          updateSchedulePreferences({
                            ...schedulePreferences,
                            weekendWorkEnd: e.target.value,
                          })
                        }
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                      />
                    </div>
                    <p className="text-xs text-[#B0AEA5] mt-2">
                      If unset in older data, weekends fall back to the weekday window until you save here. The scheduler and
                      “rebalance week” use this for Saturday and Sunday.
                    </p>
                  </div>

                  <div className="p-4 bg-[#FAF9F5] rounded-lg">
                    <div className="text-sm font-heading font-medium text-[#141413] mb-2">Session pacing</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-[#B0AEA5] mb-1">Session</div>
                        <input
                          type="number"
                          min={15}
                          max={90}
                          value={schedulePreferences.defaultSessionMinutes}
                          onChange={(e) =>
                            updateSchedulePreferences({
                              ...schedulePreferences,
                              defaultSessionMinutes: parseInt(e.target.value) || 30,
                            })
                          }
                          className="w-full px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-[#B0AEA5] mb-1">Break</div>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={schedulePreferences.breakMinutes}
                          onChange={(e) =>
                            updateSchedulePreferences({
                              ...schedulePreferences,
                              breakMinutes: parseInt(e.target.value) || 10,
                            })
                          }
                          className="w-full px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-[#B0AEA5] mb-1">Buffer</div>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={schedulePreferences.bufferMinutes}
                          onChange={(e) =>
                            updateSchedulePreferences({
                              ...schedulePreferences,
                              bufferMinutes: parseInt(e.target.value) || 5,
                            })
                          }
                          className="w-full px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[#B0AEA5] mt-2">Used to avoid overload and overlap.</p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-[#FAF9F5] rounded-lg">
                  <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                    Study pace
                  </label>
                  <select
                    value={schedulePreferences.studyPace || 'balanced'}
                    onChange={(e) =>
                      updateSchedulePreferences({
                        ...schedulePreferences,
                        studyPace: e.target.value as 'light' | 'balanced' | 'intensive',
                      })
                    }
                    className="w-full max-w-md px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                  >
                    <option value="light">Light (lower daily load, shorter suggested sessions)</option>
                    <option value="balanced">Balanced (recommended default)</option>
                    <option value="intensive">Intensive (higher load if needed)</option>
                  </select>
                  <p className="text-xs text-[#B0AEA5] mt-2">
                    Used by AI time estimates and daily scheduling caps.
                  </p>
                </div>

                <div className="mt-4 p-4 bg-[#FAF9F5] rounded-lg">
                  <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                    Grade / program
                  </label>
                  <select
                    value={
                      STUDENT_GRADE_OPTION_VALUES.includes(String(schedulePreferences.gradeLevel ?? '').trim())
                        ? String(schedulePreferences.gradeLevel).trim()
                        : STUDENT_GRADE_CUSTOM
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      updateSchedulePreferences({
                        ...schedulePreferences,
                        gradeLevel: v === STUDENT_GRADE_CUSTOM ? '' : v,
                      });
                    }}
                    className="w-full max-w-md px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                  >
                    {STUDENT_GRADE_OPTION_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    <option value={STUDENT_GRADE_CUSTOM}>Other (type below)</option>
                  </select>
                  {!STUDENT_GRADE_OPTION_VALUES.includes(String(schedulePreferences.gradeLevel ?? '').trim()) ? (
                    <input
                      type="text"
                      value={schedulePreferences.gradeLevel ?? ''}
                      onChange={(e) =>
                        updateSchedulePreferences({
                          ...schedulePreferences,
                          gradeLevel: e.target.value,
                        })
                      }
                      placeholder="e.g. University, A-Level, homeschool"
                      className="mt-2 w-full max-w-md px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413]"
                    />
                  ) : null}
                  <p className="text-xs text-[#B0AEA5] mt-2">
                    Used when the exam planner asks the AI how long each topic should take — simple topics get shorter
                    estimates than heavy ones, scaled for your level. Blank defaults to year 10 for exam math.
                  </p>
                </div>

                <div className="mt-4 p-4 bg-[#FAF9F5] rounded-lg">
                  <div className="text-sm font-heading font-medium text-[#141413] mb-1">Rebalance schedule</div>
                  <p className="text-xs text-[#B0AEA5] mb-3">
                    Pack open tasks around your events and work hours again. Nothing is removed—only start and end times
                    (and sometimes the day) may change before each due date.
                  </p>
                  <button
                    type="button"
                    onClick={() => rebalanceSchedule()}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 text-sm font-heading font-semibold bg-[#141413] border border-[#141413] rounded-lg text-white hover:bg-[#2a2a28] transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rebalance now
                  </button>
                </div>

                {(schedulePreferences.noTaskSchedulingDates?.length ?? 0) > 0 ? (
                  <div className="mt-4 p-4 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
                    <div className="text-sm font-heading font-medium text-[#141413] mb-1">No-scheduling days</div>
                    <p className="text-xs text-[#B0AEA5] mb-3">
                      The planner will not pack tasks onto these dates (e.g. after you tapped “Couldn’t study” on the
                      calendar). Remove a date when you want it available again.
                    </p>
                    <ul className="space-y-2">
                      {schedulePreferences.noTaskSchedulingDates!.map((k) => (
                        <li
                          key={k}
                          className="flex items-center justify-between gap-3 text-sm font-heading text-[#141413]"
                        >
                          <span>{format(parseLocalDateKey(k), 'EEE, MMM d, yyyy')}</span>
                          <button
                            type="button"
                            onClick={() => removeNoTaskSchedulingDate(k)}
                            className="text-[#D97757] text-xs font-heading font-medium hover:underline shrink-0"
                          >
                            Allow scheduling
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-6 pt-6 border-t border-[#E8E6DC]">
                  <div className="text-sm font-heading font-medium text-[#141413] mb-2">Calendar colors</div>
                  <p className="text-xs text-[#B0AEA5] mb-3">Tint for events vs. scheduled task blocks on the Calendar page.</p>
                  <div className="flex flex-wrap gap-6 items-center">
                    <label className="flex items-center gap-2 text-sm font-heading text-[#141413]">
                      Events
                      <input
                        type="color"
                        value={schedulePreferences.calendarEventColor || '#141413'}
                        onChange={(e) =>
                          updateSchedulePreferences({
                            ...schedulePreferences,
                            calendarEventColor: e.target.value,
                          })
                        }
                        className="h-9 w-14 cursor-pointer rounded border border-[#E8E6DC] bg-white p-0.5"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-heading text-[#141413]">
                      Tasks
                      <input
                        type="color"
                        value={schedulePreferences.calendarTaskColor || '#6A9BCC'}
                        onChange={(e) =>
                          updateSchedulePreferences({
                            ...schedulePreferences,
                            calendarTaskColor: e.target.value,
                          })
                        }
                        className="h-9 w-14 cursor-pointer rounded border border-[#E8E6DC] bg-white p-0.5"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-[#6A9BCC]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Motivation</h2>
                    <p className="text-sm text-[#B0AEA5]">A short message that keeps you going</p>
                  </div>
                </div>

                <div className="p-4 bg-[#FAF9F5] rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-heading font-medium text-[#141413] mb-2">Personal goal (optional)</label>
                    <input
                      value={motivationPreferences.personalGoal || ''}
                      onChange={(e) => updateMotivationPreferences({ ...motivationPreferences, personalGoal: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] font-body"
                      placeholder='Example: "Getting into an Ivy League"'
                    />
                    <p className="text-xs text-[#B0AEA5] mt-2">This appears in Focus Mode and Daily Motivation.</p>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer p-4 bg-white rounded-lg border border-[#E8E6DC]">
                    <input
                      type="checkbox"
                      checked={!!motivationPreferences.dailyBriefingEnabled}
                      onChange={(e) =>
                        updateMotivationPreferences({
                          ...motivationPreferences,
                          dailyBriefingEnabled: e.target.checked,
                        })
                      }
                      className="mt-1 rounded border-[#E8E6DC] text-[#D97757] focus:ring-[#D97757]"
                    />
                    <span>
                      <span className="block text-sm font-heading font-medium text-[#141413]">Morning briefing</span>
                      <span className="block text-xs text-[#B0AEA5] mt-1">
                        Optional summary when you open the app (once per day). Off by default so you can start fast.
                      </span>
                    </span>
                  </label>

                  <div className="p-4 bg-white rounded-lg border border-[#E8E6DC] space-y-2">
                    <div className="text-sm font-heading font-semibold text-[#141413]">How progress is counted</div>
                    <p className="text-xs text-[#B0AEA5] leading-relaxed">
                      Growth Forest grows from focus time and completed steps. Focus streak counts days with a completed
                      focus session. Levels and totals are on Analytics.
                    </p>
                    <p className="text-xs text-[#B0AEA5] leading-relaxed">
                      FocusCoins: <span className="text-[#141413] font-semibold">+1</span> per focus minute,{' '}
                      <span className="text-[#141413] font-semibold">+5</span> per step,{' '}
                      <span className="text-[#141413] font-semibold">+20</span> per task. Undo reverses them.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                    <MessageSquareText className="w-5 h-5 text-[#D97757]" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Feedback</h2>
                    <p className="text-sm text-[#B0AEA5]">Bugs, ideas, or rough edges</p>
                  </div>
                </div>
                <p className="text-xs text-[#B0AEA5] leading-relaxed mb-4">
                  {isPosthogConfigured()
                    ? 'We use PostHog to receive your message securely with the page you were on.'
                    : 'Add NEXT_PUBLIC_POSTHOG_KEY to your environment to send feedback from the app; you can still use the product normally.'}
                </p>
                <button
                  type="button"
                  onClick={() => openFeedback({ kind: 'general' })}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28] transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageSquareText className="w-4 h-4" aria-hidden />
                  Open feedback form
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#788C5D]/12 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-[#788C5D]" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">AI assistant</h2>
                    <p className="text-sm text-[#B0AEA5]">Optional: your own Groq key keeps quality high across devices</p>
                  </div>
                </div>

                {!user ? (
                  <p className="text-sm text-[#5C5B56] leading-relaxed">
                    Sign in to save a personal Groq API key to your account (encrypted on our servers). Until then, the
                    app uses the shared key when available, with a small daily limit per account.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {aiQuotaUi?.sharedAi && !aiQuotaUi.sharedAi.byok && aiQuotaUi.sharedAi.limit > 0 ? (
                      <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#E8E6DC] text-sm text-[#141413]">
                        <span className="font-heading font-medium">Included AI today: </span>
                        <span>
                          {aiQuotaUi.sharedAi.used} / {aiQuotaUi.sharedAi.limit} uses (resets daily, UTC).
                        </span>
                        <p className="text-xs text-[#B0AEA5] mt-2 leading-relaxed">
                          Add your key below to route scheduling through your own free Groq quota—same experience on every
                          device you sign in on.
                        </p>
                      </div>
                    ) : null}
                    {aiQuotaUi?.sharedAi?.byok ? (
                      <div className="p-4 rounded-lg bg-[#E8F4E8]/40 border border-[#E8E6DC] text-sm text-[#141413]">
                        <span className="font-heading font-medium">Your Groq key is saved.</span>
                        <span className="text-[#5C5B56]"> AI runs on your key (not the shared daily limit).</span>
                      </div>
                    ) : null}

                    <p className="text-xs text-[#B0AEA5] leading-relaxed">
                      Create a free key at{' '}
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#D97757] font-medium hover:underline"
                      >
                        console.groq.com/keys
                      </a>
                      . Paste it here once; we encrypt it and never show it back in the UI.
                    </p>

                    <input
                      type="password"
                      autoComplete="off"
                      value={groqKeyDraft}
                      onChange={(e) => {
                        setGroqKeyDraft(e.target.value);
                        setGroqKeyNotice(null);
                      }}
                      placeholder="gsk_…"
                      className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg font-mono text-sm text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#D97757]"
                    />

                    {groqKeyNotice ? (
                      <p
                        className={`text-sm ${groqKeyNotice.tone === 'ok' ? 'text-[#788C5D]' : 'text-[#D97757]'}`}
                        role="status"
                      >
                        {groqKeyNotice.text}
                      </p>
                    ) : null}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={groqKeyBusy || !groqKeyDraft.trim()}
                        onClick={() => {
                          void (async () => {
                            setGroqKeyBusy(true);
                            setGroqKeyNotice(null);
                            try {
                              const res = await fetch('/api/user/groq-key', {
                                method: 'POST',
                                credentials: 'same-origin',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ key: groqKeyDraft.trim() }),
                              });
                              const j = (await res.json().catch(() => ({}))) as { error?: string };
                              if (!res.ok) {
                                setGroqKeyNotice({
                                  tone: 'err',
                                  text: j.error || 'Could not save. Check the key and try again.',
                                });
                                return;
                              }
                              setGroqKeyDraft('');
                              setGroqKeyNotice({ tone: 'ok', text: 'Saved. Your next AI request will use your key.' });
                              const r = await fetch('/api/gemini', { credentials: 'same-origin' });
                              const d = (await r.json()) as {
                                configured?: boolean;
                                sharedAi?: { limit: number; used: number; byok: boolean } | null;
                              };
                              setAiQuotaUi({
                                configured: !!d.configured,
                                sharedAi: d.sharedAi ?? null,
                              });
                            } catch {
                              setGroqKeyNotice({ tone: 'err', text: 'Network error. Try again.' });
                            } finally {
                              setGroqKeyBusy(false);
                            }
                          })();
                        }}
                        className="flex-1 px-5 py-2.5 rounded-lg bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {groqKeyBusy ? 'Saving…' : 'Save Groq key'}
                      </button>
                      <button
                        type="button"
                        disabled={groqKeyBusy}
                        onClick={() => {
                          void (async () => {
                            setGroqKeyBusy(true);
                            setGroqKeyNotice(null);
                            try {
                              const res = await fetch('/api/user/groq-key', {
                                method: 'DELETE',
                                credentials: 'same-origin',
                              });
                              if (!res.ok) {
                                setGroqKeyNotice({ tone: 'err', text: 'Could not remove key.' });
                                return;
                              }
                              setGroqKeyNotice({ tone: 'ok', text: 'Removed. You are back on the shared limit.' });
                              const r = await fetch('/api/gemini', { credentials: 'same-origin' });
                              const d = (await r.json()) as {
                                configured?: boolean;
                                sharedAi?: { limit: number; used: number; byok: boolean } | null;
                              };
                              setAiQuotaUi({
                                configured: !!d.configured,
                                sharedAi: d.sharedAi ?? null,
                              });
                            } catch {
                              setGroqKeyNotice({ tone: 'err', text: 'Network error. Try again.' });
                            } finally {
                              setGroqKeyBusy(false);
                            }
                          })();
                        }}
                        className="flex-1 px-5 py-2.5 rounded-lg border border-[#E8E6DC] bg-white text-[#141413] font-heading font-semibold text-sm hover:bg-[#FAF9F5] transition-colors disabled:opacity-45"
                      >
                        Remove saved key
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#6A9BCC]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Account</h2>
                    <p className="text-sm text-[#B0AEA5]">Sign in to sync your data across devices</p>
                  </div>
                </div>

                {authLoading && !user ? (
                  <div className="p-4 bg-[#FAF9F5] rounded-lg flex items-center gap-3 text-sm text-[#B0AEA5]">
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-[#6A9BCC]" aria-hidden />
                    <span>Checking sign-in…</span>
                  </div>
                ) : user ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#FAF9F5] rounded-lg">
                      <div className="text-sm text-[#B0AEA5] mb-1">Signed in as</div>
                      <div className="font-heading font-semibold text-[#141413]">{user.email || user.name || 'User'}</div>
                    </div>

                    {/* Sync Status */}
                    <div className="p-4 bg-[#FAF9F5] rounded-lg border border-[#E8E6DC]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-heading font-medium text-[#141413]">Data Sync</div>
                        {isSyncing ? (
                          <RefreshCw className="w-4 h-4 text-[#6A9BCC] animate-spin" />
                        ) : syncError ? (
                          <AlertCircle className="w-4 h-4 text-[#D97757]" />
                        ) : lastSync ? (
                          <CheckCircle2 className="w-4 h-4 text-[#788C5D]" />
                        ) : null}
                      </div>
                      {isSyncing ? (
                        <div className="text-xs text-[#B0AEA5]">Syncing...</div>
                      ) : syncError ? (
                        <div className="text-xs text-[#D97757]">{syncError}</div>
                      ) : lastSync ? (
                        <div className="text-xs text-[#B0AEA5]">
                          Last synced: {new Date(lastSync).toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-xs text-[#B0AEA5]">Not synced yet</div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => void flushSyncPushToCloud().catch(() => {})}
                          disabled={isSyncing}
                          className="flex-1 px-3 py-2 text-xs font-heading font-medium bg-white border border-[#E8E6DC] text-[#141413] rounded-lg hover:bg-[#FAF9F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => syncFromSupabase()}
                          disabled={isSyncing}
                          className="flex-1 px-3 py-2 text-xs font-heading font-medium bg-white border border-[#E8E6DC] text-[#141413] rounded-lg hover:bg-[#FAF9F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Download
                        </button>
                      </div>
                      <p className="text-[11px] text-[#B0AEA5] mt-2 leading-relaxed">
                        Each account has its own cloud copy. This device clears the previous account’s local cache when you
                        sign out (your cloud data stays). On a new browser, sign in and tap Download to pull it down.
                      </p>
                    </div>

                    <button
                      onClick={handleSignOut}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold hover:bg-[#FAF9F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="w-4 h-4" />
                      {loading ? 'Signing out...' : 'Sign Out'}
                    </button>
                    <Link
                      href="/upgrade"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                    >
                      Upgrade to Pro - ₹199/mo
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[#5C5B56] leading-relaxed">
                      Use the sign-in page with <span className="font-medium text-[#141413]">email and password</span> or{' '}
                      <span className="font-medium text-[#141413]">Google</span>. After you sign in, you’ll return here and
                      your data can sync to the cloud.
                    </p>
                    <Link
                      href="/login?next=%2Fsettings"
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      Go to sign in
                    </Link>
                    <p className="text-xs text-[#B0AEA5]">
                      No account yet?{' '}
                      <Link href="/signup?next=%2Fsettings" className="font-heading font-medium text-[#D97757] hover:underline">
                        Create one
                      </Link>
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#141413]/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#141413]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Reset</h2>
                    <p className="text-sm text-[#B0AEA5]">Clear local data and start fresh</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm('This will clear all local tasks, events, and stats on this device. Continue?')) {
                      clearFocusflowStorageForSuffix(getFocusflowStorageSuffix() ?? 'local');
                      localStorage.removeItem(FOCUSFLOW_ZUSTAND_PERSIST_NAME);
                      window.location.reload();
                    }
                  }}
                  className="px-5 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold hover:bg-[#FAF9F5]"
                >
                  Reset local data
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#D97757]/12 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-[#D97757]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Danger zone</h2>
                    <p className="text-sm text-[#B0AEA5]">Type DELETE to confirm irreversible actions</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-[#E8E6DC] p-4 bg-[#FAF9F5]">
                    <div className="text-sm font-heading font-medium text-[#141413]">Delete all tasks and events</div>
                    <p className="text-xs text-[#B0AEA5] mt-1 mb-3">
                      Removes all tasks (including steps) and calendar events from this account.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input
                        value={deleteTasksEventsConfirm}
                        onChange={(e) => setDeleteTasksEventsConfirm(e.target.value)}
                        placeholder='Type "DELETE"'
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413] w-full sm:w-56"
                      />
                      <button
                        type="button"
                        disabled={deleteTasksEventsConfirm.trim().toUpperCase() !== 'DELETE'}
                        onClick={() => {
                          clearAllTasksAndEvents();
                          setDeleteTasksEventsConfirm('');
                        }}
                        className="px-4 py-2 text-sm font-heading font-semibold rounded-lg border border-[#D97757]/40 text-[#D97757] disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[#fff5f1]"
                      >
                        Delete tasks + events
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#E8E6DC] p-4 bg-[#FAF9F5]">
                    <div className="text-sm font-heading font-medium text-[#141413]">Delete all exam syllabuses</div>
                    <p className="text-xs text-[#B0AEA5] mt-1 mb-3">
                      Removes all exam syllabus entries and exam-planner generated tasks.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input
                        value={deleteExamsConfirm}
                        onChange={(e) => setDeleteExamsConfirm(e.target.value)}
                        placeholder='Type "DELETE"'
                        className="px-3 py-2 border border-[#E8E6DC] rounded-lg font-heading text-sm text-[#141413] w-full sm:w-56"
                      />
                      <button
                        type="button"
                        disabled={deleteExamsConfirm.trim().toUpperCase() !== 'DELETE'}
                        onClick={() => {
                          clearAllExams();
                          setDeleteExamsConfirm('');
                        }}
                        className="px-4 py-2 text-sm font-heading font-semibold rounded-lg border border-[#D97757]/40 text-[#D97757] disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[#fff5f1]"
                      >
                        Delete exam syllabuses
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative xl:col-span-1">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute -left-4 top-0 z-10 w-8 h-8 bg-white border border-[#E8E6DC] rounded-full flex items-center justify-center hover:bg-[#FAF9F5] transition-colors shadow-sm"
              >
                {sidebarCollapsed ? (
                  <ChevronLeft className="w-4 h-4 text-[#141413]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#141413]" />
                )}
              </button>

              {!sidebarCollapsed && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-6 border border-[#E8E6DC] shadow-sm">
                    <h3 className="font-heading font-semibold text-lg text-[#141413] mb-4">Quick Info</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="text-[#B0AEA5]">Current Goal</div>
                        <div className="font-heading font-semibold text-[#141413]">{stats.weeklyGoal}h/week</div>
                      </div>
                      <div>
                        <div className="text-[#B0AEA5]">This Week</div>
                        <div className="font-heading font-semibold text-[#141413]">{stats.weeklyCompleted.toFixed(1)}h</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

