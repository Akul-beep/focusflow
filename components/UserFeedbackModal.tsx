'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import { X } from 'lucide-react';
import { isPosthogConfigured } from '@/lib/posthog-config';

export type FeedbackModalKind = 'general' | 'ai_parse';

type Props = {
  open: boolean;
  onClose: () => void;
  kind: FeedbackModalKind;
  /** Last text the user typed into AI Task Creator (optional context). */
  aiPromptSnapshot?: string;
};

const MAX_PROMPT_SNAPSHOT = 4000;
const MAX_NOTE = 2000;

export default function UserFeedbackModal({ open, onClose, kind, aiPromptSnapshot }: Props) {
  const pathname = usePathname();
  const titleId = useId();
  const [category, setCategory] = useState<'general' | 'bug' | 'feature'>('general');
  const [message, setMessage] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setMessage('');
    setAiNote('');
    setCategory('general');
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const analyticsOn = isPosthogConfigured();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'general') {
      const trimmed = message.trim();
      if (!trimmed) return;
      if (analyticsOn) {
        try {
          posthog.capture('user_feedback', {
            category,
            message: trimmed.slice(0, MAX_NOTE),
            path: pathname,
          });
        } catch {
          /* ignore */
        }
      }
    } else {
      const snap = (aiPromptSnapshot || '').trim().slice(0, MAX_PROMPT_SNAPSHOT);
      const note = aiNote.trim().slice(0, MAX_NOTE);
      if (analyticsOn) {
        try {
          posthog.capture('ai_task_creator_feedback', {
            prompt_snapshot: snap || undefined,
            what_went_wrong: note || undefined,
            path: pathname,
          });
        } catch {
          /* ignore */
        }
      }
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#141413]/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[201] w-full sm:max-w-lg max-h-[min(92vh,640px)] overflow-y-auto bg-white sm:rounded-2xl border border-[#E8E6DC] shadow-2xl rounded-t-2xl sm:rounded-b-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E8E6DC] bg-white">
          <h2 id={titleId} className="font-heading font-bold text-lg text-[#141413] pr-2">
            {kind === 'ai_parse' ? 'Improve AI parsing' : 'Send feedback'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#B0AEA5] hover:bg-[#FAF9F5] hover:text-[#141413]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-5 sm:p-6">
            <p className="text-sm text-[#141413] font-heading font-medium mb-2">Thanks — we got it.</p>
            <p className="text-xs text-[#B0AEA5] leading-relaxed mb-4">
              {analyticsOn
                ? 'Your note was recorded. We use this to fix bugs and train better suggestions over time.'
                : 'This server doesn’t have analytics configured, so we couldn’t record it — but thanks for taking the time.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28]"
            >
              Close
            </button>
          </div>
        ) : kind === 'ai_parse' ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <p className="text-sm text-[#5C5B56] leading-relaxed">
              If the AI misunderstood your task or calendar, tell us what you expected. Optional details help us improve
              future versions.
            </p>
            {aiPromptSnapshot?.trim() ? (
              <div>
                <label className="block text-[11px] font-heading font-semibold uppercase tracking-wide text-[#B0AEA5] mb-1.5">
                  What you typed (sent with report)
                </label>
                <pre className="text-xs text-[#141413] bg-[#FAF9F5] border border-[#E8E6DC] rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-body">
                  {aiPromptSnapshot.trim().slice(0, MAX_PROMPT_SNAPSHOT)}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-[#B0AEA5]">No draft text in the box — you can still send what went wrong below.</p>
            )}
            <div>
              <label htmlFor="ai-feedback-note" className="block text-sm font-heading font-medium text-[#141413] mb-1.5">
                What went wrong? <span className="text-[#B0AEA5] font-normal">(optional)</span>
              </label>
              <textarea
                id="ai-feedback-note"
                value={aiNote}
                onChange={(e) => setAiNote(e.target.value)}
                rows={4}
                maxLength={MAX_NOTE}
                placeholder="e.g. It created an event instead of a task, wrong due date, ignored my exam…"
                className="w-full px-3 py-2.5 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] font-body resize-y min-h-[100px]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#D97757] text-white font-heading font-semibold text-sm hover:bg-[#c96b4f]"
            >
              Share with team
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <p className="text-sm text-[#5C5B56] leading-relaxed">
              Bugs, ideas, or anything confusing — we read every note.
            </p>
            <div>
              <label htmlFor="fb-cat" className="block text-sm font-heading font-medium text-[#141413] mb-1.5">
                Type
              </label>
              <select
                id="fb-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'general' | 'bug' | 'feature')}
                className="w-full px-3 py-2.5 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] font-heading bg-white"
              >
                <option value="general">General</option>
                <option value="bug">Something broke</option>
                <option value="feature">Feature idea</option>
              </select>
            </div>
            <div>
              <label htmlFor="fb-msg" className="block text-sm font-heading font-medium text-[#141413] mb-1.5">
                Message
              </label>
              <textarea
                id="fb-msg"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={MAX_NOTE}
                placeholder="What happened? What would you like instead?"
                className="w-full px-3 py-2.5 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] font-body resize-y min-h-[120px]"
              />
            </div>
            <button
              type="submit"
              disabled={!message.trim()}
              className="w-full py-2.5 rounded-xl bg-[#141413] text-white font-heading font-semibold text-sm hover:bg-[#2a2a28] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send feedback
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
