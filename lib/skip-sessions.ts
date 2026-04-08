import { skippedMicroTasksStorageKey } from '@/lib/focusflow-storage-scope';

const keyFor = (isoDate: string) => skippedMicroTasksStorageKey(isoDate);

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function recordMicroTaskSkipped(microTaskId: string): void {
  if (typeof window === 'undefined') return;
  const k = keyFor(getTodayKey());
  try {
    const raw = localStorage.getItem(k);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(microTaskId)) arr.push(microTaskId);
    localStorage.setItem(k, JSON.stringify(arr));
  } catch {
    localStorage.setItem(k, JSON.stringify([microTaskId]));
  }
}

export function getSkippedMicroTaskIdsToday(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyFor(getTodayKey()));
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
