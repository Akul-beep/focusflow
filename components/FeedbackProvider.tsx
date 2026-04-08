'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import UserFeedbackModal, { type FeedbackModalKind } from '@/components/UserFeedbackModal';

export type OpenFeedbackOptions = {
  kind?: FeedbackModalKind;
  /** For AI feedback: current draft from the task creator. */
  aiPrompt?: string;
};

type FeedbackContextValue = {
  openFeedback: (opts?: OpenFeedbackOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackModalKind>('general');
  const [aiPrompt, setAiPrompt] = useState<string | undefined>();

  const openFeedback = useCallback((opts?: OpenFeedbackOptions) => {
    setKind(opts?.kind ?? 'general');
    setAiPrompt(opts?.aiPrompt);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <UserFeedbackModal open={open} onClose={close} kind={kind} aiPromptSnapshot={aiPrompt} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}
