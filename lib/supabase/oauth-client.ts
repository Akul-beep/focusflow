import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './config';

/**
 * Stateless anon client for server routes that only start OAuth (no session cookies needed).
 */
export function createSupabaseOAuthClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
