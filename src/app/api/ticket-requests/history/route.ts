import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

type RequestStatus = 'approved' | 'rejected' | 'returned';

interface RequestHistoryRow {
  id: string;
  ticket_id: string;
  requested_by: string;
  status: RequestStatus;
  memo: string | null;
  requested_for_date: string | null;
  response_memo: string | null;
  responded_at: string | null;
  created_at: string;
}

const TARGET_STATUSES: RequestStatus[] = ['approved', 'rejected', 'returned'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const summaryOnly = request.nextUrl.searchParams.get('summary') === 'true';

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
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for ticket request API.' },
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
    .select('id, title')
    .eq('couple_id', membership.coupleId);

  if (ticketsError) {
    return NextResponse.json(
      { error: `Failed to load tickets: ${ticketsError.message}` },
      { status: 500 },
    );
  }

  const ticketMap = new Map(
    (tickets ?? []).map((ticket) => [ticket.id, { id: ticket.id, title: ticket.title }]),
  );

  const ticketIds = [...ticketMap.keys()];

  if (ticketIds.length === 0) {
    return NextResponse.json({ success: true, totalCount: 0, requests: [] });
  }

  let countQuery = adminClient
    .from('ticket_requests')
    .select('id', { count: 'exact', head: true })
    .in('ticket_id', ticketIds)
    .in('status', TARGET_STATUSES);

  if (membership.role === 'receiver') {
    countQuery = countQuery.eq('requested_by', user.id);
  }

  const { count: totalCount, error: countError } = await countQuery;

  if (countError) {
    return NextResponse.json(
      { error: `Failed to load request history count: ${countError.message}` },
      { status: 500 },
    );
  }

  if (summaryOnly) {
    return NextResponse.json({ success: true, totalCount: totalCount ?? 0 });
  }

  let historyQuery = adminClient
    .from('ticket_requests')
    .select(
      'id, ticket_id, requested_by, status, memo, requested_for_date, response_memo, responded_at, created_at',
    )
    .in('ticket_id', ticketIds)
    .in('status', TARGET_STATUSES)
    .order('created_at', { ascending: false })
    .limit(20);

  if (membership.role === 'receiver') {
    historyQuery = historyQuery.eq('requested_by', user.id);
  }

  const { data: requestHistory, error: historyError } = await historyQuery;

  if (historyError) {
    return NextResponse.json(
      { error: `Failed to load request history: ${historyError.message}` },
      { status: 500 },
    );
  }

  const requestRows = (requestHistory ?? []) as RequestHistoryRow[];

  const requesterIds = [...new Set(requestRows.map((request) => request.requested_by))];
  const requesterMap = new Map<string, { id: string; name: string; email: string | null }>();

  if (requesterIds.length > 0) {
    const { data: requesters, error: requesterError } = await adminClient
      .from('users')
      .select('id, name, email')
      .in('id', requesterIds);

    if (requesterError) {
      return NextResponse.json(
        { error: `Failed to load request users: ${requesterError.message}` },
        { status: 500 },
      );
    }

    (requesters ?? []).forEach((requester) => {
      requesterMap.set(requester.id, {
        id: requester.id,
        name: requester.name,
        email: requester.email,
      });
    });
  }

  return NextResponse.json({
    success: true,
    totalCount: totalCount ?? 0,
    requests: requestRows.map((request) => ({
      id: request.id,
      ticketId: request.ticket_id,
      ticketTitle: ticketMap.get(request.ticket_id)?.title ?? '티켓',
      requestedBy:
        requesterMap.get(request.requested_by) ??
        ({ id: request.requested_by, name: '사용자', email: null } as const),
      status: request.status,
      memo: request.memo,
      requestedForDate: request.requested_for_date ?? request.created_at.slice(0, 10),
      responseMemo: request.response_memo,
      respondedAt: request.responded_at,
      createdAt: request.created_at,
    })),
  });
}
