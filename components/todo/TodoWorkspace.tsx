'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useStore } from '@/lib/store';
import TiptapNoteEditor from '@/components/notes/TiptapNoteEditor';
import MicrosoftTodoPanel from '@/components/todo/MicrosoftTodoPanel';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, Plus, Search, Trash2 } from 'lucide-react';
import type { Note } from '@/types';
import { htmlToPlainText } from '@/lib/html-to-plain';
import { DEFAULT_TODO_NOTE_HTML } from '@/lib/todo-default-note';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';

function noteFolderKey(subjectId: string): 'inbox' | string {
  const s = (subjectId || '').trim();
  if (!s || s.toLowerCase() === 'general' || s === 'Inbox') return 'inbox';
  return s;
}

function folderLabel(key: string): string {
  if (key === 'all') return 'All';
  if (key === 'inbox') return 'Notes';
  return key;
}

function snippetFromHtml(html: string, max = 56): string {
  const t = htmlToPlainText(html).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t || '';
  return `${t.slice(0, max)}…`;
}

type FolderKey = 'all' | 'inbox' | string;

type MainTab = 'todo' | 'notes';

type Props = {
  initialSubjectId?: string | null;
  initialNoteId?: string | null;
};

export default function TodoWorkspace({ initialSubjectId, initialNoteId }: Props) {
  const router = useRouter();
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const [tab, setTab] = useState<MainTab>('todo');
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'browse' | 'write'>('browse');
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('<p></p>');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedForId = useRef<string | null>(null);

  const folderKeys = useMemo(() => {
    const extra = new Set<string>();
    for (const n of notes) {
      const k = noteFolderKey(n.subjectId);
      if (k !== 'inbox') extra.add(k);
    }
    return ['all', 'inbox', ...Array.from(extra).sort((a, b) => a.localeCompare(b))] as FolderKey[];
  }, [notes]);

  const filteredByFolder = useMemo(() => {
    return notes.filter((n) => {
      if (selectedFolder === 'all') return true;
      if (selectedFolder === 'inbox') return noteFolderKey(n.subjectId) === 'inbox';
      return noteFolderKey(n.subjectId) === selectedFolder || n.subjectId === selectedFolder;
    });
  }, [notes, selectedFolder]);

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...filteredByFolder].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        htmlToPlainText(n.content).toLowerCase().includes(q) ||
        n.subjectId.toLowerCase().includes(q)
    );
  }, [filteredByFolder, search]);

  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) ?? null : null;

  /** Folder dropdown options; include current note’s subject if it’s not already listed */
  const noteMoveFolderOptions = useMemo(() => {
    const base = folderKeys.filter((k) => k !== 'all');
    if (!selectedNote) return base;
    const sid = (selectedNote.subjectId || '').trim();
    if (!sid) return base;
    const asKey = noteFolderKey(sid) === 'inbox' ? 'inbox' : sid;
    const has = base.some((k) => k === asKey || (asKey === 'inbox' && k === 'inbox'));
    if (has) return base;
    return [asKey, ...base];
  }, [folderKeys, selectedNote]);

  useEffect(() => {
    if (!initialSubjectId && !initialNoteId) return;
    const sub = initialSubjectId ? decodeURIComponent(initialSubjectId) : null;
    const nid = initialNoteId ? decodeURIComponent(initialNoteId) : null;
    setTab('notes');
    if (sub) {
      const fk = noteFolderKey(sub);
      setSelectedFolder(fk === 'inbox' ? 'inbox' : sub);
    }
    if (nid) {
      setSelectedNoteId(nid);
      setMobilePane('write');
    }
  }, [initialSubjectId, initialNoteId]);

  useLayoutEffect(() => {
    if (!selectedNoteId) {
      setTitle('');
      setHtml('<p></p>');
      hydratedForId.current = null;
      return;
    }
    const n = useStore.getState().notes.find((x) => x.id === selectedNoteId);
    if (!n) {
      hydratedForId.current = null;
      return;
    }
    setTitle(n.title);
    setHtml(n.content || '<p></p>');
    hydratedForId.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    if (!selectedNoteId || hydratedForId.current !== selectedNoteId) return;
    const noteId = selectedNoteId;
    const latest = useStore.getState().notes.find((n) => n.id === noteId);
    if (!latest) return;
    if (title === latest.title && html === latest.content) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaveState('saving');
      useStore.getState().updateNote(noteId, { title, content: html });
      setSaveState('saved');
    }, 900);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const n = useStore.getState().notes.find((x) => x.id === noteId);
      if (n && (title !== n.title || html !== n.content)) {
        useStore.getState().updateNote(noteId, { title, content: html });
      }
    };
  }, [selectedNoteId, title, html]);

  const pushNoteRoute = useCallback(
    (n: Note | null) => {
      if (!n) {
        router.replace('/todo');
        return;
      }
      const folder = noteFolderKey(n.subjectId) === 'inbox' ? 'Inbox' : n.subjectId;
      router.replace(`/todo/${encodeURIComponent(folder)}/${encodeURIComponent(n.id)}`);
    },
    [router]
  );

  const goTab = (next: MainTab) => {
    setTab(next);
    if (next === 'todo') {
      router.replace('/todo');
      setMobilePane('browse');
    }
  };

  const createNote = () => {
    const subjectId =
      selectedFolder === 'all' || selectedFolder === 'inbox' ? 'Inbox' : selectedFolder;
    addNote({ subjectId, title: '', content: DEFAULT_TODO_NOTE_HTML });
    const created = useStore.getState().notes[0];
    if (created) {
      setSelectedNoteId(created.id);
      setMobilePane('write');
      pushNoteRoute(created);
    }
  };

  const onPickNote = (n: Note) => {
    setSelectedNoteId(n.id);
    setMobilePane('write');
    pushNoteRoute(n);
  };

  const onPickFolder = (key: FolderKey) => {
    setSelectedFolder(key);
    setSelectedNoteId(null);
    setMobilePane('browse');
    router.replace('/todo');
  };

  const noteFolderSelectValue = (n: Note): FolderKey => {
    return noteFolderKey(n.subjectId) === 'inbox' ? 'inbox' : n.subjectId;
  };

  const moveNoteToFolder = (noteId: string, key: FolderKey) => {
    if (key === 'all') return;
    const subjectId = key === 'inbox' ? 'Inbox' : key;
    updateNote(noteId, { subjectId });
  };

  const deleteCurrentNote = () => {
    if (!selectedNoteId) return;
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    deleteNote(selectedNoteId);
    setSelectedNoteId(null);
    setTitle('');
    setHtml('<p></p>');
    setMobilePane('browse');
    router.replace('/todo');
  };

  const tabSubtitle =
    tab === 'todo'
      ? 'Quick list — hand off to the planner anytime.'
      : 'Folders, list, and editor.';

  const tabSwitcher = (
    <div
      className="inline-flex p-1 rounded-xl bg-[#FAF9F5] border border-[#E8E6DC] gap-0.5 w-full max-w-md"
      role="tablist"
      aria-label="Workspace mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'todo'}
        onClick={() => goTab('todo')}
        className={`font-heading flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          tab === 'todo'
            ? 'bg-white text-[#141413] shadow-sm border border-[#E8E6DC]/80'
            : 'text-[#B0AEA5] hover:text-[#141413]'
        }`}
      >
        Todo
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'notes'}
        onClick={() => {
          setTab('notes');
          setMobilePane('browse');
          router.replace('/todo');
        }}
        className={`font-heading flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          tab === 'notes'
            ? 'bg-white text-[#141413] shadow-sm border border-[#E8E6DC]/80'
            : 'text-[#B0AEA5] hover:text-[#141413]'
        }`}
      >
        Notes
      </button>
    </div>
  );

  /** Matches fixed mobile bottom nav (52px) + safe area */
  const mobileBottomPad = 'pb-[calc(52px+env(safe-area-inset-bottom,0px))]';

  /** Desktop: fill viewport so content bottom aligns with sidebar (AI task creator). */
  const workspaceMain =
    'flex flex-col w-full min-w-0 md:ml-60 min-h-[100dvh] md:min-h-0 md:h-[100dvh] md:max-h-[100dvh] ' +
    mobileBottomPad +
    ' md:pb-0';

  const contentShell = `${PAGE_MAIN_CLASSES} !pt-4 md:!pt-5 !pb-0 flex-1 min-h-0 flex flex-col overflow-hidden`;

  return (
    <div className="min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden bg-[#FAF9F5]">
      <Sidebar />
      <div className={workspaceMain}>
        <PageHeader
          className="shadow-[0_1px_0_rgba(20,20,19,0.04)] shrink-0"
          lead={tabSwitcher}
          title={tab === 'todo' ? 'To-do' : 'Notes'}
          subtitle={<span className="text-[#6f6d66]">{tabSubtitle}</span>}
          actions={
            tab === 'notes' ? (
              <button
                type="button"
                onClick={createNote}
                className="h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-[#E8E6DC] bg-white text-[#141413] font-heading font-medium text-sm hover:bg-[#FAF9F5] hover:border-[#B0AEA5] transition-colors w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                New note
              </button>
            ) : undefined
          }
        />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {tab === 'todo' ? (
            <main className={contentShell}>
              <MicrosoftTodoPanel />
            </main>
          ) : (
            <main className={contentShell}>
              <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] shadow-sm font-body">
            {/* Folders */}
            <aside
              className={`w-full md:w-[200px] shrink-0 border-b md:border-b-0 md:border-r border-[#E8E6DC] bg-white flex flex-col max-h-[36vh] md:max-h-none md:min-h-0 ${
                mobilePane === 'browse' ? 'flex' : 'hidden'
              } md:flex`}
            >
              <nav className="flex md:flex-col gap-0 overflow-x-auto md:overflow-visible p-2 md:p-3 md:pt-3 scrollbar-hide">
                {folderKeys.map((key) => {
                  const on = selectedFolder === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onPickFolder(key)}
                      className={`font-heading shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        on
                          ? 'bg-[#D97757] text-white shadow-sm'
                          : 'text-[#141413] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      {folderLabel(key)}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Note list */}
            <div
              className={`w-full md:w-[min(100%,300px)] shrink-0 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-[#E8E6DC] bg-white ${
                mobilePane === 'browse' ? 'flex' : 'hidden'
              } md:flex`}
            >
              <div className="p-2 flex items-center gap-2 border-b border-[#E8E6DC] bg-[#FAF9F5]/80">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0AEA5]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E8E6DC] bg-white text-sm text-[#141413] placeholder:text-[#B0AEA5] outline-none focus:ring-2 focus:ring-[#D97757]/25"
                  />
                </div>
                <button
                  type="button"
                  onClick={createNote}
                  className="md:hidden h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-[#E8E6DC] bg-white text-[#D97757] hover:bg-[#FAF9F5]"
                  aria-label="New note"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <ul className="flex-1 min-h-0 overflow-y-auto bg-white">
                {visibleNotes.length === 0 ? (
                  <li className="p-4 text-sm text-[#B0AEA5]">No notes</li>
                ) : (
                  visibleNotes.map((n) => {
                    const active = n.id === selectedNoteId;
                    const snip = snippetFromHtml(n.content);
                    return (
                      <li key={n.id} className="border-b border-[#E8E6DC]/80 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => onPickNote(n)}
                          className={`w-full text-left px-3 py-2.5 transition-colors ${
                            active
                              ? 'bg-[#D97757]/10 border-l-2 border-[#D97757] pl-[10px]'
                              : 'hover:bg-[#FAF9F5] border-l-2 border-transparent'
                          }`}
                        >
                          <span className="block text-sm font-heading font-medium text-[#141413] truncate">
                            {n.title.trim() || 'New note'}
                          </span>
                          <span className="block text-xs text-[#B0AEA5] truncate mt-0.5">
                            {formatDistanceToNow(new Date(n.updatedAt), { addSuffix: true })}
                            {snip ? ` · ${snip}` : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div
              className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-white max-md:min-h-[55vh] ${
                mobilePane === 'write' ? 'flex' : 'hidden'
              } md:flex`}
            >
              {selectedNote ? (
                <>
                  <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#E8E6DC] bg-[#FAF9F5]/50">
                    <button
                      type="button"
                      className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white"
                      onClick={() => setMobilePane('browse')}
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#D97757]" />
                    </button>
                    <label className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
                      <span className="sr-only">Folder</span>
                      <select
                        value={noteFolderSelectValue(selectedNote)}
                        onChange={(e) => moveNoteToFolder(selectedNote.id, e.target.value as FolderKey)}
                        className="max-w-full min-w-0 flex-1 sm:flex-none sm:max-w-[200px] text-xs rounded-lg border border-[#E8E6DC] bg-white px-2.5 py-2 text-[#141413] outline-none focus:ring-2 focus:ring-[#D97757]/25 font-heading"
                        aria-label="Move note to folder"
                      >
                        {noteMoveFolderOptions.map((key) => (
                          <option key={key} value={key}>
                            {folderLabel(key)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={deleteCurrentNote}
                        className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-heading font-medium text-[#B0AEA5] hover:bg-red-50 hover:text-red-600 transition-colors"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                      <span className="text-xs text-[#B0AEA5] tabular-nums whitespace-nowrap">
                        {saveState === 'saving' ? 'Saving…' : 'Saved'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5 max-w-3xl mx-auto w-full">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full text-2xl md:text-3xl font-heading font-bold text-[#141413] placeholder:text-[#B0AEA5] bg-transparent border-none outline-none mb-4 tracking-tight"
                    />
                    <TiptapNoteEditor key={selectedNote.id} variant="apple" content={html} onChange={setHtml} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-[#B0AEA5] text-sm text-center">
                  Select a note or create one.
                </div>
              )}
            </div>
              </div>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
