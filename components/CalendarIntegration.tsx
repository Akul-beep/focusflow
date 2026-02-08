'use client';

import { useState } from 'react';
import { Calendar, Check, X, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function CalendarIntegration() {
  const { calendarIntegration, updateCalendarIntegration } = useStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (type: 'google' | 'outlook' | 'lms') => {
    setIsConnecting(true);
    
    // Simulate connection process
    setTimeout(() => {
      updateCalendarIntegration({
        type,
        connected: true,
        syncEnabled: true,
        lastSync: new Date(),
      });
      setIsConnecting(false);
      alert(`${type === 'lms' ? 'LMS' : type === 'google' ? 'Google Calendar' : 'Outlook'} connected successfully!`);
    }, 1500);
  };

  const handleDisconnect = () => {
    updateCalendarIntegration({
      type: 'none',
      connected: false,
      syncEnabled: false,
    });
  };

  const handleSync = () => {
    updateCalendarIntegration({
      ...calendarIntegration,
      lastSync: new Date(),
    });
    alert('Calendar synced! Tasks imported successfully.');
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-[#E8E6DC] shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
          <Calendar className="w-5 h-5 text-[#141413]" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-base text-[#141413]">
            Calendar Integration
          </h3>
          <p className="text-xs text-[#B0AEA5]">Sync with external calendars</p>
        </div>
      </div>

      <p className="text-sm text-[#B0AEA5] mb-6">
        Connect your calendar to import assignments and sync your schedule.
      </p>

      {calendarIntegration.connected ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#788C5D]/10 rounded-lg">
            <div>
              <div className="font-heading font-medium text-[#141413]">
                {calendarIntegration.type === 'lms'
                  ? 'LMS (Google Classroom)'
                  : calendarIntegration.type === 'google'
                  ? 'Google Calendar'
                  : 'Microsoft Outlook'}
              </div>
              <div className="text-sm text-[#B0AEA5]">
                {calendarIntegration.lastSync
                  ? `Last synced: ${new Date(calendarIntegration.lastSync).toLocaleString()}`
                  : 'Not synced yet'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                className="p-2 text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                title="Sync now"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleDisconnect}
                className="p-2 text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
                title="Disconnect"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#141413]">
            <input
              type="checkbox"
              checked={calendarIntegration.syncEnabled}
              onChange={(e) =>
                updateCalendarIntegration({
                  ...calendarIntegration,
                  syncEnabled: e.target.checked,
                })
              }
                className="w-4 h-4 text-[#141413] border-[#E8E6DC] rounded focus:ring-[#141413]"
            />
            Auto-sync every hour
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleConnect('google')}
            disabled={isConnecting}
            className="flex flex-col items-center gap-2 p-4 border border-[#E8E6DC] rounded-lg hover:border-[#141413] hover:bg-[#FAF9F5] transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-[#FAF9F5] rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#141413]" />
            </div>
            <span className="font-heading font-medium text-sm text-[#141413]">
              Google Calendar
            </span>
          </button>

          <button
            onClick={() => handleConnect('outlook')}
            disabled={isConnecting}
            className="flex flex-col items-center gap-2 p-4 border border-[#E8E6DC] rounded-lg hover:border-[#141413] hover:bg-[#FAF9F5] transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-[#FAF9F5] rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#141413]" />
            </div>
            <span className="font-heading font-medium text-sm text-[#141413]">
              Outlook
            </span>
          </button>

          <button
            onClick={() => handleConnect('lms')}
            disabled={isConnecting}
            className="flex flex-col items-center gap-2 p-4 border-2 border-[#E8E6DC] rounded-lg hover:border-[#6A9BCC] transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-[#FAF9F5] rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#141413]" />
            </div>
            <span className="font-heading font-medium text-sm text-[#141413]">
              LMS / Google Classroom
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
