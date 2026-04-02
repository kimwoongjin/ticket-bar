import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
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

  const { data: existingMember, error: memberLookupError } = await adminClient
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
