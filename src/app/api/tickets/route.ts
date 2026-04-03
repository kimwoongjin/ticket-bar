import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
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
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for tickets API.' },
      { status: 500 },
    );
  }

  const { membership, error: membershipError } = await resolveUserMembership(adminClient, user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError }, { status: 500 });
  }

  if (!membership || membership.status !== 'active') {
    return NextResponse.json({ error: 'Active couple membership is required.' }, { status: 403 });
  }

  const { data: tickets, error: ticketsError } = await adminClient
    .from('tickets')
    .select('id, title, status, expires_at, created_at')
    .eq('couple_id', membership.coupleId)
    .order('created_at', { ascending: false });

  if (ticketsError) {
    return NextResponse.json(
      { error: `Failed to load tickets: ${ticketsError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    tickets:
      tickets?.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        expiresAt: ticket.expires_at,
        createdAt: ticket.created_at,
      })) ?? [],
  });
}
