'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquareText, X } from 'lucide-react';
import AITaskInput from '@/components/AITaskInput';
import { useFeedback } from '@/components/FeedbackProvider';
import { MAIN_NAV, DRAWER_ONLY_QUICK_LINKS } from '@/lib/nav-config';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const { openFeedback } = useFeedback();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[100] flex justify-start" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        className="absolute inset-0 bg-[#141413]/40 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="relative z-[101] w-[min(100%,19rem)] h-full bg-white border-r border-[#E8E6DC] shadow-xl flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[#E8E6DC]">
          <Link href="/today" className="font-heading font-bold text-[#141413] text-lg" onClick={onClose}>
            Flowly
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#B0AEA5] hover:bg-[#FAF9F5] hover:text-[#141413]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/dashboard' || item.href === '/today'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-heading font-medium text-sm transition-all ${
                  active ? 'bg-[#D97757] text-white shadow-sm' : 'text-[#141413] hover:bg-[#FAF9F5]'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-[#B0AEA5]'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E8E6DC] bg-[#FAF9F5] shrink-0 space-y-3">
          {DRAWER_ONLY_QUICK_LINKS.length > 0 ? (
            <div>
              <p className="text-[10px] font-heading font-semibold uppercase tracking-wider text-[#B0AEA5] mb-2 px-1">
                Quick tool
              </p>
              <ul className="space-y-1">
                {DRAWER_ONLY_QUICK_LINKS.map((q) => (
                  <li key={q.href}>
                    <Link
                      href={q.href}
                      onClick={onClose}
                      className="block rounded-lg px-3 py-2 hover:bg-white border border-transparent hover:border-[#E8E6DC] transition-colors"
                    >
                      <span className="text-sm font-heading font-medium text-[#141413]">{q.label}</span>
                      <span className="block text-xs text-[#B0AEA5] mt-0.5">{q.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onClose();
              openFeedback({ kind: 'general' });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-heading text-sm font-medium text-[#141413] transition-colors hover:bg-white border border-transparent hover:border-[#E8E6DC]"
          >
            <MessageSquareText className="h-5 w-5 shrink-0 text-[#B0AEA5]" aria-hidden />
            Send feedback
          </button>
        </div>

        <div className="p-3 border-t border-[#E8E6DC] shrink-0">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-wider text-[#B0AEA5] mb-2 px-1">
            AI Task Creator
          </p>
          <div className="rounded-xl border border-[#E8E6DC] bg-gradient-to-br from-[#FAF9F5] to-[#E8E6DC] p-3">
            <AITaskInput onTaskCreated={onClose} />
          </div>
        </div>
      </aside>
    </div>
  );
}
