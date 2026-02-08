'use client';

import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Shield, Target, LogIn, LogOut, User, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const {
    stats,
    schedulePreferences,
    updateSchedulePreferences,
    motivationPreferences,
    updateMotivationPreferences,
    isSyncing,
    lastSync,
    syncError,
    syncToSupabase,
    syncFromSupabase,
  } = useStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState(stats.weeklyGoal);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Check auth status on mount and after auth callback
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check with Supabase client directly
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser({
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          });
        } else {
          // Fallback to API check
          const res = await fetch('/api/auth/session');
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // If Supabase isn't configured, just check API
        fetch('/api/auth/session')
          .then((res) => res.json())
          .then((data) => {
            if (data.user) {
              setUser(data.user);
            }
          })
          .catch(() => {
            // Not signed in
          });
      }
    };

    checkAuth();

    // Listen for auth state changes
    let unsubscribeFn: (() => void) | null = null;
    
    const setupAuthListener = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            setUser({
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            });
            // Sync from Supabase on login
            if (event === 'SIGNED_IN') {
              const { syncFromSupabase } = useStore.getState();
              await syncFromSupabase();
            }
          } else {
            setUser(null);
            // On logout, data stays in local storage (offline mode)
          }
        });
        
        // onAuthStateChange returns { data: { subscription: { unsubscribe } } }
        unsubscribeFn = data?.subscription?.unsubscribe || null;
      } catch (error) {
        // Supabase not configured or error, skip subscription
        console.error('Auth listener setup error:', error);
      }
    };

    setupAuthListener();

    return () => {
      if (unsubscribeFn && typeof unsubscribeFn === 'function') {
        try {
          unsubscribeFn();
        } catch (error) {
          // Ignore unsubscribe errors
        }
      }
    };
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signin', { method: 'POST' });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading font-bold text-3xl text-[#141413] mb-1">Settings</h1>
                <p className="text-sm text-[#B0AEA5]">Manage your preferences and preferences</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-3 space-y-6">
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
                        value={weeklyGoal}
                        onChange={(e) => setWeeklyGoal(parseInt(e.target.value) || 20)}
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
                  <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#D97757]" />
                  </div>
                  <div>
                    <h2 className="font-heading font-semibold text-xl text-[#141413]">Scheduling Preferences</h2>
                    <p className="text-sm text-[#B0AEA5]">Tell the AI when you can work</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#FAF9F5] rounded-lg">
                    <div className="text-sm font-heading font-medium text-[#141413] mb-2">Work window</div>
                    <div className="flex items-center gap-3">
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
                    <p className="text-xs text-[#B0AEA5] mt-2">Tasks will be scheduled inside this window.</p>
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

                  <div className="p-4 bg-white rounded-lg border border-[#E8E6DC]">
                    <div className="text-sm font-heading font-semibold text-[#141413] mb-1">FocusCoins (rewards)</div>
                    <p className="text-xs text-[#B0AEA5]">
                      Earn coins for showing up:
                      <span className="text-[#141413] font-semibold"> +1</span>/focus minute,
                      <span className="text-[#141413] font-semibold"> +5</span>/step,
                      <span className="text-[#141413] font-semibold"> +20</span>/task.
                      Undoing a completion undoes coins too (fair + consistent).
                    </p>
                  </div>
                </div>
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

                {user ? (
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
                          onClick={() => syncToSupabase()}
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
                    </div>

                    <button
                      onClick={handleSignOut}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold hover:bg-[#FAF9F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut className="w-4 h-4" />
                      {loading ? 'Signing out...' : 'Sign Out'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[#B0AEA5]">
                      Sign in with Google to sync your tasks, progress, and settings across all your devices.
                    </p>
                    <button
                      onClick={handleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#141413] text-white rounded-lg font-heading font-semibold hover:bg-[#2a2a28] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogIn className="w-4 h-4" />
                      {loading ? 'Signing in...' : 'Sign in with Google'}
                    </button>
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
                      localStorage.removeItem('student-scheduler-storage');
                      window.location.reload();
                    }
                  }}
                  className="px-5 py-3 bg-white border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-semibold hover:bg-[#FAF9F5]"
                >
                  Reset local data
                </button>
              </div>
            </div>

            <div className="relative">
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

