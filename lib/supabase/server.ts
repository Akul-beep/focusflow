import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseEnv } from './config';

/**
 * Route Handler / Server Action client: reads and writes auth cookies.
 * Use in `auth/callback`, sign-out, and any server route that needs the user session.
 */
export async function createSupabaseRouteHandlerClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* set from Server Component — ignore */
        }
      },
    },
  });
}
