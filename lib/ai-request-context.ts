import { AsyncLocalStorage } from 'async_hooks';

export type AiRequestStore = {
  /** When set, all Groq calls in this request use this key (BYOK) — no shared-model fallbacks. */
  groqApiKeyOverride?: string;
};

export const aiRequestAsyncLocal = new AsyncLocalStorage<AiRequestStore>();

export function getGroqKeyOverrideForRequest(): string | undefined {
  return aiRequestAsyncLocal.getStore()?.groqApiKeyOverride;
}
