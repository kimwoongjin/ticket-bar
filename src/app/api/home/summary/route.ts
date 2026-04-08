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
  requested_for_date: string | null;
  expires_at: string;
  created_at: string;
}

const getMonthRange = (): {
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
} => {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  return {
    currentStartIso: currentStart.toISOString(),
    currentEndIso: currentEnd.toISOString(),
    previousStartIso: previousStart.toISOString(),
    previousEndIso: previousEnd.toISOString(),
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
  const { currentStartIso, currentEndIso, previousStartIso, previousEndIso } = getMonthRange();

  const [
    viewerProfileResult,
    availableCountResult,
    totalCountResult,
    usedCountResult,
    previousUsedCountResult,
    requestedTicketsResult,
  ] = await Promise.all([
    adminClient.from('users').select('name').eq('id', user.id).limit(1).maybeSingle(),
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .eq('status', 'available'),
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .in('status', ['available', 'requested', 'used']),
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .eq('status', 'used')
      .gte('used_at', currentStartIso)
      .lt('used_at', currentEndIso),
    adminClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', membership.coupleId)
      .eq('status', 'used')
      .gte('used_at', previousStartIso)
      .lt('used_at', previousEndIso),
    adminClient
      .from('tickets')
      .select('id, title')
      .eq('couple_id', membership.coupleId)
      .eq('status', 'requested'),
  ]);

  if (viewerProfileResult.error) {
    return NextResponse.json(
      { error: `Failed to load viewer profile: ${viewerProfileResult.error.message}` },
      { status: 500 },
    );
  }

  if (availableCountResult.error) {
    return NextResponse.json(
      { error: `Failed to load available ticket count: ${availableCountResult.error.message}` },
      { status: 500 },
    );
  }

  if (totalCountResult.error) {
    return NextResponse.json(
      { error: `Failed to load total ticket count: ${totalCountResult.error.message}` },
      { status: 500 },
    );
  }

  if (usedCountResult.error) {
    return NextResponse.json(
      { error: `Failed to load monthly used count: ${usedCountResult.error.message}` },
      { status: 500 },
    );
  }

  if (previousUsedCountResult.error) {
    return NextResponse.json(
      {
        error: `Failed to load previous monthly used count: ${previousUsedCountResult.error.message}`,
      },
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
      .select('id, ticket_id, requested_by, memo, requested_for_date, expires_at, created_at')
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
  const nearestPending = pendingRequests.reduce<PendingRequestRow | null>((nearest, current) => {
    if (!nearest) {
      return current;
    }

    return new Date(current.expires_at).getTime() < new Date(nearest.expires_at).getTime()
      ? current
      : nearest;
  }, null);

  const viewerName = viewerProfileResult.data?.name ?? null;

  return NextResponse.json({
    success: true,
    viewerName,
    role,
    availableTicketCount: availableCountResult.count ?? 0,
    totalTicketCount: totalCountResult.count ?? 0,
    monthlyUsedCount: usedCountResult.count ?? 0,
    previousMonthlyUsedCount: previousUsedCountResult.count ?? 0,
    pendingRequestCount: pendingRequests.length,
    nearestPendingExpiresAt: nearestPending?.expires_at ?? null,
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
          requestedForDate:
            latestPending.requested_for_date ?? latestPending.created_at.slice(0, 10),
          expiresAt: latestPending.expires_at,
          createdAt: latestPending.created_at,
        }
      : null,
  });
}
