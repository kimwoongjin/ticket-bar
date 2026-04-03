'use client';

import { ko } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TicketStatus = 'available' | 'requested' | 'used' | 'expired';
type TicketFilter = 'all' | TicketStatus;
type MembershipRole = 'issuer' | 'receiver' | null;

interface IssuedTicket {
  id: string;
  title: string;
  status: TicketStatus;
  expiresAt: string | null;
  createdAt: string;
}

interface IssueTicketsResponse {
  success?: boolean;
  issuedCount?: number;
  tickets?: IssuedTicket[];
  error?: string;
}

interface TicketsListResponse {
  success?: boolean;
  tickets?: IssuedTicket[];
  error?: string;
}

interface OnboardingStatusResponse {
  connected?: boolean;
  role?: MembershipRole;
  error?: string;
}

const FILTER_OPTIONS: Array<{ key: TicketFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'available', label: '사용 가능' },
  { key: 'requested', label: '대기 중' },
  { key: 'used', label: '사용됨' },
  { key: 'expired', label: '만료' },
];

const statusLabel: Record<TicketStatus, string> = {
  available: '사용 가능',
  requested: '대기 중',
  used: '사용됨',
  expired: '만료',
};

const statusBadgeClassName: Record<TicketStatus, string> = {
  available: 'border-teal-200 bg-teal-50 text-teal-700',
  requested: 'border-blue-200 bg-blue-50 text-blue-700',
  used: 'border-slate-200 bg-slate-100 text-slate-600',
  expired: 'border-rose-200 bg-rose-50 text-rose-700',
};

const isTicketStatus = (value: string): value is TicketStatus => {
  return value === 'available' || value === 'requested' || value === 'used' || value === 'expired';
};

const toNextMidnight = (selectedDate: Date): Date => {
  const boundary = new Date(selectedDate);
  boundary.setHours(0, 0, 0, 0);
  boundary.setDate(boundary.getDate() + 1);
  return boundary;
};

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

const formatMonthLabel = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '날짜 미확인';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date);
};

