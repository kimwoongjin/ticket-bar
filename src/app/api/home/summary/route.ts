import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

type MembershipRole = 'issuer' | 'receiver';

interface PendingRequestRow {
  id: string;
  ticket_id: string;
  requested_by: string;
  memo: string | null;
  expires_at: string;
  created_at: string;
}

const getMonthRange = (): { startIso: string; endIso: string } => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

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
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for home summary API.' },
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

  const role = membership.role as MembershipRole;
  const { startIso, endIso } = getMonthRange();

  const [availableCountResult, usedCountResult, requestedTicketsResult] = await Promise.all([
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .eq('status', 'available'),
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .eq('status', 'used')
      .gte('used_at', startIso)
      .lt('used_at', endIso),
    adminClient
      .from('tickets')
      .select('id, title')
      .eq('couple_id', membership.coupleId)
      .eq('status', 'requested'),
  ]);

  if (availableCountResult.error) {
    return NextResponse.json(
      { error: `Failed to load available ticket count: ${availableCountResult.error.message}` },
      { status: 500 },
    );
  }

  if (usedCountResult.error) {
    return NextResponse.json(
      { error: `Failed to load monthly used count: ${usedCountResult.error.message}` },
      { status: 500 },
    );
  }

  if (requestedTicketsResult.error) {
    return NextResponse.json(
      { error: `Failed to load requested tickets: ${requestedTicketsResult.error.message}` },
      { status: 500 },
    );
  }

  const requestedTickets = requestedTicketsResult.data ?? [];
  const requestedTicketIds = requestedTickets.map((ticket) => ticket.id);
  const requestedTicketMap = new Map(
    requestedTickets.map((ticket) => [ticket.id, { id: ticket.id, title: ticket.title }]),
  );

  let pendingRequests: PendingRequestRow[] = [];

  if (requestedTicketIds.length > 0) {
    let pendingQuery = adminClient
      .from('ticket_requests')
      .select('id, ticket_id, requested_by, memo, expires_at, created_at')
      .in('ticket_id', requestedTicketIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (role === 'receiver') {
      pendingQuery = pendingQuery.eq('requested_by', user.id);
    }

    const { data: pendingData, error: pendingError } = await pendingQuery;

    if (pendingError) {
      return NextResponse.json(
        { error: `Failed to load pending requests: ${pendingError.message}` },
        { status: 500 },
      );
    }

    pendingRequests = (pendingData ?? []) as PendingRequestRow[];
  }

  const requesterIds = [...new Set(pendingRequests.map((request) => request.requested_by))];
  const requesterMap = new Map<string, { name: string; email: string | null }>();

  if (requesterIds.length > 0) {
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select('id, name, email')
      .in('id', requesterIds);

    if (usersError) {
      return NextResponse.json(
        { error: `Failed to load request users: ${usersError.message}` },
        { status: 500 },
      );
    }

    (users ?? []).forEach((userRow) => {
      requesterMap.set(userRow.id, {
        name: userRow.name,
        email: userRow.email,
      });
    });
  }

  const latestPending = pendingRequests[0];

  return NextResponse.json({
    success: true,
    role,
    availableTicketCount: availableCountResult.count ?? 0,
    monthlyUsedCount: usedCountResult.count ?? 0,
    pendingRequestCount: pendingRequests.length,
    latestPendingRequest: latestPending
      ? {
          id: latestPending.id,
          ticketId: latestPending.ticket_id,
          ticketTitle: requestedTicketMap.get(latestPending.ticket_id)?.title ?? '티켓',
          requestedBy: {
            id: latestPending.requested_by,
            name: requesterMap.get(latestPending.requested_by)?.name ?? '사용자',
            email: requesterMap.get(latestPending.requested_by)?.email ?? null,
          },
          memo: latestPending.memo,
          expiresAt: latestPending.expires_at,
          createdAt: latestPending.created_at,
        }
      : null,
  });
}
