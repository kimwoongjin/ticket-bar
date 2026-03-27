import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

interface SignInRequestBody {
  email: string;
  password: string;
}

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const parseSignInBody = async (request: NextRequest): Promise<SignInRequestBody | null> => {
  try {
    const body = (await request.json()) as Partial<SignInRequestBody>;

    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return null;
    }

    const email = body.email.trim();
    const password = body.password;

    if (!email || !password || !isValidEmail(email)) {
      return null;
    }

    return {
      email,
      password,
    };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await parseSignInBody(request);

  if (!body) {
    return NextResponse.json(
      {
        error: 'Invalid payload. Provide valid email and password.',
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
  });
}
