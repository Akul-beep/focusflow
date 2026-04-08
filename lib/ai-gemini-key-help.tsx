'use client';

import Link from 'next/link';

/** Hash target for the AI assistant card on Settings (scroll + focus). */
export const SETTINGS_AI_ASSISTANT_HREF = '/settings#ai-assistant';

export function GeminiApiKeyStepsList() {
  return (
    <ol className="list-decimal pl-4 space-y-2 text-xs text-[var(--text-subtle)] font-body leading-relaxed">
      <li>
        Open{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] font-medium hover:underline"
        >
          Google AI Studio — API keys
        </a>{' '}
        in your browser.
      </li>
      <li>Sign in with your Google account if you are asked.</li>
      <li>
        Click <strong className="font-heading text-[var(--foreground)]">Create API key</strong> (or{' '}
        <strong className="font-heading text-[var(--foreground)]">Get API key</strong>), then create a key in a new or
        existing project.
      </li>
      <li>
        Copy the key when it appears — it starts with{' '}
        <code className="rounded px-1 py-0.5 font-mono text-[11px] bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border-default)]">
          AIza
        </code>
        .
      </li>
      <li>
        Paste it in the field below on this page and tap{' '}
        <strong className="font-heading text-[var(--foreground)]">Save API key</strong>. You must be signed in: the key is
        saved to your Flowly account (encrypted) and applies on{' '}
        <strong className="font-heading text-[var(--foreground)]">every device</strong> where you use the same login.
      </li>
    </ol>
  );
}

/** Always-visible steps (easy to find — not hidden behind a collapsed disclosure). */
export function GeminiApiKeyStepsPanel() {
  return (
    <div className="rounded-xl border p-4 space-y-2 bg-[var(--surface-muted)] border-[var(--border-default)] shadow-sm">
      <p className="text-sm font-heading font-semibold text-[var(--foreground)]">How to add your Gemini API key</p>
      <p className="text-xs text-[var(--text-subtle)] font-body leading-relaxed">
        Follow these steps once. After you save, the AI task creator uses{' '}
        <strong className="font-medium text-[var(--foreground)]">your</strong> quota — not the small shared daily limit —
        on this and other devices when you’re signed in.
      </p>
      <GeminiApiKeyStepsList />
      <p className="text-[11px] text-[var(--text-muted)] font-body pt-1 border-t border-[var(--border-default)]">
        Tip: from the dashboard, use the link next to your daily counter to jump back here (
        <Link href={SETTINGS_AI_ASSISTANT_HREF} className="text-[var(--accent)] font-medium hover:underline">
          Settings → AI assistant
        </Link>
        ).
      </p>
    </div>
  );
}

type GeminiApiKeyStepsDetailsProps = {
  className?: string;
  summaryClassName?: string;
};

/** Collapsible variant (optional; prefer {@link GeminiApiKeyStepsPanel} where discoverability matters). */
export function GeminiApiKeyStepsDetails({ className, summaryClassName }: GeminiApiKeyStepsDetailsProps) {
  return (
    <details className={className}>
      <summary
        className={
          summaryClassName ??
          'cursor-pointer text-xs font-heading font-medium text-[var(--foreground)] list-none [&::-webkit-details-marker]:hidden'
        }
      >
        <span className="underline-offset-2 hover:underline">Step-by-step: get a Gemini API key</span>
      </summary>
      <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
        <GeminiApiKeyStepsList />
      </div>
    </details>
  );
}
