'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

const card = 'rounded-xl border border-[#E8E6DC] bg-white shadow-sm';
const accent = 'text-[#D97757] hover:text-[#c96b4f]';
const accentSolid = 'bg-[#D97757] hover:bg-[#c96b4f]';
const ringFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function MicrosoftTodoPanel() {
  const quickTodos = useStore((s) => s.quickTodos);
  const addQuickTodo = useStore((s) => s.addQuickTodo);
  const updateQuickTodo = useStore((s) => s.updateQuickTodo);
  const deleteQuickTodo = useStore((s) => s.deleteQuickTodo);
  const clearCompletedQuickTodos = useStore((s) => s.clearCompletedQuickTodos);
  const addQuickTodoSubtask = useStore((s) => s.addQuickTodoSubtask);
  const updateQuickTodoSubtask = useStore((s) => s.updateQuickTodoSubtask);
  const deleteQuickTodoSubtask = useStore((s) => s.deleteQuickTodoSubtask);
  const scheduleQuickTodoToPlanner = useStore((s) => s.scheduleQuickTodoToPlanner);

  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});
  const [completedOpen, setCompletedOpen] = useState<boolean | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState('');
  const [editingSub, setEditingSub] = useState<{ parentId: string; subId: string } | null>(null);
  const [subTitleDraft, setSubTitleDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { open, done } = useMemo(() => {
    const o = quickTodos.filter((q) => !q.completed);
    const d = quickTodos.filter((q) => q.completed);
    o.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    d.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { open: o, done: d };
  }, [quickTodos]);

  const completedExpanded = completedOpen ?? done.length <= 3;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    addQuickTodo(t);
    setDraft('');
    inputRef.current?.focus();
  };

  const addStep = (parentId: string) => {
    const t = (stepDrafts[parentId] || '').trim();
    if (!t) return;
    addQuickTodoSubtask(parentId, t);
    setStepDrafts((s) => ({ ...s, [parentId]: '' }));
  };

  const toggleCompletedSection = () => {
    setCompletedOpen(!completedExpanded);
  };

  const commitTaskTitle = () => {
    if (!editingTaskId) return;
    const t = taskTitleDraft.trim();
    if (t) updateQuickTodo(editingTaskId, { title: t });
    setEditingTaskId(null);
    setTaskTitleDraft('');
  };

  const cancelTaskTitleEdit = (fallbackTitle: string) => {
    setTaskTitleDraft(fallbackTitle);
    setEditingTaskId(null);
  };

  const commitSubTitle = () => {
    if (!editingSub) return;
    const t = subTitleDraft.trim();
    if (t) updateQuickTodoSubtask(editingSub.parentId, editingSub.subId, { title: t });
    setEditingSub(null);
    setSubTitleDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row gap-3 md:gap-4">
      {/* Lists — dashboard-style small card */}
      <aside className="shrink-0 md:w-52">
        <div className={`${card} p-3`}>
          <p className="px-1 text-[10px] font-heading font-semibold uppercase tracking-wider text-[#B0AEA5] mb-2">
            Lists
          </p>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left bg-[#FAF9F5] border border-[#E8E6DC] text-[#141413] font-heading font-semibold text-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-[#D97757]/10 flex items-center justify-center shrink-0">
              <ListTodo className="w-4 h-4 text-[#D97757]" aria-hidden />
            </div>
            Tasks
          </button>
        </div>
      </aside>

      {/* Main — single tall card fills remaining height */}
      <section className={`flex-1 flex flex-col min-h-0 min-w-0 ${card} overflow-hidden`}>
        <div className="shrink-0 px-4 py-3 border-b border-[#E8E6DC] flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[#141413] tracking-tight">Tasks</h2>
        </div>

        {/* Dashboard-style stat chips */}
        <div className="shrink-0 px-4 pt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
          <div className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-2.5">
            <div className="text-[10px] font-heading font-semibold text-[#B0AEA5] uppercase tracking-wide leading-none">
              Open
            </div>
            <div className="text-xl font-heading font-bold text-[#141413] tabular-nums leading-tight mt-1">
              {open.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-2.5">
            <div className="text-[10px] font-heading font-semibold text-[#B0AEA5] uppercase tracking-wide leading-none">
              Done
            </div>
            <div className="text-xl font-heading font-bold text-[#141413] tabular-nums leading-tight mt-1">
              {done.length}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5] px-3 py-2 min-h-[44px] focus-within:border-[#D97757]/35 focus-within:ring-1 focus-within:ring-[#D97757]/20 transition-shadow">
            <Plus className="w-4 h-4 text-[#D97757] shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Add a task"
              className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-[#141413] placeholder:text-[#B0AEA5] ${ringFocus} rounded`}
              aria-label="Add a task"
            />
            {draft.trim() ? (
              <button
                type="button"
                onClick={submit}
                className={`font-heading shrink-0 text-xs font-semibold ${accent} px-2 py-1 rounded-md ${ringFocus}`}
              >
                Add
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 md:px-4">
          <ul className="space-y-1.5" aria-label="Tasks">
            {open.length === 0 ? (
              <li className="py-10 text-center text-sm text-[#B0AEA5] font-body rounded-lg border border-dashed border-[#E8E6DC] bg-[#FAF9F5]/40">
                No tasks yet.
              </li>
            ) : (
              open.map((q) => {
                const isOpen = expanded[q.id] ?? q.subtasks.length > 0;
                const linked = !!q.linkedTaskId;
                return (
                  <li key={q.id} className="group rounded-lg border border-[#E8E6DC]/80 bg-[#FAF9F5]/25 overflow-hidden">
                    <div className="flex items-start gap-0.5 p-1.5 hover:bg-[#FAF9F5]/80 transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleExpand(q.id)}
                        className={`min-w-9 min-h-9 flex items-center justify-center text-[#B0AEA5] hover:text-[#141413] shrink-0 rounded-md ${ringFocus}`}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Collapse steps' : 'Expand steps'}
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuickTodo(q.id, { completed: true })}
                        className={`min-w-9 min-h-9 flex items-center justify-center text-[#B0AEA5] hover:text-[#D97757] shrink-0 rounded-md ${ringFocus}`}
                        aria-label={`Complete ${q.title}`}
                      >
                        <Circle className="w-[19px] h-[19px]" strokeWidth={1.35} />
                      </button>
                      <div className="flex-1 min-w-0 pt-1 pb-0.5">
                        {editingTaskId === q.id ? (
                          <input
                            autoFocus
                            value={taskTitleDraft}
                            onChange={(e) => setTaskTitleDraft(e.target.value)}
                            onBlur={() => commitTaskTitle()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelTaskTitleEdit(q.title);
                              }
                            }}
                            className="w-full text-[14px] text-[#141413] leading-snug font-body rounded-md border border-[#E8E6DC] bg-white px-2 py-1 outline-none focus:border-[#D97757]/40"
                            aria-label="Task title"
                          />
                        ) : (
                          <div className="flex items-start gap-1.5 pr-1">
                            <p className="flex-1 min-w-0 text-[14px] text-[#141413] leading-snug font-body">
                              {q.title}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTaskId(q.id);
                                setTaskTitleDraft(q.title);
                              }}
                              className={`shrink-0 p-1 rounded-md text-[#B0AEA5] hover:text-[#D97757] hover:bg-white ${ringFocus}`}
                              aria-label={`Rename ${q.title}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {linked ? (
                            <Link
                              href="/today"
                              className={`text-[11px] font-heading font-semibold ${accent} py-0.5 ${ringFocus} rounded`}
                            >
                              Today
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={q.completed}
                              onClick={() => scheduleQuickTodoToPlanner(q.id)}
                              className={`inline-flex items-center gap-1 text-[11px] font-heading font-semibold ${accent} disabled:opacity-40 disabled:pointer-events-none py-0.5 rounded ${ringFocus}`}
                            >
                              <CalendarPlus className="w-3 h-3 shrink-0" />
                              Planner
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteQuickTodo(q.id)}
                            className="text-[11px] font-heading font-medium text-[#B0AEA5] hover:text-[#c96b4f] py-0.5"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="px-3 pb-3 pt-0 border-t border-[#E8E6DC]/60 bg-white/60">
                        <ul className="mt-2 space-y-1 border-l-2 border-[#E8E6DC] pl-3 ml-2">
                          {q.subtasks.map((st) => (
                            <li key={st.id} className="flex items-start gap-2 py-0.5 group/st">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuickTodoSubtask(q.id, st.id, { completed: !st.completed })
                                }
                                className={`mt-0.5 min-w-8 min-h-8 flex items-center justify-center text-[#B0AEA5] hover:text-[#D97757] rounded-md shrink-0 ${ringFocus}`}
                                aria-label={
                                  st.completed ? `Mark step not done: ${st.title}` : `Mark step done: ${st.title}`
                                }
                              >
                                {st.completed ? (
                                  <span
                                    className={`flex w-4 h-4 items-center justify-center rounded-full ${accentSolid}`}
                                  >
                                    <Check className="w-2 h-2 text-white stroke-[3]" />
                                  </span>
                                ) : (
                                  <Circle className="w-4 h-4" strokeWidth={1.35} />
                                )}
                              </button>
                              {editingSub?.parentId === q.id && editingSub.subId === st.id ? (
                                <input
                                  autoFocus
                                  value={subTitleDraft}
                                  onChange={(e) => setSubTitleDraft(e.target.value)}
                                  onBlur={commitSubTitle}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setSubTitleDraft(st.title);
                                      setEditingSub(null);
                                    }
                                  }}
                                  className="flex-1 min-w-0 text-[13px] leading-snug pt-1 font-body rounded-md border border-[#E8E6DC] bg-white px-2 py-0.5 outline-none focus:border-[#D97757]/40"
                                  aria-label="Step title"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSub({ parentId: q.id, subId: st.id });
                                    setSubTitleDraft(st.title);
                                  }}
                                  className={`flex-1 min-w-0 text-left text-[13px] leading-snug pt-1 font-body rounded-md px-0.5 -mx-0.5 hover:bg-white/80 ${
                                    st.completed ? 'text-[#B0AEA5] line-through' : 'text-[#141413]'
                                  }`}
                                >
                                  {st.title}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteQuickTodoSubtask(q.id, st.id)}
                                className="min-w-8 min-h-8 flex items-center justify-center text-[#B0AEA5] hover:text-[#c96b4f] rounded-md shrink-0 opacity-100 md:opacity-0 md:group-hover/st:opacity-100"
                                aria-label={`Remove step ${st.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        {!linked ? (
                          <div className="flex items-center gap-2 mt-2 pl-2 ml-2 border-l-2 border-transparent">
                            <Plus className="w-3.5 h-3.5 text-[#D97757] shrink-0" aria-hidden />
                            <input
                              value={stepDrafts[q.id] || ''}
                              onChange={(e) => setStepDrafts((s) => ({ ...s, [q.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addStep(q.id);
                                }
                              }}
                              placeholder="Add step"
                              className="flex-1 min-w-0 rounded-md border border-[#E8E6DC] bg-white px-2.5 py-1.5 text-xs text-[#141413] placeholder:text-[#B0AEA5] outline-none focus:border-[#D97757]/40"
                            />
                            <button
                              type="button"
                              onClick={() => addStep(q.id)}
                              className={`font-heading shrink-0 text-[11px] font-semibold ${accent} px-2 py-1.5 rounded-md ${ringFocus}`}
                            >
                              Add
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>

          {done.length > 0 ? (
            <div className="mt-3 rounded-xl border border-[#E8E6DC] bg-[#FAF9F5]/60 shadow-sm p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleCompletedSection}
                  className={`flex items-center gap-2 min-w-0 flex-1 text-left py-1 rounded-md ${ringFocus}`}
                  aria-expanded={completedExpanded}
                >
                  {completedExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#B0AEA5] shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#B0AEA5] shrink-0" aria-hidden />
                  )}
                  <span className="font-heading text-[11px] font-semibold uppercase tracking-wide text-[#B0AEA5]">
                    Completed ({done.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => clearCompletedQuickTodos()}
                  className={`font-heading text-[11px] font-semibold ${accent} shrink-0 px-2 py-1.5 rounded-md ${ringFocus}`}
                >
                  Clear all
                </button>
              </div>
              {completedExpanded ? (
                <ul className="mt-2 space-y-1 pt-2 border-t border-[#E8E6DC]/80">
                  {done.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-white/80 transition-colors group/done"
                    >
                      <button
                        type="button"
                        onClick={() => updateQuickTodo(q.id, { completed: false })}
                        className={`min-w-9 min-h-9 flex items-center justify-center shrink-0 rounded-md ${ringFocus}`}
                        aria-label={`Restore ${q.title}`}
                      >
                        <span className={`flex w-4 h-4 items-center justify-center rounded-full ${accentSolid}`}>
                          <Check className="w-2 h-2 text-white stroke-[3]" />
                        </span>
                      </button>
                      <span className="flex-1 text-[13px] text-[#B0AEA5] line-through min-w-0 truncate py-1 font-body">
                        {q.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteQuickTodo(q.id)}
                        className="min-w-9 min-h-9 flex items-center justify-center text-[#B0AEA5] hover:text-[#c96b4f] shrink-0 rounded-md opacity-100 md:opacity-0 md:group-hover/done:opacity-100"
                        aria-label={`Delete ${q.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
