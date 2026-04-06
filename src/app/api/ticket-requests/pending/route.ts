import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

interface PendingRequestRow {
  id: string;
  ticket_id: string;
  requested_by: string;
  status: 'pending';
  memo: string | null;
  expires_at: string;
  created_at: string;
}

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
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for ticket request API.' },
      { status: 500 },
    );
  }

  const { membership, error: membershipError } = await resolveUserMembership(adminClient, user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError }, { status: 500 });
  }

  if (!membership || membership.status !== 'active' || membership.role !== 'issuer') {
    return NextResponse.json(
      { error: 'Only issuer in an active couple can access pending ticket requests.' },
      { status: 403 },
    );
  }

  const { data: requestedTickets, error: ticketsError } = await adminClient
    .from('tickets')
    .select('id, title')
    .eq('couple_id', membership.coupleId)
    .eq('status', 'requested');

  if (ticketsError) {
    return NextResponse.json(
      { error: `Failed to load requested tickets: ${ticketsError.message}` },
      { status: 500 },
    );
  }

  const ticketMap = new Map(
    (requestedTickets ?? []).map((ticket) => [ticket.id, { id: ticket.id, title: ticket.title }]),
  );

  const requestedTicketIds = [...ticketMap.keys()];

  if (requestedTicketIds.length === 0) {
    return NextResponse.json({ success: true, requests: [] });
  }

  const { data: pendingRequests, error: pendingError } = await adminClient
    .from('ticket_requests')
    .select('id, ticket_id, requested_by, status, memo, expires_at, created_at')
    .in('ticket_id', requestedTicketIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingError) {
    return NextResponse.json(
      { error: `Failed to load pending requests: ${pendingError.message}` },
      { status: 500 },
    );
  }

  const requestRows = (pendingRequests ?? []) as PendingRequestRow[];

  if (requestRows.length === 0) {
    return NextResponse.json({ success: true, requests: [] });
  }

  const requesterIds = [...new Set(requestRows.map((request) => request.requested_by))];

  const { data: requesters, error: requestersError } = await adminClient
    .from('users')
    .select('id, name, email')
    .in('id', requesterIds);

  if (requestersError) {
    return NextResponse.json(
      { error: `Failed to load request users: ${requestersError.message}` },
      { status: 500 },
    );
  }

  const requesterMap = new Map(
    (requesters ?? []).map((requester) => [
      requester.id,
      {
        id: requester.id,
        name: requester.name,
        email: requester.email,
      },
    ]),
  );

  return NextResponse.json({
    success: true,
    requests: requestRows.map((request) => ({
      id: request.id,
      ticketId: request.ticket_id,
      ticketTitle: ticketMap.get(request.ticket_id)?.title ?? '티켓',
      requestedBy:
        requesterMap.get(request.requested_by) ??
        ({ id: request.requested_by, name: '사용자', email: null } as const),
      status: request.status,
      memo: request.memo,
      expiresAt: request.expires_at,
      createdAt: request.created_at,
    })),
  });
}
