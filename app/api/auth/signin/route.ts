import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/default-signed-in-path';
import { isSupabaseConfigured, requireSupabaseEnv } from '@/lib/supabase/config';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Start Google OAuth. PKCE requires persisting a code verifier in cookies before the user
 * leaves for Google — a stateless anon client cannot do that, so we use @supabase/ssr
 * and attach the same cookies to this JSON response.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  try {
    let nextPath = DEFAULT_SIGNED_IN_PATH;
    try {
      const body = (await request.json()) as { next?: string };
      if (
        typeof body?.next === 'string' &&
        body.next.startsWith('/') &&
        !body.next.startsWith('//')
      ) {
        nextPath = body.next;
      }
    } catch {
      /* no JSON body — default next */
    }

    const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();
    const callback = new URL('/auth/callback', request.nextUrl.origin);
    callback.searchParams.set('next', nextPath);

    const pendingCookies: CookieToSet[] = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback.toString(),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.url) {
      return NextResponse.json({ error: 'No OAuth URL returned' }, { status: 500 });
    }

    const res = NextResponse.json({ url: data.url });
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
    }
    return res;
  } catch (error) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate sign in' },
      { status: 500 }
    );
  }
}