const TicketsPage = () => {
  const [role, setRole] = useState<MembershipRole>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [issueCount, setIssueCount] = useState('1');
  const [expiresAtDate, setExpiresAtDate] = useState<Date | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [isIssueErrorMessage, setIsIssueErrorMessage] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TicketFilter>('all');
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);

  const loadTickets = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsTicketsLoading(true);
    }

    try {
      const response = await fetch('/api/tickets', {
        method: 'GET',
      });

      const result = (await response.json()) as Partial<TicketsListResponse>;

      if (!response.ok) {
        if (!silent) {
          setIsErrorMessage(true);
          setMessage(result.error ?? '티켓 목록을 불러오지 못했습니다.');
        }

        return false;
      }

      const normalizedTickets = (result.tickets ?? []).filter((ticket): ticket is IssuedTicket => {
        return (
          typeof ticket.id === 'string' &&
          typeof ticket.title === 'string' &&
          typeof ticket.createdAt === 'string' &&
          (ticket.expiresAt === null || typeof ticket.expiresAt === 'string') &&
          isTicketStatus(ticket.status)
        );
      });

      setIssuedTickets(normalizedTickets);
      return true;
    } catch {
      if (!silent) {
        setIsErrorMessage(true);
        setMessage('네트워크 오류로 티켓 목록을 불러오지 못했습니다.');
      }

      return false;
    } finally {
      if (!silent) {
        setIsTicketsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const loadMembership = async () => {
      setIsRoleLoading(true);
      setIsTicketsLoading(true);

      try {
        const response = await fetch('/api/onboarding/status', {
          method: 'GET',
        });

        const result = (await response.json()) as OnboardingStatusResponse;

        if (!response.ok) {
          setRole(null);
          setIsTicketsLoading(false);
          setMessage(result.error ?? '사용자 권한 정보를 불러오지 못했습니다.');
          setIsErrorMessage(true);
          return;
        }

        if (!result.connected) {
          setRole(null);
          setIssuedTickets([]);
          setIsTicketsLoading(false);
          return;
        }

        setRole(result.role ?? null);
        await loadTickets();
      } catch {
        setRole(null);
        setIssuedTickets([]);
        setIsTicketsLoading(false);
        setMessage('네트워크 오류로 권한 정보를 불러오지 못했습니다.');
        setIsErrorMessage(true);
      } finally {
        setIsRoleLoading(false);
      }
    };

    void loadMembership();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    if (selectedFilter === 'all') {
      return issuedTickets;
    }

    return issuedTickets.filter((ticket) => ticket.status === selectedFilter);
  }, [issuedTickets, selectedFilter]);

  const groupedTickets = useMemo(() => {
    const groups = new Map<string, IssuedTicket[]>();

    filteredTickets.forEach((ticket) => {
      const monthLabel = formatMonthLabel(ticket.createdAt);
      const existing = groups.get(monthLabel);

      if (existing) {
        existing.push(ticket);
        return;
      }

      groups.set(monthLabel, [ticket]);
    });

    return [...groups.entries()];
  }, [filteredTickets]);

  const openIssueModal = () => {
    setTicketTitle('');
    setIssueCount('1');
    setExpiresAtDate(null);
    setIsIssueModalOpen(true);
    setIssueMessage(null);
    setIsIssueErrorMessage(false);
  };

  const closeIssueModal = () => {
    if (isIssuing) {
      return;
    }

    setIsIssueModalOpen(false);
    setIssueMessage(null);
    setIsIssueErrorMessage(false);
  };

  const handleIssueSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIssueMessage(null);
    setIsIssueErrorMessage(false);

    const normalizedTitle = ticketTitle.trim();
    if (!normalizedTitle) {
      setIsIssueErrorMessage(true);
      setIssueMessage('티켓명을 입력해주세요.');
      return;
    }

    if (normalizedTitle.length > 60) {
      setIsIssueErrorMessage(true);
      setIssueMessage('티켓명은 60자 이하로 입력해주세요.');
      return;
    }

    const parsedCount = Number(issueCount);

    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 100) {
      setIsIssueErrorMessage(true);
      setIssueMessage('발급 장수는 1~100 사이의 정수여야 합니다.');
      return;
    }

    let expiresAt: string | null = null;

    if (expiresAtDate) {
      const parsedDate = toNextMidnight(expiresAtDate);

      if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
        setIsIssueErrorMessage(true);
        setIssueMessage('만료 날짜를 다시 선택해주세요.');
        return;
      }

      expiresAt = parsedDate.toISOString();
    }

    setIsIssuing(true);

    try {
      const response = await fetch('/api/tickets/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: normalizedTitle,
          count: parsedCount,
          expiresAt,
        }),
      });

      const result = (await response.json()) as IssueTicketsResponse;

      if (!response.ok || !result.success) {
        setIsIssueErrorMessage(true);
        setIssueMessage(result.error ?? '티켓 수동 발급에 실패했습니다.');
        return;
      }

      const newTickets = result.tickets ?? [];

      const synced = await loadTickets({ silent: true });
      if (!synced) {
        setIssuedTickets((previous) => [...newTickets, ...previous]);
      }

      setIsErrorMessage(false);
      setMessage(`${result.issuedCount ?? newTickets.length}장의 티켓이 발급되었습니다.`);
      setIssueMessage(null);
      setIsIssueErrorMessage(false);
      setIsIssueModalOpen(false);
    } catch {
      setIsIssueErrorMessage(true);
      setIssueMessage('네트워크 오류로 티켓 발급에 실패했습니다.');
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-teal-700">TICKETS</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">티켓 목록</h1>
          <p className="text-sm text-slate-600">
            상태별 티켓을 확인하고, 발급자는 수동 발급을 진행할 수 있습니다.
          </p>
        </div>

        {!isRoleLoading && role === 'issuer' && (
          <button
            type="button"
            onClick={openIssueModal}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            수동 발급
          </button>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSelectedFilter(option.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selectedFilter === option.key
                ? 'border-teal-300 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </section>

      {message && (
        <p className={`text-sm font-medium ${isErrorMessage ? 'text-rose-600' : 'text-teal-700'}`}>
          {message}
        </p>
      )}

      {isTicketsLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600"
            />
            <span>티켓 목록을 불러오는 중입니다...</span>
          </div>
        </section>
      ) : groupedTickets.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">아직 표시할 티켓이 없습니다.</p>
          <p className="mt-2 text-sm text-slate-500">
            수동 발급을 진행하거나 다음 주기 발급을 기다려주세요.
          </p>
        </section>
      ) : (
        <section className="space-y-5">
          {groupedTickets.map(([monthLabel, tickets]) => (
            <article key={monthLabel} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">{monthLabel}</h2>
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${
                      ticket.status === 'used' || ticket.status === 'expired' ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{ticket.title}</p>
                        <p className="text-xs text-slate-500">티켓 #{ticket.id.slice(0, 8)}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClassName[ticket.status]}`}
                      >
                        {statusLabel[ticket.status]}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>발급 시각: {formatDateTime(ticket.createdAt)}</p>
                      <p>
                        만료 시각:{' '}
                        {ticket.expiresAt ? formatDateTime(ticket.expiresAt) : '설정 안함'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {isIssueModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-teal-700">MANUAL ISSUE</p>
              <h2 className="text-xl font-bold text-slate-900">티켓 수동 발급</h2>
              <p className="text-sm text-slate-600">
                발급 장수와 만료일을 설정해 티켓을 생성합니다.
              </p>
            </div>

            <form onSubmit={handleIssueSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ticket-title" className="text-sm font-semibold text-slate-700">
                  티켓명
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  maxLength={60}
                  value={ticketTitle}
                  onChange={(event) => setTicketTitle(event.target.value)}
                  placeholder="예: 주말 데이트 티켓"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="issue-count" className="text-sm font-semibold text-slate-700">
                  발급 장수 (1~100)
                </label>
                <input
                  id="issue-count"
                  type="number"
                  min={1}
                  max={100}
                  value={issueCount}
                  onChange={(event) => setIssueCount(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="expires-at-picker" className="text-sm font-semibold text-slate-700">
                  만료 날짜 (선택)
                </label>
                <div className="space-y-2">
                  <DatePicker
                    id="expires-at-picker"
                    selected={expiresAtDate}
                    onChange={(value: Date | [Date | null, Date | null] | null) => {
                      if (value instanceof Date || value === null) {
                        setExpiresAtDate(value);
                      }
                    }}
                    minDate={new Date()}
                    dateFormat="yyyy.MM.dd"
                    locale={ko}
                    isClearable
                    placeholderText="만료 날짜 선택"
                    wrapperClassName="block w-full"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                  />
                  <p className="text-xs text-slate-500">
                    {expiresAtDate
                      ? `선택됨: ${formatDateTime(toNextMidnight(expiresAtDate).toISOString())} 만료`
                      : '선택한 날짜의 다음 날 00:00(자정)에 만료됩니다.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeIssueModal}
                  disabled={isIssuing}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isIssuing}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isIssuing ? '발급 중...' : '발급하기'}
                </button>
              </div>

              {issueMessage && (
                <p
                  className={`text-sm font-medium ${
                    isIssueErrorMessage ? 'text-rose-600' : 'text-teal-700'
                  }`}
                >
                  {issueMessage}
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

export default TicketsPage;
