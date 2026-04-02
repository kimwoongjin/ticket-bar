import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(): Promise<NextResponse> {
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

  const { data: member, error: memberError } = await adminClient
    .from('couple_members')
    .select('couple_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: 'Failed to load membership.' }, { status: 500 });
  }

  if (!member?.couple_id) {
    return NextResponse.json({ connected: false, memberCount: 0 });
  }

  const { data: couple, error: coupleError } = await adminClient
    .from('couples')
    .select('id, invite_code, status')
    .eq('id', member.couple_id)
    .limit(1)
    .maybeSingle();

  if (coupleError) {
    return NextResponse.json({ error: 'Failed to load couple status.' }, { status: 500 });
  }

  if (!couple) {
    return NextResponse.json({ connected: false, memberCount: 0 });
  }

  const { data: members, error: membersError } = await adminClient
    .from('couple_members')
    .select('id')
    .eq('couple_id', couple.id);

  if (membersError) {
    return NextResponse.json({ error: 'Failed to load member count.' }, { status: 500 });
  }

  const memberCount = members?.length ?? 0;

  return NextResponse.json({
    connected: couple.status === 'active' && memberCount >= 2,
    memberCount,
    role: member.role,
    coupleId: couple.id,
    inviteCode: couple.invite_code,
    status: couple.status,
  });
}
