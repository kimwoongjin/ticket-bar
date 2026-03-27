import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

interface SignUpRequestBody {
  email: string;
  password: string;
  name?: string;
}

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const parseSignUpBody = async (request: NextRequest): Promise<SignUpRequestBody | null> => {
  try {
    const body = (await request.json()) as Partial<SignUpRequestBody>;

    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return null;
    }

    const email = body.email.trim();
    const password = body.password;
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;

    if (!email || !password || !isValidEmail(email) || password.length < 8) {
      return null;
    }

    return {
      email,
      password,
      name,
    };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await parseSignUpBody(request);

  if (!body) {
    return NextResponse.json(
      {
        error: 'Invalid payload. Provide valid email and password (min 8 chars).',
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        name: body.name,
      },
    },
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
    userId: data.user?.id ?? null,
    emailConfirmationRequired: !data.session,
  });
}
