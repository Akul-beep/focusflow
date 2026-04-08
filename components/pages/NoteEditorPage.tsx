'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import TiptapNoteEditor from '@/components/notes/TiptapNoteEditor';
import { ArrowLeft } from 'lucide-react';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';

type Props = { subjectId: string; noteId: string };

export default function NoteEditorPage({ subjectId, noteId }: Props) {
  const note = useStore((s) => s.notes.find((n) => n.id === noteId));
  const updateNote = useStore((s) => s.updateNote);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('<p></p>');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
  }, [noteId]);

  useEffect(() => {
    if (!note || hydrated.current) return;
    setTitle(note.title);
    setHtml(note.content);
    hydrated.current = true;
  }, [note, noteId]);

  useEffect(() => {
    if (!note || !hydrated.current) return;
    if (title === note.title && html === note.content) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaveState('saving');
      updateNote(noteId, { title, content: html });
      setSaveState('saved');
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, html, noteId, note, updateNote]);

  if (!note) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
        <p className="text-sm text-[#B0AEA5]">Note not found.</p>
        <Link href="/todo" className="ml-2 text-[#D97757] font-heading">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />
      <div className="flex-1 w-full md:ml-60 pb-20 md:pb-0 min-w-0 flex flex-col">
        <PageHeader
          sticky="muted"
          title="Note"
          lead={
            <Link
              href={`/todo/${encodeURIComponent(subjectId)}`}
              className="inline-flex items-center gap-2 text-sm text-[#B0AEA5] hover:text-[#141413] font-heading"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          }
          actions={
            <span className="text-xs text-[#B0AEA5] font-heading tabular-nums">
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : ''}
            </span>
          }
        />

        <main className={`flex-1 ${PAGE_MAIN_CLASSES} max-w-3xl w-full mx-auto`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full text-2xl md:text-3xl font-heading font-semibold text-[#141413] placeholder:text-[#B0AEA5] bg-transparent border-none outline-none mb-4"
          />
          <TiptapNoteEditor key={noteId} content={html} onChange={setHtml} />
        </main>
      </div>
    </div>
  );
}
