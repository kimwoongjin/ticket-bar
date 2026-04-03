import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { resolveRequestOrigin, toSafeNextPath } from '@/utils/url';

interface GoogleSignInRequestBody {
  next?: string;
}

const parseNextPath = async (request: NextRequest): Promise<string> => {
  try {
    const body = (await request.json()) as GoogleSignInRequestBody;
    return toSafeNextPath(body.next ?? null, '/home');
  } catch {
    return '/home';
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const nextPath = await parseNextPath(request);
  const origin = resolveRequestOrigin(request);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      {
        error: error?.message ?? 'Failed to start Google OAuth flow.',
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    url: data.url,
  });
}
