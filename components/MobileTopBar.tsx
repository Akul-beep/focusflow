'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Timer, Target } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getNextFocusMicroTask, focusHrefFor } from '@/lib/focus-next-step';
import { pageTitleForPath } from '@/lib/page-meta';

type Props = {
  onOpenMenu: () => void;
};

export default function MobileTopBar({ onOpenMenu }: Props) {
  const pathname = usePathname();
  const tasks = useStore((s) => s.tasks);
  const title = pageTitleForPath(pathname || '/');
  const next = getNextFocusMicroTask(tasks);
  const focusUrl = next ? focusHrefFor(next.task.id, next.microTask.id) : '/focus';

  let contextAction: ReactNode = null;
  if (pathname === '/dashboard' || pathname.startsWith('/today')) {
    contextAction = (
      <Link
        href={focusUrl}
        className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] text-[#D97757] hover:bg-[#D97757]/10"
        aria-label="Start focus timer"
        title="Focus"
      >
        <Timer className="w-5 h-5" />
      </Link>
    );
  } else if (pathname.startsWith('/calendar')) {
    contextAction = (
      <Link
        href="/today"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] text-xs font-heading font-semibold text-[#141413] hover:bg-white"
      >
        <Target className="w-4 h-4 text-[#D97757]" />
        Today
      </Link>
    );
  } else if (!pathname.startsWith('/focus')) {
    contextAction = (
      <Link
        href="/today"
        className="text-xs font-heading font-semibold text-[#D97757] px-3 py-1.5 rounded-xl border border-[#E8E6DC] hover:bg-[#FAF9F5]"
      >
        Today
      </Link>
    );
  }

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-[90] h-14 flex items-center gap-2 px-3 bg-white/95 backdrop-blur-md border-b border-[#E8E6DC]">
      <button
        type="button"
        onClick={onOpenMenu}
        className="p-2 -ml-1 rounded-xl text-[#141413] hover:bg-[#FAF9F5] border border-transparent hover:border-[#E8E6DC] shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
      <Link href="/today" className="font-heading font-bold text-[#141413] text-sm tracking-tight shrink-0">
        Flowly
      </Link>
      <span className="text-[#E8E6DC] text-xs shrink-0" aria-hidden>
        ·
      </span>
      <span className="font-heading font-semibold text-sm text-[#141413] truncate min-w-0 flex-1">{title}</span>
      {contextAction ? <div className="shrink-0">{contextAction}</div> : <div className="w-9 shrink-0" aria-hidden />}
    </header>
  );
}
