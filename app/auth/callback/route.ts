import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/default-signed-in-path';
import { isSupabaseConfigured, requireSupabaseEnv } from '@/lib/supabase/config';

/**
 * OAuth (e.g. Google) redirects here with `?code=`. We exchange the code for a session
 * and must attach auth cookies to the **same** redirect response (Next.js route handlers).
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const oauthError = requestUrl.searchParams.get('error');
  const oauthDesc = requestUrl.searchParams.get('error_description');
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next') || DEFAULT_SIGNED_IN_PATH;
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : DEFAULT_SIGNED_IN_PATH;

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL('/login?error=config', request.url));
  }

  if (oauthError) {
    const detail = oauthDesc || oauthError;
    console.error('OAuth provider error:', oauthError, detail);
    const login = new URL('/login', request.url);
    login.searchParams.set('error', 'oauth');
    login.searchParams.set('details', detail.slice(0, 300));
    return NextResponse.redirect(login);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }

  const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();
  const redirectUrl = new URL(next, requestUrl.origin);

  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.redirect(redirectUrl);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }

  const session = exchanged?.session;
  const user = session?.user;
  const accessToken = session?.access_token;

  if (user && accessToken) {
    const md = (user.user_metadata || {}) as Record<string, unknown>;
    const weekdayStart = String(md.onboarding_weekday_start || '').trim();
    const weekdayEnd = String(md.onboarding_weekday_end || '').trim();
    const weekendStart = String(md.onboarding_weekend_start || '').trim();
    const weekendEnd = String(md.onboarding_weekend_end || '').trim();
    const studyPace = String(md.onboarding_study_pace || '').trim();
    const personalGoal = String(md.onboarding_personal_goal || '').trim();
    const dailyBriefing = md.onboarding_daily_briefing;
    const themePref = String(md.theme_preference || '').trim();

    if (weekdayStart || weekdayEnd || weekendStart || weekendEnd || studyPace || personalGoal || themePref) {
      const userId = user.id;
      const nowIso = new Date().toISOString();
      after(async () => {
        try {
          const sb = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
          });
          await sb.from('user_preferences').upsert(
            {
              user_id: userId,
              ...(weekdayStart ? { schedule_work_start: weekdayStart } : {}),
              ...(weekdayEnd ? { schedule_work_end: weekdayEnd } : {}),
              ...(weekendStart ? { schedule_weekend_start: weekendStart } : {}),
              ...(weekendEnd ? { schedule_weekend_end: weekendEnd } : {}),
              ...(studyPace ? { schedule_study_pace: studyPace } : {}),
              ...(personalGoal ? { motivation_personal_goal: personalGoal } : {}),
              ...(typeof dailyBriefing === 'boolean' ? { motivation_daily_briefing: dailyBriefing } : {}),
              ...(themePref ? { theme_preference: themePref } : {}),
              onboarding_completed_at: nowIso,
              updated_at: nowIso,
              synced_at: nowIso,
            },
            { onConflict: 'user_id' }
          );
        } catch (e) {
          console.warn('Auth callback onboarding preference sync skipped:', e);
        }
      });
    }
  }

  return response;
}
