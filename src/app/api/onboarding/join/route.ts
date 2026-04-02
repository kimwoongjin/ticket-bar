import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

interface JoinRequestBody {
  inviteCode: string;
}

const INVITE_CODE_REGEX = /^TB-[0-9]{4}$/;

const parseJoinBody = async (request: NextRequest): Promise<JoinRequestBody | null> => {
  try {
    const body = (await request.json()) as Partial<JoinRequestBody>;

    if (typeof body.inviteCode !== 'string') {
      return null;
    }

    const inviteCode = body.inviteCode.trim().toUpperCase();

    if (!INVITE_CODE_REGEX.test(inviteCode)) {
      return null;
    }

    return { inviteCode };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await parseJoinBody(request);

  if (!body) {
    return NextResponse.json({ error: 'Invalid invite code format.' }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { data: existingMember, error: memberLookupError } = await supabase
    .from('couple_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    return NextResponse.json({ error: 'Failed to verify membership state.' }, { status: 500 });
  }

  if (existingMember) {
    return NextResponse.json({ error: 'User is already connected to a couple.' }, { status: 409 });
  }

  const { data: couple, error: coupleError } = await supabase
    .from('couples')
    .select('id, status')
    .eq('invite_code', body.inviteCode)
    .limit(1)
    .maybeSingle();

  if (coupleError) {
    return NextResponse.json({ error: 'Failed to verify invite code.' }, { status: 500 });
  }

  if (!couple) {
    return NextResponse.json({ error: 'Invite code is invalid or expired.' }, { status: 404 });
  }

  const { error: createMemberError } = await supabase.from('couple_members').insert({
    couple_id: couple.id,
    user_id: user.id,
    role: 'receiver',
  });

  if (createMemberError) {
    return NextResponse.json({ error: 'Failed to join couple.' }, { status: 500 });
  }

  const { error: activateCoupleError } = await supabase
    .from('couples')
    .update({ status: 'active' })
    .eq('id', couple.id);

  if (activateCoupleError) {
    return NextResponse.json({ error: 'Failed to update couple status.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    coupleId: couple.id,
  });
}
