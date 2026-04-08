import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ user: null });
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
