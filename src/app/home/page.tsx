'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BottomNav from '@/components/navigation/bottom-nav';

type MembershipRole = 'issuer' | 'receiver';

interface HomeSummaryResponse {
  success?: boolean;
  viewerName?: string | null;
  role?: MembershipRole;
  availableTicketCount?: number;
  totalTicketCount?: number;
  monthlyUsedCount?: number;
  previousMonthlyUsedCount?: number;
  pendingRequestCount?: number;
  nearestPendingExpiresAt?: string | null;
  latestPendingRequest?: {
    id: string;
    ticketId: string;
    ticketTitle: string;
    requestedBy: {
      id: string;
      name: string;
      email: string | null;
    };
    memo: string | null;
    requestedForDate: string;
    expiresAt: string;
    createdAt: string;
  } | null;
  error?: string;
}

interface RespondRequestResponse {
  success?: boolean;
  error?: string;
}

const formatRemainingToExpiry = (value: string | null): string => {
  if (!value) {
    return '만료 정보 없음';
  }

  const expiresAt = new Date(value).getTime();

  if (Number.isNaN(expiresAt)) {
    return '만료 정보 확인 불가';
  }

  const diff = expiresAt - Date.now();

  if (diff <= 0) {
    return '만료됨';
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}분 내 만료`;
  }

  return `${hours}시간 ${minutes}분 내 만료`;
};

const formatRelativeTime = (value: string): string => {
  const createdAt = new Date(value).getTime();

  if (Number.isNaN(createdAt)) {
    return '요청 시간 확인 불가';
  }

  const diff = Date.now() - createdAt;

  if (diff < 60_000) {
    return '방금 전';
  }

  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}분 전`;
  }

  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}시간 전`;
  }

  return `${Math.floor(diff / 86_400_000)}일 전`;
};

const HomePage = () => {
  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [viewerName, setViewerName] = useState<string>('사용자');
  const [role, setRole] = useState<MembershipRole>('receiver');
  const [availableTicketCount, setAvailableTicketCount] = useState(0);
  const [totalTicketCount, setTotalTicketCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [nearestPendingExpiresAt, setNearestPendingExpiresAt] = useState<string | null>(null);
  const [monthlyUsedCount, setMonthlyUsedCount] = useState(0);
  const [previousMonthlyUsedCount, setPreviousMonthlyUsedCount] = useState(0);
  const [latestPendingRequest, setLatestPendingRequest] =
    useState<HomeSummaryResponse['latestPendingRequest']>(null);

  const [isRespondingPartnerRequest, setIsRespondingPartnerRequest] = useState(false);
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [partnerActionError, setPartnerActionError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const response = await fetch('/api/home/summary', {
        method: 'GET',
      });

      const result = (await response.json()) as HomeSummaryResponse;

      if (!response.ok || !result.success) {
        setSummaryError(result.error ?? '홈 요약 정보를 불러오지 못했습니다.');
        return;
      }

      setViewerName(result.viewerName ?? '사용자');
      setRole(result.role ?? 'receiver');
      setAvailableTicketCount(result.availableTicketCount ?? 0);
      setTotalTicketCount(result.totalTicketCount ?? 0);
      setPendingRequestCount(result.pendingRequestCount ?? 0);
      setNearestPendingExpiresAt(result.nearestPendingExpiresAt ?? null);
      setMonthlyUsedCount(result.monthlyUsedCount ?? 0);
      setPreviousMonthlyUsedCount(result.previousMonthlyUsedCount ?? 0);
      setLatestPendingRequest(result.latestPendingRequest ?? null);
    } catch {
      setSummaryError('네트워크 오류로 홈 요약 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileMenuOpen]);

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSignOutError(result.error ?? '로그아웃에 실패했습니다.');
        return;
      }

      router.push('/login');
      router.refresh();
    } catch {
      setSignOutError('네트워크 오류로 로그아웃에 실패했습니다.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handlePartnerRequestResponse = async (action: 'approve' | 'reject') => {
    if (!latestPendingRequest) {
      setPartnerActionError('처리할 요청이 없습니다.');
      return;
    }

    const normalizedRejectReason = rejectReason.trim();

    if (action === 'reject' && !normalizedRejectReason) {
      setPartnerActionError('거절 사유를 입력해주세요.');
      return;
    }

    setPartnerActionError(null);
    setNoticeMessage(null);
    setIsRespondingPartnerRequest(true);

    try {
      const response = await fetch(`/api/ticket-requests/${latestPendingRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          logMemo: action === 'reject' ? normalizedRejectReason : null,
        }),
      });

      const result = (await response.json()) as RespondRequestResponse;

      if (!response.ok || !result.success) {
        setPartnerActionError(result.error ?? '요청 처리에 실패했습니다.');
        return;
      }

      setIsRejectMode(false);
      setRejectReason('');
      setNoticeMessage(action === 'approve' ? '요청을 승인했어요.' : '요청을 거절했어요.');
      await loadSummary();
    } catch {
      setPartnerActionError('네트워크 오류로 요청 처리에 실패했습니다.');
    } finally {
      setIsRespondingPartnerRequest(false);
    }
  };

  const heroProgressPercent = useMemo(() => {
    if (totalTicketCount <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (monthlyUsedCount / totalTicketCount) * 100));
  }, [monthlyUsedCount, totalTicketCount]);

  const avatarLabel = useMemo(() => {
    return viewerName.trim().charAt(0) || '유';
  }, [viewerName]);

  const isReceiver = role === 'receiver';
  const showPartnerRequestCard = role === 'issuer' && !!latestPendingRequest;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-6 py-8 pb-24">
      <section className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            안녕하세요, {viewerName}님
          </h1>
          <p className="text-sm text-slate-600">오늘의 티켓 상태를 확인해요.</p>
        </div>

        <div ref={profileMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-800 ring-2 ring-transparent transition hover:ring-amber-300"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            aria-label="프로필 메뉴 열기"
          >
            {avatarLabel}
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-xs font-semibold text-slate-700">{viewerName}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full whitespace-nowrap px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {isSigningOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          )}

          {signOutError && (
            <p className="mt-2 text-right text-xs font-medium text-rose-600">{signOutError}</p>
          )}
        </div>
      </section>

      {summaryError && <p className="text-sm font-medium text-rose-600">{summaryError}</p>}
      {noticeMessage && <p className="text-sm font-medium text-teal-700">{noticeMessage}</p>}

      <section
        className={`rounded-2xl border p-6 ${availableTicketCount === 0 ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}
      >
        <p
          className={`text-sm font-semibold ${availableTicketCount === 0 ? 'text-rose-700' : 'text-amber-700'}`}
        >
          이번 달 잔여 티켓
        </p>
        <p
          className={`mt-2 text-5xl font-bold sm:text-6xl ${availableTicketCount === 0 ? 'text-rose-800' : 'text-amber-900'}`}
        >
          {isLoadingSummary ? '-' : availableTicketCount}
        </p>
        <p
          className={`mt-2 text-sm font-medium ${availableTicketCount === 0 ? 'text-rose-700' : 'text-amber-800'}`}
        >
          {isLoadingSummary ? '-' : `${totalTicketCount}장 중 ${monthlyUsedCount}장 사용`}
        </p>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${heroProgressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm font-semibold text-amber-800/90">
          <span>0</span>
          <span>{isLoadingSummary ? '-' : totalTicketCount}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">이번 달 사용</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            {isLoadingSummary ? '-' : `${monthlyUsedCount}회`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            지난달 {isLoadingSummary ? '-' : `${previousMonthlyUsedCount}회`}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">승인 대기</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            {isLoadingSummary ? '-' : `${pendingRequestCount}건`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isLoadingSummary ? '-' : formatRemainingToExpiry(nearestPendingExpiresAt)}
          </p>
        </article>
      </section>

      {showPartnerRequestCard && latestPendingRequest && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">파트너 요청</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              대기 중
            </span>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">
              {latestPendingRequest.ticketTitle}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {latestPendingRequest.memo || '메모 없음'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {latestPendingRequest.requestedBy.name} ·{' '}
              {formatRelativeTime(latestPendingRequest.createdAt)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsRejectMode(false);
                void handlePartnerRequestResponse('approve');
              }}
              disabled={isRespondingPartnerRequest}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:text-lg"
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => setIsRejectMode((prev) => !prev)}
              disabled={isRespondingPartnerRequest}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 sm:text-lg"
            >
              거절
            </button>
          </div>

          {isRejectMode && (
            <div className="mt-3 space-y-2">
              <input
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                maxLength={300}
                placeholder="거절 사유를 입력해주세요"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => void handlePartnerRequestResponse('reject')}
                disabled={isRespondingPartnerRequest}
                className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                거절 확정
              </button>
            </div>
          )}

          {partnerActionError && (
            <p className="mt-3 text-sm font-medium text-rose-600">{partnerActionError}</p>
          )}
        </section>
      )}

      {isReceiver ? (
        <Link
          href="/tickets"
          className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center text-2xl font-bold tracking-tight text-slate-900 transition hover:bg-slate-50 sm:text-3xl"
        >
          티켓 사용 요청하기
        </Link>
      ) : (
        <Link
          href="/tickets"
          className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center text-xl font-bold tracking-tight text-slate-900 transition hover:bg-slate-50 sm:text-2xl"
        >
          발급 현황 보기
        </Link>
      )}

      <BottomNav />
    </main>
  );
};

export default HomePage;
