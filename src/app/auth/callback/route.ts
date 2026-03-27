import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { resolveRequestOrigin, toSafeNextPath } from '@/utils/url';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = toSafeNextPath(request.nextUrl.searchParams.get('next'), '/');
  const origin = resolveRequestOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
