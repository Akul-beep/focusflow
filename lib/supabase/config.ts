const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

/** False when URL/key missing — skip cloud auth/sync. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export function getBrowserSupabaseCredentials(): { url: string; anonKey: string } {
  if (isSupabaseConfigured) {
    return { url: supabaseUrl, anonKey: supabaseAnonKey };
  }
  return { url: PLACEHOLDER_URL, anonKey: PLACEHOLDER_KEY };
}

/** Throws if env missing — use only when `isSupabaseConfigured` is true. */
export function requireSupabaseEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  return { supabaseUrl, supabaseAnonKey };
}
