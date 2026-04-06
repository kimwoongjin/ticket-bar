import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

interface CreateTicketRequestPayload {
  ticketId: string;
  memo: string | null;
}

const MAX_MEMO_LENGTH = 300;

const isValidUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const parsePayload = async (request: NextRequest): Promise<CreateTicketRequestPayload | null> => {
  try {
    const body = (await request.json()) as Partial<CreateTicketRequestPayload>;

    if (typeof body.ticketId !== 'string' || !isValidUuid(body.ticketId)) {
      return null;
    }

    if (body.memo !== undefined && body.memo !== null && typeof body.memo !== 'string') {
      return null;
    }

    const normalizedMemo = body.memo?.trim() ?? null;

    if (normalizedMemo && normalizedMemo.length > MAX_MEMO_LENGTH) {
      return null;
    }

    return {
      ticketId: body.ticketId,
      memo: normalizedMemo,
    };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await parsePayload(request);

  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid payload. ticketId(uuid) is required and memo must be <= 300 chars.' },
      { status: 400 },
    );
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

  if (!membership || membership.status !== 'active' || membership.role !== 'receiver') {
    return NextResponse.json(
      { error: 'Only receiver in an active couple can create ticket requests.' },
      { status: 403 },
    );
  }

  const { data: ticket, error: ticketError } = await adminClient
    .from('tickets')
    .select('id, couple_id, status')
    .eq('id', payload.ticketId)
    .limit(1)
    .maybeSingle();

  if (ticketError) {
    return NextResponse.json(
      { error: `Failed to load ticket: ${ticketError.message}` },
      { status: 500 },
    );
  }

  if (!ticket || ticket.couple_id !== membership.coupleId) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  if (ticket.status !== 'available') {
    return NextResponse.json({ error: 'Only available ticket can be requested.' }, { status: 409 });
  }

  const { data: pendingRequest, error: pendingError } = await adminClient
    .from('ticket_requests')
    .select('id')
    .eq('ticket_id', payload.ticketId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json(
      { error: `Failed to verify pending requests: ${pendingError.message}` },
      { status: 500 },
    );
  }

  if (pendingRequest) {
    return NextResponse.json(
      { error: 'Pending request already exists for this ticket.' },
      { status: 409 },
    );
  }

  const { data: rules, error: rulesError } = await adminClient
    .from('rules')
    .select('timeout_hours')
    .eq('couple_id', membership.coupleId)
    .limit(1)
    .maybeSingle();

  if (rulesError) {
    return NextResponse.json(
      { error: `Failed to load rules: ${rulesError.message}` },
      { status: 500 },
    );
  }

  const timeoutHours = rules?.timeout_hours ?? 24;
  const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000).toISOString();

  const { data: reservedTicket, error: reserveError } = await adminClient
    .from('tickets')
    .update({
      status: 'requested',
    })
    .eq('id', payload.ticketId)
    .eq('couple_id', membership.coupleId)
    .eq('status', 'available')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (reserveError) {
    return NextResponse.json(
      { error: `Failed to reserve ticket: ${reserveError.message}` },
      { status: 500 },
    );
  }

  if (!reservedTicket) {
    return NextResponse.json(
      { error: 'Ticket is no longer available. Please refresh and try again.' },
      { status: 409 },
    );
  }

  const { data: createdRequest, error: createError } = await adminClient
    .from('ticket_requests')
    .insert({
      ticket_id: payload.ticketId,
      requested_by: user.id,
      memo: payload.memo,
      expires_at: expiresAt,
      status: 'pending',
    })
    .select('id, ticket_id, requested_by, status, memo, expires_at, created_at')
    .single();

  if (createError || !createdRequest) {
    const { error: rollbackError } = await adminClient
      .from('tickets')
      .update({ status: 'available' })
      .eq('id', payload.ticketId)
      .eq('status', 'requested');

    if (rollbackError) {
      return NextResponse.json(
        {
          error: `Failed to create request and rollback ticket state: ${createError?.message ?? 'unknown'} / ${rollbackError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: `Failed to create ticket request: ${createError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    request: {
      id: createdRequest.id,
      ticketId: createdRequest.ticket_id,
      requestedBy: createdRequest.requested_by,
      status: createdRequest.status,
      memo: createdRequest.memo,
      expiresAt: createdRequest.expires_at,
      createdAt: createdRequest.created_at,
    },
  });
}
