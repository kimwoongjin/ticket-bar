import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { toSafeNextPath } from '@/utils/url';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = toSafeNextPath(request.nextUrl.searchParams.get('next'), '/');

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
