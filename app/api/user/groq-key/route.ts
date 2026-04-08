import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { encryptUserGroqKey, isValidUserGeminiApiKeyFormat } from '@/lib/ai-user-groq-key-crypto';

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data } = await supabase
    .from('user_ai_credentials')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return NextResponse.json({ hasKey: Boolean(data) });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const key = typeof body === 'object' && body !== null && 'key' in body ? String((body as { key?: unknown }).key || '').trim() : '';
  if (!isValidUserGeminiApiKeyFormat(key)) {
    return NextResponse.json(
      { error: 'That does not look like a Gemini API key (should start with AIza…).' },
      { status: 400 }
    );
  }

  let ciphertext: string;
  try {
    ciphertext = encryptUserGroqKey(key);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not encrypt key on the server.';
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error } = await supabase.from('user_ai_credentials').upsert(
    {
      user_id: user.id,
      groq_key_ciphertext: ciphertext,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    return NextResponse.json({ error: 'Could not save your key. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await supabase.from('user_ai_credentials').delete().eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
