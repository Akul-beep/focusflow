'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getBrowserSupabaseCredentials } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/** Cookie-backed browser client — use from client components / client-only code paths only. */
export function getSupabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowser() must run in the browser');
  }
  if (!client) {
    const { url, anonKey } = getBrowserSupabaseCredentials();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
