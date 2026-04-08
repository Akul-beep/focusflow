import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/default-signed-in-path';

const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

/** No cookie / session work (OAuth exchange, APIs, static). */
function skipAuthMiddleware(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/auth/callback')) return true;
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|webp|svg|txt|xml|webmanifest)$/i)) {
    return true;
  }
  return false;
}

/** Logged-out users may visit these routes without being redirected to /login. */
function allowsAnonymous(pathname: string): boolean {
  if (pathname === '/' || pathname.startsWith('/landing')) return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/signup')) return true;
  if (pathname.startsWith('/focus-flow')) return true;
  return false;
}

function safeNextParam(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}

const signedInHome = DEFAULT_SIGNED_IN_PATH;

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured || skipAuthMiddleware(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession reads the cookie without a round-trip to Auth; enough for redirects. RLS still enforces data access.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (user) {
    if (pathname === '/login' || pathname === '/signup') {
      const next = safeNextParam(request.nextUrl.searchParams.get('next'), signedInHome);
      return NextResponse.redirect(new URL(next, request.url));
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL(signedInHome, request.url));
    }
  }

  if (!user && !allowsAnonymous(pathname)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
