import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

type TimeoutAction = 'auto_approve' | 'auto_reject' | 'return';
type ProcessedAction = 'approved' | 'rejected' | 'returned';

interface ExpiredRequestRow {
  id: string;
  ticket_id: string;
  requested_by: string;
  memo: string | null;
  expires_at: string;
}

interface TicketRow {
  id: string;
  couple_id: string;
  status: 'available' | 'requested' | 'used' | 'expired';
}

interface RuleRow {
  couple_id: string;
  timeout_action: TimeoutAction;
}

interface ProcessSummary {
  scanned: number;
  processed: number;
  approved: number;
  rejected: number;
  returned: number;
  skipped: number;
  failed: number;
}

const MAX_BATCH_SIZE = 200;

const getCronSecret = (): string | null => {
  const secret = process.env.CRON_SECRET;
  return secret ? secret.trim() : null;
};

const extractProvidedSecret = (request: NextRequest): string | null => {
  const bearerToken = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearerToken) {
    return bearerToken;
  }

  const headerSecret = request.headers.get('x-cron-secret')?.trim();
  return headerSecret || null;
};

const isRequestAuthorized = (request: NextRequest): boolean => {
  const configuredSecret = getCronSecret();
  const providedSecret = extractProvidedSecret(request);

  if (!configuredSecret || !providedSecret) {
    return false;
  }

  return configuredSecret === providedSecret;
};

const mapAction = (timeoutAction: TimeoutAction): ProcessedAction => {
  if (timeoutAction === 'auto_approve') {
    return 'approved';
  }

  if (timeoutAction === 'auto_reject') {
    return 'rejected';
  }

  return 'returned';
};

const buildInitialSummary = (scanned: number): ProcessSummary => {
  return {
    scanned,
    processed: 0,
    approved: 0,
    rejected: 0,
    returned: 0,
    skipped: 0,
    failed: 0,
  };
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!getCronSecret()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is required for timeout scheduler.' },
      { status: 500 },
    );
  }

  if (!isRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request.' }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createAdminClient>;

  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required for cron scheduler API.' },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();

  const { data: expiredRequests, error: expiredError } = await adminClient
    .from('ticket_requests')
    .select('id, ticket_id, requested_by, memo, expires_at')
    .eq('status', 'pending')
    .lte('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (expiredError) {
    return NextResponse.json(
      { error: `Failed to query expired requests: ${expiredError.message}` },
      { status: 500 },
    );
  }

  const requestRows = (expiredRequests ?? []) as ExpiredRequestRow[];
  const summary = buildInitialSummary(requestRows.length);

  if (requestRows.length === 0) {
    return NextResponse.json({ success: true, summary, processedRequestIds: [] });
  }

  const ticketIds = [...new Set(requestRows.map((row) => row.ticket_id))];

  const { data: tickets, error: ticketError } = await adminClient
    .from('tickets')
    .select('id, couple_id, status')
    .in('id', ticketIds);

  if (ticketError) {
    return NextResponse.json(
      { error: `Failed to query tickets: ${ticketError.message}` },
      { status: 500 },
    );
  }

  const ticketRows = (tickets ?? []) as TicketRow[];
  const ticketMap = new Map(ticketRows.map((ticket) => [ticket.id, ticket]));

  const coupleIds = [...new Set(ticketRows.map((ticket) => ticket.couple_id))];

  const { data: rules, error: rulesError } = await adminClient
    .from('rules')
    .select('couple_id, timeout_action')
    .in('couple_id', coupleIds);

  if (rulesError) {
    return NextResponse.json(
      { error: `Failed to query rules: ${rulesError.message}` },
      { status: 500 },
    );
  }

  const ruleRows = (rules ?? []) as RuleRow[];
  const ruleMap = new Map(ruleRows.map((rule) => [rule.couple_id, rule.timeout_action]));

  const processedRequestIds: string[] = [];
  const failedRequestIds: string[] = [];
  const skippedRequestIds: string[] = [];

  for (const requestRow of requestRows) {
    const ticket = ticketMap.get(requestRow.ticket_id);

    if (!ticket || ticket.status !== 'requested') {
      summary.skipped += 1;
      skippedRequestIds.push(requestRow.id);
      continue;
    }

    const timeoutAction = ruleMap.get(ticket.couple_id) ?? 'return';
    const nextRequestStatus = mapAction(timeoutAction);

    const { data: updatedRequest, error: requestUpdateError } = await adminClient
      .from('ticket_requests')
      .update({
        status: nextRequestStatus,
        responded_at: nowIso,
      })
      .eq('id', requestRow.id)
      .eq('status', 'pending')
      .lte('expires_at', nowIso)
      .select('id')
      .limit(1)
      .maybeSingle();

    if (requestUpdateError || !updatedRequest) {
      summary.failed += 1;
      failedRequestIds.push(requestRow.id);
      continue;
    }

    const nextTicketStatus = timeoutAction === 'auto_approve' ? 'used' : 'available';
    const nextUsedAt = timeoutAction === 'auto_approve' ? nowIso : null;

    const { data: updatedTicket, error: ticketUpdateError } = await adminClient
      .from('tickets')
      .update({
        status: nextTicketStatus,
        used_at: nextUsedAt,
      })
      .eq('id', requestRow.ticket_id)
      .eq('status', 'requested')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (ticketUpdateError || !updatedTicket) {
      await adminClient
        .from('ticket_requests')
        .update({
          status: 'pending',
          responded_at: null,
        })
        .eq('id', requestRow.id)
        .eq('status', nextRequestStatus);

      summary.failed += 1;
      failedRequestIds.push(requestRow.id);
      continue;
    }

    if (timeoutAction === 'auto_approve') {
      const { error: logInsertError } = await adminClient.from('ticket_logs').insert({
        ticket_id: requestRow.ticket_id,
        request_id: requestRow.id,
        memo: requestRow.memo ?? '요청 만료로 자동 승인 처리됨',
      });

      if (logInsertError) {
        await adminClient
          .from('ticket_requests')
          .update({
            status: 'pending',
            responded_at: null,
          })
          .eq('id', requestRow.id)
          .eq('status', 'approved');

        await adminClient
          .from('tickets')
          .update({
            status: 'requested',
            used_at: null,
          })
          .eq('id', requestRow.ticket_id)
          .eq('status', 'used');

        summary.failed += 1;
        failedRequestIds.push(requestRow.id);
        continue;
      }
    }

    summary.processed += 1;
    if (nextRequestStatus === 'approved') {
      summary.approved += 1;
    } else if (nextRequestStatus === 'rejected') {
      summary.rejected += 1;
    } else {
      summary.returned += 1;
    }

    processedRequestIds.push(requestRow.id);
  }

  return NextResponse.json({
    success: true,
    summary,
    processedRequestIds,
    skippedRequestIds,
    failedRequestIds,
  });
}
