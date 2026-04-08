const PALETTE = [
  'from-[#6A9BCC]/20 to-[#6A9BCC]/5 border-[#6A9BCC]/30',
  'from-[#788C5D]/20 to-[#788C5D]/5 border-[#788C5D]/30',
  'from-[#D97757]/20 to-[#D97757]/5 border-[#D97757]/30',
  'from-[#9B8BBD]/20 to-[#9B8BBD]/5 border-[#9B8BBD]/30',
  'from-[#C4A574]/20 to-[#C4A574]/5 border-[#C4A574]/30',
];

export function subjectHueClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % PALETTE.length;
  return PALETTE[h];
}

export function collectSubjectIds(tasks: { subject?: string }[], noteSubjectIds: string[]): string[] {
  const fromTasks = tasks.map((t) => (t.subject || 'General').trim() || 'General');
  const set = new Set<string>([...fromTasks, ...noteSubjectIds.map((s) => s.trim()).filter(Boolean)]);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
