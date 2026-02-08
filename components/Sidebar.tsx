'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Play, 
  Target,
  Calendar, 
  Settings,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import AITaskInput from './AITaskInput';

export default function Sidebar() {
  const pathname = usePathname();
  const { tasks } = useStore();
  
  const activeTasks = tasks.filter((t) => !t.completed).length;
  
  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard', badge: null },
    { href: '/focus', icon: Play, label: 'Focus', badge: activeTasks > 0 ? activeTasks : null },
    { href: '/today', icon: Target, label: 'Today', badge: null },
    { href: '/calendar', icon: Calendar, label: 'Calendar', badge: null },
    { href: '/settings', icon: Settings, label: 'Settings', badge: null },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E8E6DC] z-30 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#E8E6DC]">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-heading font-bold text-lg text-[#141413]">Focusflow</h1>
            <p className="text-xs text-[#B0AEA5]">Task Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-heading font-medium text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-[#D97757] text-white shadow-sm'
                  : 'text-[#141413] hover:bg-[#FAF9F5] hover:text-[#D97757]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#B0AEA5] group-hover:text-[#D97757]'}`} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-[#D97757]/10 text-[#D97757]'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI Task Input */}
      <div className="p-4 border-t border-[#E8E6DC]">
        <div className="bg-gradient-to-br from-[#FAF9F5] to-[#E8E6DC] rounded-xl p-4">
          <AITaskInput />
        </div>
      </div>
    </aside>
  );
}
