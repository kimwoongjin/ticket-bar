import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type TimeoutAction = 'return' | 'auto_approve' | 'auto_reject';
type AutoIssueCycle = 'none' | 'weekly' | 'monthly';

interface RulesPayload {
  timeoutHours: number;
  timeoutAction: TimeoutAction;
  autoIssueCycle: AutoIssueCycle;
  autoIssueCount: number;
}

const isTimeoutAction = (value: string): value is TimeoutAction => {
  return value === 'return' || value === 'auto_approve' || value === 'auto_reject';
};

const isAutoIssueCycle = (value: string): value is AutoIssueCycle => {
  return value === 'none' || value === 'weekly' || value === 'monthly';
};

const parseRulesPayload = async (request: NextRequest): Promise<RulesPayload | null> => {
  try {
    const body = (await request.json()) as Partial<RulesPayload>;

    if (
      typeof body.timeoutHours !== 'number' ||
      typeof body.timeoutAction !== 'string' ||
      typeof body.autoIssueCycle !== 'string' ||
      typeof body.autoIssueCount !== 'number'
    ) {
      return null;
    }

    if (!Number.isFinite(body.timeoutHours) || body.timeoutHours <= 0) {
      return null;
    }

    if (!Number.isFinite(body.autoIssueCount) || body.autoIssueCount < 0) {
      return null;
    }

    if (!isTimeoutAction(body.timeoutAction) || !isAutoIssueCycle(body.autoIssueCycle)) {
      return null;
    }

    return {
      timeoutHours: Math.floor(body.timeoutHours),
      timeoutAction: body.timeoutAction,
      autoIssueCycle: body.autoIssueCycle,
      autoIssueCount: Math.floor(body.autoIssueCount),
    };
  } catch {
    return null;
  }
};

const getIssuerMember = async (userId: string) => {
  let adminClient: ReturnType<typeof createAdminClient>;

  try {
    adminClient = createAdminClient();
  } catch {
    return {
      ok: false as const,
      status: 500,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for settings API.',
    };
  }

  const { data: member, error } = await adminClient
    .from('couple_members')
    .select('couple_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: `Failed to load membership: ${error.message}`,
    };
  }

  if (!member?.couple_id) {
    return {
      ok: false as const,
      status: 404,
      error: 'Couple membership not found.',
    };
  }

  if (member.role !== 'issuer') {
    return {
      ok: false as const,
      status: 403,
      error: 'Only issuer can access rules settings.',
    };
  }

  return {
    ok: true as const,
    adminClient,
    coupleId: member.couple_id,
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

  const issuerMember = await getIssuerMember(user.id);

  if (!issuerMember.ok) {
    return NextResponse.json({ error: issuerMember.error }, { status: issuerMember.status });
  }

  const { adminClient, coupleId } = issuerMember;

  const { data: existingRules, error: rulesError } = await adminClient
    .from('rules')
    .select('timeout_hours, timeout_action, auto_issue_cycle, auto_issue_count')
    .eq('couple_id', coupleId)
    .limit(1)
    .maybeSingle();

  if (rulesError) {
    return NextResponse.json(
      { error: `Failed to load rules: ${rulesError.message}` },
      { status: 500 },
    );
  }

  if (existingRules) {
    return NextResponse.json({
      timeoutHours: existingRules.timeout_hours,
      timeoutAction: existingRules.timeout_action,
      autoIssueCycle: existingRules.auto_issue_cycle,
      autoIssueCount: existingRules.auto_issue_count,
    });
  }

  const { data: createdRules, error: createRulesError } = await adminClient
    .from('rules')
    .insert({
      couple_id: coupleId,
    })
    .select('timeout_hours, timeout_action, auto_issue_cycle, auto_issue_count')
    .single();

  if (createRulesError || !createdRules) {
    return NextResponse.json(
      { error: `Failed to initialize rules: ${createRulesError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    timeoutHours: createdRules.timeout_hours,
    timeoutAction: createdRules.timeout_action,
    autoIssueCycle: createdRules.auto_issue_cycle,
    autoIssueCount: createdRules.auto_issue_count,
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const payload = await parseRulesPayload(request);

  if (!payload) {
    return NextResponse.json({ error: 'Invalid rules payload.' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const issuerMember = await getIssuerMember(user.id);

  if (!issuerMember.ok) {
    return NextResponse.json({ error: issuerMember.error }, { status: issuerMember.status });
  }

  const { adminClient, coupleId } = issuerMember;

  const { data: updatedRules, error: updateError } = await adminClient
    .from('rules')
    .update({
      timeout_hours: payload.timeoutHours,
      timeout_action: payload.timeoutAction,
      auto_issue_cycle: payload.autoIssueCycle,
      auto_issue_count: payload.autoIssueCount,
    })
    .eq('couple_id', coupleId)
    .select('timeout_hours, timeout_action, auto_issue_cycle, auto_issue_count')
    .single();

  if (updateError || !updatedRules) {
    return NextResponse.json(
      { error: `Failed to update rules: ${updateError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    timeoutHours: updatedRules.timeout_hours,
    timeoutAction: updatedRules.timeout_action,
    autoIssueCycle: updatedRules.auto_issue_cycle,
    autoIssueCount: updatedRules.auto_issue_count,
  });
}
