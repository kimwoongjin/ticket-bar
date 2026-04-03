import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
