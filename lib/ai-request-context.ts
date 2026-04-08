import { AsyncLocalStorage } from 'async_hooks';

export type AiRequestStore = {
  /** When set, Gemini calls in this request use this key (BYOK) instead of the server env key. */
  geminiApiKeyOverride?: string;
};

export const aiRequestAsyncLocal = new AsyncLocalStorage<AiRequestStore>();

export function getGeminiKeyOverrideForRequest(): string | undefined {
  return aiRequestAsyncLocal.getStore()?.geminiApiKeyOverride;
}
