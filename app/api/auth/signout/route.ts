import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: true });
    }
    const supabase = await createSupabaseRouteHandlerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
