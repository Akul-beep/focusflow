'use client';

import { useStore } from '@/lib/store';

export default function SyncStatusIndicator() {
  const { isSyncing, completionSyncing, syncError, syncQueueCount } = useStore();

  const state =
    isSyncing || completionSyncing ? 'syncing' : syncError || syncQueueCount > 0 ? 'error' : 'synced';

  return (
    <div className="fixed top-[3.75rem] right-3 z-[80] md:top-3 md:right-5">
      <div
        className="w-3 h-3 rounded-full border border-white/70 shadow-sm"
        title={state === 'error' ? 'Some changes not saved - will retry' : state === 'syncing' ? 'Syncing...' : 'Synced'}
      >
        <div
          className={`w-full h-full rounded-full ${
            state === 'synced' ? 'bg-[#788C5D]' : state === 'syncing' ? 'bg-[#6A9BCC] animate-pulse' : 'bg-[#D97757]'
          }`}
        />
      </div>
    </div>
  );
}
