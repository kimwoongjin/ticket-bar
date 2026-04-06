'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type MembershipRole = 'issuer' | 'receiver';

interface HomeSummaryResponse {
  success?: boolean;
  role?: MembershipRole;
  availableTicketCount?: number;
  monthlyUsedCount?: number;
  pendingRequestCount?: number;
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
    expiresAt: string;
    createdAt: string;
  } | null;
  error?: string;
}

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const HomePage = () => {
  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [role, setRole] = useState<MembershipRole>('receiver');
  const [availableTicketCount, setAvailableTicketCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [monthlyUsedCount, setMonthlyUsedCount] = useState(0);
  const [latestPendingRequest, setLatestPendingRequest] =
    useState<HomeSummaryResponse['latestPendingRequest']>(null);

  useEffect(() => {
    const loadSummary = async () => {
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

        setRole(result.role ?? 'receiver');
        setAvailableTicketCount(result.availableTicketCount ?? 0);
        setPendingRequestCount(result.pendingRequestCount ?? 0);
        setMonthlyUsedCount(result.monthlyUsedCount ?? 0);
        setLatestPendingRequest(result.latestPendingRequest ?? null);
      } catch {
        setSummaryError('네트워크 오류로 홈 요약 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void loadSummary();
  }, []);

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

  const quickAction = useMemo(() => {
    if (role === 'issuer') {
      return {
        label: '요청 처리하러 가기',
        description: '수신자가 보낸 티켓 요청을 바로 승인/거절할 수 있어요.',
      };
    }

    return {
      label: '티켓 요청하러 가기',
      description: '사용 가능한 티켓을 선택해서 파트너에게 요청을 보낼 수 있어요.',
    };
  }, [role]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-teal-700">HOME</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">오늘의 티켓 현황</h1>
          <p className="text-sm text-slate-600">
            이번 달 남은 티켓과 대기 요청을 한 번에 확인하세요.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isSigningOut ? '로그아웃 중...' : '로그아웃'}
          </button>
          {signOutError && <p className="text-xs font-medium text-rose-600">{signOutError}</p>}
        </div>
      </section>

      {summaryError && <p className="text-sm font-medium text-rose-600">{summaryError}</p>}

      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
        <p className="text-sm font-semibold text-teal-700">이번 달 잔여 티켓</p>
        <p className="mt-2 text-5xl font-bold text-teal-800">
          {isLoadingSummary ? '-' : availableTicketCount}
        </p>
        <p className="mt-2 text-sm text-teal-800/80">현재 사용 가능한 티켓 수를 보여줍니다.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            {role === 'issuer' ? '승인 대기 요청' : '내 요청 대기'}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {isLoadingSummary ? '-' : `${pendingRequestCount}건`}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">이번 달 사용</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {isLoadingSummary ? '-' : `${monthlyUsedCount}회`}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-700">빠른 요청 액션</p>
          <p className="text-sm text-slate-500">{quickAction.description}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/tickets"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            {quickAction.label}
          </Link>
          <Link
            href={role === 'issuer' ? '/onboarding/create' : '/onboarding/join'}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {role === 'issuer' ? '초대 코드 다시 보기' : '코드 입력 화면 보기'}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">최근 대기 요청</p>

        {isLoadingSummary ? (
          <p className="mt-3 text-sm text-slate-500">요청 정보를 불러오는 중입니다...</p>
        ) : !latestPendingRequest ? (
          <p className="mt-3 text-sm text-slate-500">현재 대기 중인 요청이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{latestPendingRequest.ticketTitle}</p>
            <p>요청자: {latestPendingRequest.requestedBy.name}</p>
            <p>요청 시각: {formatDateTime(latestPendingRequest.createdAt)}</p>
            <p>만료 시각: {formatDateTime(latestPendingRequest.expiresAt)}</p>
            <p>메모: {latestPendingRequest.memo || '없음'}</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default HomePage;
