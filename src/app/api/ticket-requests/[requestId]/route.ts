import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

type RespondAction = 'approve' | 'reject' | 'return';
type RequestStatus = 'approved' | 'rejected' | 'returned';

interface RespondTicketRequestPayload {
  action: RespondAction;
  logMemo: string | null;
}

const MAX_LOG_MEMO_LENGTH = 300;

const isValidUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const parsePayload = async (request: NextRequest): Promise<RespondTicketRequestPayload | null> => {
  try {
    const body = (await request.json()) as Partial<RespondTicketRequestPayload>;

    if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'return') {
      return null;
    }

    if (body.logMemo !== undefined && body.logMemo !== null && typeof body.logMemo !== 'string') {
      return null;
    }

    const normalizedLogMemo = body.logMemo?.trim() ?? null;

    if (normalizedLogMemo && normalizedLogMemo.length > MAX_LOG_MEMO_LENGTH) {
      return null;
    }

    return {
      action: body.action,
      logMemo: normalizedLogMemo,
    };
  } catch {
    return null;
  }
};

const toRequestStatus = (action: RespondAction): RequestStatus => {
  if (action === 'approve') {
    return 'approved';
  }

  if (action === 'reject') {
    return 'rejected';
  }

  return 'returned';
};

export async function PATCH(
  request: NextRequest,
  context: { params: { requestId: string } },
): Promise<NextResponse> {
  const requestId = context.params.requestId;

  if (!isValidUuid(requestId)) {
    return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  }

  const payload = await parsePayload(request);

  if (!payload) {
    return NextResponse.json(
      {
        error:
          'Invalid payload. action(approve|reject|return) is required and logMemo must be <= 300 chars.',
      },
      { status: 400 },
    );
  }

  if (payload.action === 'reject' && !payload.logMemo) {
    return NextResponse.json({ error: 'Reject action requires a reason.' }, { status: 400 });
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
      { error: 'Only issuer in an active couple can respond to ticket requests.' },
      { status: 403 },
    );
  }

  const { data: existingRequest, error: requestLoadError } = await adminClient
    .from('ticket_requests')
    .select(
      'id, ticket_id, requested_by, status, memo, requested_for_date, response_memo, expires_at, created_at',
    )
    .eq('id', requestId)
    .limit(1)
    .maybeSingle();

  if (requestLoadError) {
    return NextResponse.json(
      { error: `Failed to load ticket request: ${requestLoadError.message}` },
      { status: 500 },
    );
  }

  if (!existingRequest) {
    return NextResponse.json({ error: 'Ticket request not found.' }, { status: 404 });
  }

  const { data: ticket, error: ticketLoadError } = await adminClient
    .from('tickets')
    .select('id, couple_id, status')
    .eq('id', existingRequest.ticket_id)
    .limit(1)
    .maybeSingle();

  if (ticketLoadError) {
    return NextResponse.json(
      { error: `Failed to load ticket: ${ticketLoadError.message}` },
      { status: 500 },
    );
  }

  if (!ticket || ticket.couple_id !== membership.coupleId) {
    return NextResponse.json({ error: 'Ticket request not found.' }, { status: 404 });
  }

  if (existingRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending request can be responded.' }, { status: 409 });
  }

  const targetRequestStatus = toRequestStatus(payload.action);
  const nowIso = new Date().toISOString();
  const nextResponseMemo = payload.action === 'reject' ? payload.logMemo : null;

  const { data: updatedRequest, error: requestUpdateError } = await adminClient
    .from('ticket_requests')
    .update({
      status: targetRequestStatus,
      response_memo: nextResponseMemo,
      responded_at: nowIso,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select(
      'id, ticket_id, requested_by, status, memo, requested_for_date, response_memo, expires_at, responded_at, created_at',
    )
    .limit(1)
    .maybeSingle();

  if (requestUpdateError) {
    return NextResponse.json(
      { error: `Failed to update ticket request: ${requestUpdateError.message}` },
      { status: 500 },
    );
  }

  if (!updatedRequest) {
    return NextResponse.json(
      { error: 'Ticket request is no longer pending. Please refresh and try again.' },
      { status: 409 },
    );
  }

  const nextTicketStatus = payload.action === 'approve' ? 'used' : 'available';
  const nextUsedAt = payload.action === 'approve' ? nowIso : null;

  const { data: updatedTicket, error: ticketUpdateError } = await adminClient
    .from('tickets')
    .update({
      status: nextTicketStatus,
      used_at: nextUsedAt,
    })
    .eq('id', existingRequest.ticket_id)
    .eq('couple_id', membership.coupleId)
    .eq('status', 'requested')
    .select('id, status, used_at')
    .limit(1)
    .maybeSingle();

  if (ticketUpdateError || !updatedTicket) {
    const { error: rollbackRequestError } = await adminClient
      .from('ticket_requests')
      .update({
        status: 'pending',
        response_memo: null,
        responded_at: null,
      })
      .eq('id', requestId)
      .eq('status', targetRequestStatus);

    if (rollbackRequestError) {
      return NextResponse.json(
        {
          error: `Failed to update ticket and failed to rollback request state: ${ticketUpdateError?.message ?? 'ticket state mismatch'} / ${rollbackRequestError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: `Failed to update ticket state: ${ticketUpdateError?.message ?? 'ticket state mismatch'}`,
      },
      { status: 500 },
    );
  }

  if (payload.action === 'approve') {
    const { error: logInsertError } = await adminClient.from('ticket_logs').insert({
      ticket_id: existingRequest.ticket_id,
      request_id: requestId,
      memo: payload.logMemo ?? existingRequest.memo ?? '승인 처리됨',
    });

    if (logInsertError) {
      const { error: rollbackRequestError } = await adminClient
        .from('ticket_requests')
        .update({
          status: 'pending',
          response_memo: null,
          responded_at: null,
        })
        .eq('id', requestId)
        .eq('status', 'approved');

      const { error: rollbackTicketError } = await adminClient
        .from('tickets')
        .update({
          status: 'requested',
          used_at: null,
        })
        .eq('id', existingRequest.ticket_id)
        .eq('status', 'used');

      if (rollbackRequestError || rollbackTicketError) {
        return NextResponse.json(
          {
            error: `Failed to create ticket log and rollback failed: ${logInsertError.message}`,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: `Failed to create ticket log: ${logInsertError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    request: {
      id: updatedRequest.id,
      ticketId: updatedRequest.ticket_id,
      requestedBy: updatedRequest.requested_by,
      status: updatedRequest.status,
      memo: updatedRequest.memo,
      requestedForDate: updatedRequest.requested_for_date,
      responseMemo: updatedRequest.response_memo,
      expiresAt: updatedRequest.expires_at,
      respondedAt: updatedRequest.responded_at,
      createdAt: updatedRequest.created_at,
    },
    ticket: {
      id: updatedTicket.id,
      status: updatedTicket.status,
      usedAt: updatedTicket.used_at,
    },
  });
}
