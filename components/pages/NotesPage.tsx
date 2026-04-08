'use client';

import { useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import { format } from 'date-fns';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';

export default function NotesPage() {
  const { tasks } = useStore();
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const notesBySubject = useMemo(() => {
    const rows = tasks.flatMap((task) =>
      task.microTasks.flatMap((mt) =>
        (mt.notes || []).map((note) => ({
          subject: task.subject || 'General',
          taskTitle: task.title,
          topic: mt.title,
          note,
          date: mt.completedAt || mt.scheduledStart || mt.scheduledDate || task.createdAt,
        }))
      )
    );
    const grouped = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const existing = grouped.get(row.subject) || [];
      existing.push(row);
      grouped.set(row.subject, existing);
    });
    return grouped;
  }, [tasks]);

  const subjects = Array.from(notesBySubject.keys()).sort();
  const visibleSubject = selectedSubject || subjects[0] || null;
  const visibleNotes = (visibleSubject ? notesBySubject.get(visibleSubject) || [] : [])
    .filter((row) => row.note.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full min-w-0 md:ml-60 pb-20 md:pb-0">
        <PageHeader title="Notes" subtitle="All study notes by subject" />

        <main className={`${PAGE_MAIN_CLASSES} grid grid-cols-1 lg:grid-cols-4 gap-6`}>
          <div className="lg:col-span-1 space-y-3">
            {subjects.length === 0 ? (
              <div className="bg-white rounded-xl p-4 border border-[#E8E6DC] text-sm text-[#B0AEA5]">No notes yet.</div>
            ) : (
              subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`w-full text-left px-4 py-3 rounded-xl border font-heading ${
                    visibleSubject === subject
                      ? 'bg-[#141413] text-white border-[#141413]'
                      : 'bg-white text-[#141413] border-[#E8E6DC] hover:bg-[#FAF9F5]'
                  }`}
                >
                  {subject}
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-3 min-w-0">
            <div className="bg-white rounded-xl border border-[#E8E6DC] p-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full mb-4 px-4 py-2 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413]"
              />
              {visibleNotes.length === 0 ? (
                <p className="text-sm text-[#B0AEA5]">No notes found for this subject.</p>
              ) : (
                <div className="space-y-3">
                  {visibleNotes.map((row, idx) => (
                    <div key={`${row.taskTitle}-${idx}`} className="p-4 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]">
                      <p className="text-xs text-[#B0AEA5]">{format(new Date(row.date), 'EEE, MMM d')}</p>
                      <p className="text-sm font-heading font-semibold text-[#141413]">{row.topic}</p>
                      <p className="text-xs text-[#B0AEA5] mb-2">{row.taskTitle}</p>
                      <p className="text-sm text-[#141413]">{row.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
