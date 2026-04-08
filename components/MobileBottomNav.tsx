'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { MOBILE_TAB_NAV } from '@/lib/nav-config';

type Props = {
  onOpenMenu: () => void;
};

export default function MobileBottomNav({ onOpenMenu }: Props) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[85] bg-white border-t border-[#E8E6DC] safe-area-pb">
      <div className="flex items-stretch justify-around h-[52px]">
        {MOBILE_TAB_NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === '/dashboard' || href === '/today'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 text-[9px] font-heading font-medium ${
                active ? 'text-[#D97757]' : 'text-[#B0AEA5]'
              }`}
            >
              <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-[#D97757]' : 'text-[#B0AEA5]'}`} />
              <span className="truncate max-w-full px-0.5">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 text-[9px] font-heading font-medium text-[#B0AEA5] hover:text-[#D97757]"
        >
          <MoreHorizontal className="w-[22px] h-[22px] shrink-0" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
