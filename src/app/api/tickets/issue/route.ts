import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { createClient } from '@/lib/supabase/server';

interface IssueTicketsPayload {
  title: string;
  count: number;
  expiresAt: string | null;
}

interface TicketInsertRow {
  title: string;
  couple_id: string;
  issued_by: string;
  status: 'available';
  expires_at: string | null;
}

const MAX_ISSUE_COUNT = 100;
const MAX_TITLE_LENGTH = 60;

const parseIssueTicketsPayload = async (
  request: NextRequest,
): Promise<IssueTicketsPayload | null> => {
  try {
    const body = (await request.json()) as Partial<IssueTicketsPayload>;

    if (typeof body.count !== 'number') {
      return null;
    }

    if (typeof body.title !== 'string') {
      return null;
    }

    if (!Number.isInteger(body.count) || body.count <= 0 || body.count > MAX_ISSUE_COUNT) {
      return null;
    }

    if (
      body.expiresAt !== null &&
      body.expiresAt !== undefined &&
      typeof body.expiresAt !== 'string'
    ) {
      return null;
    }

    const normalizedExpiresAt = body.expiresAt ?? null;

    if (normalizedExpiresAt) {
      const timestamp = Date.parse(normalizedExpiresAt);

      if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
        return null;
      }
    }

    const normalizedTitle = body.title.trim();
    if (!normalizedTitle || normalizedTitle.length > MAX_TITLE_LENGTH) {
      return null;
    }

    return {
      title: normalizedTitle,
      count: body.count,
      expiresAt: normalizedExpiresAt,
    };
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await parseIssueTicketsPayload(request);

  if (!payload) {
    return NextResponse.json(
      {
        error:
          'Invalid payload. title is required (max 60 chars), count must be 1~100 integer, expiresAt must be future ISO datetime or null.',
      },
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
      {
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for tickets API.',
      },
      { status: 500 },
    );
  }

  const { membership, error: membershipError } = await resolveUserMembership(adminClient, user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError }, { status: 500 });
  }

  if (!membership || membership.status !== 'active' || membership.role !== 'issuer') {
    return NextResponse.json(
      {
        error: 'Only issuer in an active couple can issue tickets.',
      },
      { status: 403 },
    );
  }

  const rows: TicketInsertRow[] = Array.from({ length: payload.count }, () => ({
    title: payload.title,
    couple_id: membership.coupleId,
    issued_by: user.id,
    status: 'available',
    expires_at: payload.expiresAt,
  }));

  const { data: insertedTickets, error: insertError } = await adminClient
    .from('tickets')
    .insert(rows)
    .select('id, title, status, expires_at, created_at');

  if (insertError) {
    return NextResponse.json(
      {
        error: `Failed to issue tickets: ${insertError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    issuedCount: insertedTickets?.length ?? 0,
    tickets:
      insertedTickets?.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        expiresAt: ticket.expires_at,
        createdAt: ticket.created_at,
      })) ?? [],
  });
}
