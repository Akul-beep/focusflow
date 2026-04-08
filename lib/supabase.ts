/**
 * Supabase entrypoints — prefer named imports from `lib/supabase/*` in new code.
 */
export { isSupabaseConfigured, getBrowserSupabaseCredentials, requireSupabaseEnv } from './supabase/config';
export { getSupabaseBrowser } from './supabase/browser';
export { createSupabaseRouteHandlerClient } from './supabase/server';
export { createSupabaseOAuthClient } from './supabase/oauth-client';

/** @deprecated Use `createSupabaseOAuthClient` — name kept for older imports. */
export { createSupabaseOAuthClient as createServerClient } from './supabase/oauth-client';
