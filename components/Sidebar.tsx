'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';
import { MAIN_NAV } from '@/lib/nav-config';
import AITaskInput from './AITaskInput';
import { useFeedback } from '@/components/FeedbackProvider';

export default function Sidebar() {
  const pathname = usePathname();
  const { openFeedback } = useFeedback();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col bg-white border-r border-[#E8E6DC] z-30">
      <div className="p-4 border-b border-[#E8E6DC]">
        <Link href="/today" className="flex items-center gap-2.5 rounded-lg -m-1 p-1 hover:bg-[#FAF9F5] transition-colors">
          <div>
            <h1 className="font-heading font-bold text-lg text-[#141413]">Flowly</h1>
            <p className="text-xs text-[#B0AEA5]">Task Management</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {MAIN_NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/dashboard' || item.href === '/today'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-heading font-medium text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-[#D97757] text-white shadow-sm'
                  : 'text-[#141413] hover:bg-[#FAF9F5] hover:text-[#D97757]'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#B0AEA5] group-hover:text-[#D97757]'}`} />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => openFeedback({ kind: 'general' })}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-heading text-sm font-medium text-[#5C5B56] transition-colors hover:bg-[#FAF9F5] hover:text-[#D97757]"
        >
          <MessageSquareText className="h-5 w-5 shrink-0 text-[#B0AEA5]" aria-hidden />
          Send feedback
        </button>
      </div>

      <div className="p-3 border-t border-[#E8E6DC] shrink-0">
        <div className="bg-gradient-to-br from-[#FAF9F5] to-[#E8E6DC] rounded-xl p-3 border border-[#E8E6DC]/80">
          <AITaskInput />
        </div>
      </div>
    </aside>
  );
}
