'use client';

import { useEffect } from 'react';
import { initializeSync } from '@/lib/sync-init';

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize sync when app loads
    initializeSync();
  }, []);

  return <>{children}</>;
}
