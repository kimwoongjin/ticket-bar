import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';
import { ensurePublicUserProfile } from '@/lib/supabase/ensure-user-profile';

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

  let adminClient: ReturnType<typeof createAdminClient>;

  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for onboarding API.' },
      { status: 500 },
    );
  }

  const ensuredUserProfile = await ensurePublicUserProfile(adminClient, user);
  if (!ensuredUserProfile.ok) {
    return NextResponse.json(
      { error: `Failed to prepare user profile: ${ensuredUserProfile.error}` },
      { status: 500 },
    );
  }

  const { membership, error: membershipError } = await resolveUserMembership(adminClient, user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError }, { status: 500 });
  }

  if (membership) {
    return NextResponse.json({ error: 'User is already connected to a couple.' }, { status: 409 });
  }

  const { data: couple, error: coupleError } = await adminClient
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

  const { error: createMemberError } = await adminClient.from('couple_members').insert({
    couple_id: couple.id,
    user_id: user.id,
    role: 'receiver',
  });

  if (createMemberError) {
    return NextResponse.json(
      { error: `Failed to join couple: ${createMemberError.message}` },
      { status: 500 },
    );
  }

  const { error: activateCoupleError } = await adminClient
    .from('couples')
    .update({ status: 'active' })
    .eq('id', couple.id);

  if (activateCoupleError) {
    return NextResponse.json(
      { error: `Failed to update couple status: ${activateCoupleError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    coupleId: couple.id,
  });
}
