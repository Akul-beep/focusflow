'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import { collectSubjectIds, subjectHueClass } from '@/lib/subject-meta';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, X } from 'lucide-react';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';

export default function NotesHomePage() {
  const router = useRouter();
  const { tasks, notes, addNote } = useStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('General');

  const subjects = useMemo(() => {
    const s = collectSubjectIds(tasks, notes.map((n) => n.subjectId));
    return s.length ? s : ['General'];
  }, [tasks, notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.subjectId.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const cards = useMemo(() => {
    return subjects.map((subjectId) => {
      const subNotes = filteredNotes.filter((n) => n.subjectId === subjectId);
      const last = subNotes.reduce(
        (best, n) => (new Date(n.updatedAt) > new Date(best) ? n.updatedAt : best),
        subNotes[0]?.updatedAt || new Date(0).toISOString()
      );
      return { subjectId, count: subNotes.length, lastEdited: subNotes.length ? last : null };
    });
  }, [subjects, filteredNotes]);

  const startNewInSubject = (subjectId: string) => {
    addNote({ subjectId, title: '', content: '<p></p>' });
    const created = useStore.getState().notes[0];
    if (created) {
      router.push(`/todo/${encodeURIComponent(subjectId)}/${encodeURIComponent(created.id)}`);
    }
    setModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          sticky="muted"
          title="Notes"
          subtitle="By subject"
          actions={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141413] text-white rounded-lg font-heading font-medium text-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              New note
            </button>
          }
        >
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0AEA5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles and content..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141413] bg-white"
            />
          </div>
        </PageHeader>

        <main className={PAGE_MAIN_CLASSES}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(({ subjectId, count, lastEdited }) => (
              <Link
                key={subjectId}
                href={`/todo/${encodeURIComponent(subjectId)}`}
                className={`rounded-xl border p-5 bg-gradient-to-br ${subjectHueClass(subjectId)} hover:shadow-md transition-shadow`}
              >
                <p className="font-heading font-semibold text-lg text-[#141413]">{subjectId}</p>
                <p className="text-sm text-[#B0AEA5] mt-1">
                  {count} note{count === 1 ? '' : 's'}
                  {lastEdited ? ` · ${formatDistanceToNow(new Date(lastEdited), { addSuffix: true })}` : ''}
                </p>
              </Link>
            ))}
          </div>
          {cards.length === 0 && <p className="text-sm text-[#B0AEA5]">Add a task with a subject or create a note to get started.</p>}
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E6DC] max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading font-semibold text-[#141413]">New note</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-[#B0AEA5] hover:text-[#141413]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm font-heading text-[#141413] mb-2">Subject</label>
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2 border border-[#E8E6DC] rounded-lg mb-4"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => startNewInSubject(newSubject)}
              className="w-full py-2.5 bg-[#141413] text-white rounded-lg font-heading"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
