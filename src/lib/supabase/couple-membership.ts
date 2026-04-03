import type { SupabaseClient } from '@supabase/supabase-js';

type CoupleStatus = 'pending' | 'active' | 'inactive';
type CoupleRole = 'issuer' | 'receiver';

interface MemberRow {
  couple_id: string;
  role: CoupleRole;
  joined_at: string;
}

interface CoupleRow {
  id: string;
  status: CoupleStatus;
  invite_code: string;
  created_at: string;
}

export interface ResolvedMembership {
  coupleId: string;
  role: CoupleRole;
  status: CoupleStatus;
  inviteCode: string;
  joinedAt: string;
  createdAt: string;
}

const statusPriority = (status: CoupleStatus): number => {
  if (status === 'active') {
    return 0;
  }

  if (status === 'pending') {
    return 1;
  }

  return 2;
};

const toTimestamp = (value: string): number => {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    return 0;
  }

  return time;
};

export const resolveUserMembership = async (
  client: SupabaseClient,
  userId: string,
): Promise<{ membership: ResolvedMembership | null; error?: string }> => {
  const { data: members, error: membersError } = await client
    .from('couple_members')
    .select('couple_id, role, joined_at')
    .eq('user_id', userId);

  if (membersError) {
    return {
      membership: null,
      error: `Failed to load memberships: ${membersError.message}`,
    };
  }

  const memberRows = (members ?? []) as MemberRow[];

  if (!memberRows.length) {
    return { membership: null };
  }

  const uniqueCoupleIds = [...new Set(memberRows.map((member) => member.couple_id))];

  const { data: couples, error: couplesError } = await client
    .from('couples')
    .select('id, status, invite_code, created_at')
    .in('id', uniqueCoupleIds);

  if (couplesError) {
    return {
      membership: null,
      error: `Failed to load couples: ${couplesError.message}`,
    };
  }

  const coupleMap = new Map((couples as CoupleRow[]).map((couple) => [couple.id, couple]));

  const resolved = memberRows
    .map((member) => {
      const couple = coupleMap.get(member.couple_id);
      if (!couple) {
        return null;
      }

      return {
        coupleId: couple.id,
        role: member.role,
        status: couple.status,
        inviteCode: couple.invite_code,
        joinedAt: member.joined_at,
        createdAt: couple.created_at,
      } as ResolvedMembership;
    })
    .filter((membership): membership is ResolvedMembership => membership !== null)
    .sort((left, right) => {
      const statusDiff = statusPriority(left.status) - statusPriority(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const joinedAtDiff = toTimestamp(right.joinedAt) - toTimestamp(left.joinedAt);
      if (joinedAtDiff !== 0) {
        return joinedAtDiff;
      }

      return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
    });

  return { membership: resolved[0] ?? null };
};
