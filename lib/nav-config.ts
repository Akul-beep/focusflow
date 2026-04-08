import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Target,
  Timer,
  ListTodo,
  Calendar,
  GraduationCap,
  BarChart3,
  Settings,
} from 'lucide-react';

export type MainNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

/** Primary routes — single source for sidebar and mobile drawer. */
export const MAIN_NAV: MainNavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/today', icon: Target, label: 'Today' },
  { href: '/focus', icon: Timer, label: 'Focus' },
  { href: '/todo', icon: ListTodo, label: 'To-do' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/exams', icon: GraduationCap, label: 'Exams' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

/** Bottom bar: Today first, then task board, Focus, Calendar; rest in More drawer. */
export const MOBILE_TAB_NAV: MainNavItem[] = [
  { href: '/today', icon: Target, label: 'Today' },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tasks' },
  { href: '/focus', icon: Timer, label: 'Focus' },
  { href: '/calendar', icon: Calendar, label: 'Cal' },
];

export type QuickLinkItem = { href: string; label: string; description: string };

/** Mobile drawer only — do not duplicate MAIN_NAV destinations here. */
export const DRAWER_ONLY_QUICK_LINKS: QuickLinkItem[] = [
  {
    href: '/today?recovery=1',
    label: 'Replan this week',
    description: 'Recovery & reschedule on Today',
  },
];
