/** Short labels for mobile top bar and similar chrome. */
export function pageTitleForPath(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/today' || pathname.startsWith('/today?')) return 'Today';
  if (pathname.startsWith('/focus')) return 'Focus';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/exams/')) return 'Exam';
  if (pathname.startsWith('/exams')) return 'Exams';
  if (pathname.startsWith('/todo') || pathname.startsWith('/notes')) return 'To-do';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Flowly';
}
