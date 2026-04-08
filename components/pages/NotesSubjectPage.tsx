'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import { stripHtml } from '@/lib/html';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Plus } from 'lucide-react';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';

type Props = { subjectId: string };

export default function NotesSubjectPage({ subjectId }: Props) {
  const router = useRouter();
  const { notes, addNote, deleteNote } = useStore();

  const list = useMemo(
    () =>
      notes
        .filter((n) => n.subjectId === subjectId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [notes, subjectId]
  );

  const newNote = () => {
    addNote({ subjectId, title: '', content: '<p></p>' });
    const n = useStore.getState().notes[0];
    if (n) router.push(`/todo/${encodeURIComponent(subjectId)}/${encodeURIComponent(n.id)}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0">
        <PageHeader
          sticky="muted"
          lead={
            <Link
              href="/todo"
              className="inline-flex items-center gap-2 text-sm text-[#B0AEA5] hover:text-[#141413] font-heading"
            >
              <ArrowLeft className="w-4 h-4" />
              All subjects
            </Link>
          }
          title={subjectId}
          actions={
            <button
              type="button"
              onClick={newNote}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141413] text-white rounded-lg font-heading text-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              New note
            </button>
          }
        />

        <main className={`${PAGE_MAIN_CLASSES} space-y-2`}>
          {list.length === 0 ? (
            <p className="text-sm text-[#B0AEA5]">No notes yet. Create one to start writing.</p>
          ) : (
            list.map((n) => {
              const preview = stripHtml(n.content).slice(0, 80);
              return (
                <div
                  key={n.id}
                  className="flex items-stretch gap-2 p-4 rounded-xl border border-[#E8E6DC] bg-white hover:bg-[#FAF9F5] transition-colors"
                >
                  <Link href={`/todo/${encodeURIComponent(subjectId)}/${encodeURIComponent(n.id)}`} className="flex-1 min-w-0 text-left">
                    <p className="font-heading font-semibold text-[#141413] truncate">{n.title.trim() || 'Untitled'}</p>
                    <p className="text-xs text-[#B0AEA5] mt-0.5">{formatDistanceToNow(new Date(n.updatedAt), { addSuffix: true })}</p>
                    {preview ? <p className="text-sm text-[#B0AEA5] mt-2 line-clamp-2">{preview}</p> : null}
                  </Link>
                  <button
                    type="button"
                    className="text-xs text-[#B0AEA5] self-center px-2 hover:text-[#D97757]"
                    title="Delete note"
                    onClick={() => {
                      if (confirm('Delete this note?')) deleteNote(n.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
