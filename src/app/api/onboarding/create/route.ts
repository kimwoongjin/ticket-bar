import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';
import { ensurePublicUserProfile } from '@/lib/supabase/ensure-user-profile';

const MAX_CODE_GENERATION_ATTEMPTS = 20;

const generateInviteCode = (): string => {
  const randomNumber = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `TB-${randomNumber}`;
};

export async function POST(): Promise<NextResponse> {
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
      {
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for onboarding API.',
      },
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
    if (membership.status === 'active') {
      return NextResponse.json(
        { error: 'User is already connected to an active couple.' },
        { status: 409 },
      );
    }

    if (membership.role === 'issuer') {
      return NextResponse.json({
        success: true,
        coupleId: membership.coupleId,
        inviteCode: membership.inviteCode,
        expiresInHours: 24,
      });
    }

    return NextResponse.json({ error: 'User is already connected to a couple.' }, { status: 409 });
  }

  let createdCouple: { id: string; invite_code: string } | null = null;

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await adminClient
      .from('couples')
      .insert({
        invite_code: inviteCode,
        status: 'pending',
      })
      .select('id, invite_code')
      .single();

    if (!error && data) {
      createdCouple = data;
      break;
    }

    if (error?.code !== '23505') {
      return NextResponse.json(
        { error: `Failed to create invite code: ${error?.message ?? 'unknown error'}` },
        { status: 500 },
      );
    }
  }

  if (!createdCouple) {
    return NextResponse.json({ error: 'Failed to allocate unique invite code.' }, { status: 500 });
  }

  const { error: createMemberError } = await adminClient.from('couple_members').insert({
    couple_id: createdCouple.id,
    user_id: user.id,
    role: 'issuer',
  });

  if (createMemberError) {
    return NextResponse.json(
      { error: `Failed to create issuer membership: ${createMemberError.message}` },
      { status: 500 },
    );
  }

  const { error: createRulesError } = await adminClient.from('rules').insert({
    couple_id: createdCouple.id,
  });

  if (createRulesError) {
    return NextResponse.json(
      { error: `Failed to initialize couple rules: ${createRulesError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    coupleId: createdCouple.id,
    inviteCode: createdCouple.invite_code,
    expiresInHours: 24,
  });
}
