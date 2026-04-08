'use client';

import { ko } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BottomNav from '@/components/navigation/bottom-nav';

type TicketStatus = 'available' | 'requested' | 'used' | 'expired';
type TicketFilter = 'all' | TicketStatus;
type MembershipRole = 'issuer' | 'receiver' | null;
type ReceiverView = 'tickets' | 'history';

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

interface CreateTicketRequestResponse {
  success?: boolean;
  request?: {
    id: string;
    ticketId: string;
    requestedBy: string;
    status: 'pending';
    memo: string | null;
    requestedForDate: string;
    expiresAt: string;
    createdAt: string;
  };
  error?: string;
}

interface PendingTicketRequest {
  id: string;
  ticketId: string;
  ticketTitle: string;
  requestedBy: {
    id: string;
    name: string;
    email: string | null;
  };
  status: 'pending';
  memo: string | null;
  requestedForDate: string;
  expiresAt: string;
  createdAt: string;
}

interface PendingTicketRequestsResponse {
  success?: boolean;
  requests?: PendingTicketRequest[];
  error?: string;
}

interface RequestHistoryItem {
  id: string;
  ticketId: string;
  ticketTitle: string;
  requestedBy: {
    id: string;
    name: string;
    email: string | null;
  };
  status: 'approved' | 'rejected' | 'returned';
  memo: string | null;
  requestedForDate: string;
  responseMemo: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface RequestHistoryResponse {
  success?: boolean;
  totalCount?: number;
  requests?: RequestHistoryItem[];
  error?: string;
}

interface RespondTicketRequestResponse {
  success?: boolean;
  request?: {
    id: string;
    status: 'approved' | 'rejected' | 'returned';
    requestedForDate: string;
    responseMemo: string | null;
  };
  ticket?: {
    id: string;
    status: TicketStatus;
  };
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

const requestHistoryStatusLabel: Record<RequestHistoryItem['status'], string> = {
  approved: '승인',
  rejected: '거절',
  returned: '반환',
};

const requestHistoryStatusClassName: Record<RequestHistoryItem['status'], string> = {
  approved: 'border-teal-200 bg-teal-50 text-teal-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  returned: 'border-slate-200 bg-slate-100 text-slate-700',
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

const formatDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getTimeoutProgress = (createdAt: string, expiresAt: string): number => {
  const startTime = new Date(createdAt).getTime();
  const endTime = new Date(expiresAt).getTime();
  const now = Date.now();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return 100;
  }

  if (now <= startTime) {
    return 0;
  }

  if (now >= endTime) {
    return 100;
  }

  return Math.min(100, Math.max(0, ((now - startTime) / (endTime - startTime)) * 100));
};

const formatRemainingTime = (expiresAt: string): string => {
  const expires = new Date(expiresAt).getTime();

  if (Number.isNaN(expires)) {
    return '만료 시각 확인 불가';
  }

  const diff = expires - Date.now();

  if (diff <= 0) {
    return '요청 만료됨';
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;

  if (hours <= 0) {
    return `${remainMinutes}분 남음`;
  }

  return `${hours}시간 ${remainMinutes}분 남음`;
};

const isTimeoutWarning = (expiresAt: string): boolean => {
  const expires = new Date(expiresAt).getTime();

  if (Number.isNaN(expires)) {
    return false;
  }

  const diff = expires - Date.now();
  return diff > 0 && diff <= 3_600_000;
};

const SHEET_ANIMATION_DURATION_MS = 260;

const TicketsPage = () => {
  const [role, setRole] = useState<MembershipRole>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isRespondSheetOpen, setIsRespondSheetOpen] = useState(false);
  const [isRequestSheetOpen, setIsRequestSheetOpen] = useState(false);
  const [isRequestSheetVisible, setIsRequestSheetVisible] = useState(false);
  const [isRespondSheetVisible, setIsRespondSheetVisible] = useState(false);
  const [receiverView, setReceiverView] = useState<ReceiverView>('tickets');
  const [selectedRequestTicket, setSelectedRequestTicket] = useState<IssuedTicket | null>(null);
  const [selectedPendingRequest, setSelectedPendingRequest] = useState<PendingTicketRequest | null>(
    null,
  );
  const [ticketTitle, setTicketTitle] = useState('');
  const [responseMemo, setResponseMemo] = useState('');
  const [requestMemo, setRequestMemo] = useState('');
  const [requestDate, setRequestDate] = useState<Date | null>(null);
  const [isPushNotificationEnabled, setIsPushNotificationEnabled] = useState(true);
  const [issueCount, setIssueCount] = useState('1');
  const [expiresAtDate, setExpiresAtDate] = useState<Date | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [isIssueErrorMessage, setIsIssueErrorMessage] = useState(false);
  const [respondMessage, setRespondMessage] = useState<string | null>(null);
  const [isRespondErrorMessage, setIsRespondErrorMessage] = useState(false);
  const [approvedSummary, setApprovedSummary] = useState<{
    remainingAvailableTicketCount: number;
  } | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isRequestErrorMessage, setIsRequestErrorMessage] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TicketFilter>('all');
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingTicketRequest[]>([]);
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>([]);
  const [requestHistoryCount, setRequestHistoryCount] = useState(0);
  const [isPendingRequestsLoading, setIsPendingRequestsLoading] = useState(false);
  const [isRequestHistoryLoading, setIsRequestHistoryLoading] = useState(false);
  const [hasLoadedRequestHistory, setHasLoadedRequestHistory] = useState(false);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const requestSheetCloseTimerRef = useRef<number | null>(null);
  const respondSheetCloseTimerRef = useRef<number | null>(null);

  const requestDateRange = useMemo(() => {
    if (!selectedRequestTicket) {
      return null;
    }

    const minDate = startOfDay(new Date(selectedRequestTicket.createdAt));
    const maxDate = selectedRequestTicket.expiresAt
      ? startOfDay(new Date(new Date(selectedRequestTicket.expiresAt).getTime() - 1))
      : null;

    if (maxDate && maxDate.getTime() < minDate.getTime()) {
      return null;
    }

    return { minDate, maxDate };
  }, [selectedRequestTicket]);

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

  const loadPendingRequests = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsPendingRequestsLoading(true);
    }

    try {
      const response = await fetch('/api/ticket-requests/pending', {
        method: 'GET',
      });

      const result = (await response.json()) as Partial<PendingTicketRequestsResponse>;

      if (!response.ok) {
        if (!silent) {
          setIsErrorMessage(true);
          setMessage(result.error ?? '대기 요청 목록을 불러오지 못했습니다.');
        }

        return false;
      }

      const normalizedRequests = (result.requests ?? []).filter(
        (request): request is PendingTicketRequest => {
          return (
            typeof request.id === 'string' &&
            typeof request.ticketId === 'string' &&
            typeof request.ticketTitle === 'string' &&
            typeof request.requestedBy?.id === 'string' &&
            typeof request.requestedBy?.name === 'string' &&
            (request.requestedBy?.email === null ||
              typeof request.requestedBy?.email === 'string') &&
            request.status === 'pending' &&
            (request.memo === null || typeof request.memo === 'string') &&
            typeof request.requestedForDate === 'string' &&
            typeof request.expiresAt === 'string' &&
            typeof request.createdAt === 'string'
          );
        },
      );

      setPendingRequests(normalizedRequests);
      return true;
    } catch {
      if (!silent) {
        setIsErrorMessage(true);
        setMessage('네트워크 오류로 대기 요청 목록을 불러오지 못했습니다.');
      }

      return false;
    } finally {
      if (!silent) {
        setIsPendingRequestsLoading(false);
      }
    }
  }, []);

  const loadRequestHistory = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsRequestHistoryLoading(true);
    }

    try {
      const response = await fetch('/api/ticket-requests/history', {
        method: 'GET',
      });

      const result = (await response.json()) as Partial<RequestHistoryResponse>;

      if (!response.ok) {
        if (!silent) {
          setIsErrorMessage(true);
          setMessage(result.error ?? '요청 처리 이력을 불러오지 못했습니다.');
        }

        return false;
      }

      const normalizedHistory = (result.requests ?? []).filter(
        (request): request is RequestHistoryItem => {
          return (
            typeof request.id === 'string' &&
            typeof request.ticketId === 'string' &&
            typeof request.ticketTitle === 'string' &&
            typeof request.requestedBy?.id === 'string' &&
            typeof request.requestedBy?.name === 'string' &&
            (request.requestedBy?.email === null ||
              typeof request.requestedBy?.email === 'string') &&
            (request.status === 'approved' ||
              request.status === 'rejected' ||
              request.status === 'returned') &&
            (request.memo === null || typeof request.memo === 'string') &&
            typeof request.requestedForDate === 'string' &&
            (request.responseMemo === null || typeof request.responseMemo === 'string') &&
            (request.respondedAt === null || typeof request.respondedAt === 'string') &&
            typeof request.createdAt === 'string'
          );
        },
      );

      setRequestHistory(normalizedHistory);
      setRequestHistoryCount(
        typeof result.totalCount === 'number' ? result.totalCount : normalizedHistory.length,
      );
      return true;
    } catch {
      if (!silent) {
        setIsErrorMessage(true);
        setMessage('네트워크 오류로 요청 처리 이력을 불러오지 못했습니다.');
      }

      return false;
    } finally {
      if (!silent) {
        setIsRequestHistoryLoading(false);
      }
    }
  }, []);

  const loadRequestHistoryCount = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/ticket-requests/history?summary=true', {
        method: 'GET',
      });

      const result = (await response.json()) as Partial<RequestHistoryResponse>;

      if (!response.ok) {
        setIsErrorMessage(true);
        setMessage(result.error ?? '요청 처리 결과 수를 불러오지 못했습니다.');
        return false;
      }

      setRequestHistoryCount(typeof result.totalCount === 'number' ? result.totalCount : 0);
      return true;
    } catch {
      setIsErrorMessage(true);
      setMessage('네트워크 오류로 요청 처리 결과 수를 불러오지 못했습니다.');
      return false;
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
          setReceiverView('tickets');
          setIssuedTickets([]);
          setRequestHistory([]);
          setRequestHistoryCount(0);
          setHasLoadedRequestHistory(false);
          setIsTicketsLoading(false);
          return;
        }

        const currentRole = result.role ?? null;
        setRole(currentRole);
        setReceiverView('tickets');

        if (currentRole === 'issuer') {
          setIsPendingRequestsLoading(true);
          setRequestHistory([]);
          setRequestHistoryCount(0);
          setIsRequestHistoryLoading(false);
          setHasLoadedRequestHistory(false);
          await Promise.all([loadTickets(), loadPendingRequests()]);
          return;
        }

        setPendingRequests([]);
        setIsPendingRequestsLoading(false);
        setRequestHistory([]);
        setRequestHistoryCount(0);
        setIsRequestHistoryLoading(false);
        setHasLoadedRequestHistory(false);
        await Promise.all([loadTickets(), loadRequestHistoryCount()]);
      } catch {
        setRole(null);
        setReceiverView('tickets');
        setIssuedTickets([]);
        setPendingRequests([]);
        setRequestHistory([]);
        setRequestHistoryCount(0);
        setHasLoadedRequestHistory(false);
        setIsPendingRequestsLoading(false);
        setIsRequestHistoryLoading(false);
        setIsTicketsLoading(false);
        setMessage('네트워크 오류로 권한 정보를 불러오지 못했습니다.');
        setIsErrorMessage(true);
      } finally {
        setIsRoleLoading(false);
      }
    };

    void loadMembership();
  }, [loadPendingRequests, loadRequestHistoryCount, loadRequestHistory, loadTickets]);

  useEffect(() => {
    if (role !== 'receiver' || receiverView !== 'history' || hasLoadedRequestHistory) {
      return;
    }

    const loadHistoryForReceiverView = async () => {
      const loaded = await loadRequestHistory();

      if (loaded) {
        setHasLoadedRequestHistory(true);
      }
    };

    void loadHistoryForReceiverView();
  }, [hasLoadedRequestHistory, loadRequestHistory, receiverView, role]);

  useEffect(() => {
    if (!isRequestSheetOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsRequestSheetVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isRequestSheetOpen]);

  useEffect(() => {
    if (!isRespondSheetOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsRespondSheetVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isRespondSheetOpen]);

  useEffect(() => {
    return () => {
      if (requestSheetCloseTimerRef.current) {
        window.clearTimeout(requestSheetCloseTimerRef.current);
      }

      if (respondSheetCloseTimerRef.current) {
        window.clearTimeout(respondSheetCloseTimerRef.current);
      }
    };
  }, []);

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

  const availableRequestTickets = useMemo(() => {
    return issuedTickets.filter((ticket) => ticket.status === 'available');
  }, [issuedTickets]);

  const selectedPendingTicket = useMemo(() => {
    if (!selectedPendingRequest) {
      return null;
    }

    return issuedTickets.find((ticket) => ticket.id === selectedPendingRequest.ticketId) ?? null;
  }, [issuedTickets, selectedPendingRequest]);

  const remainingAvailableAfterApprovePreview = useMemo(() => {
    return issuedTickets.filter((ticket) => ticket.status === 'available').length;
  }, [issuedTickets]);

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

  const openRequestSheet = (ticket: IssuedTicket) => {
    if (requestSheetCloseTimerRef.current) {
      window.clearTimeout(requestSheetCloseTimerRef.current);
      requestSheetCloseTimerRef.current = null;
    }

    setIsRequestSheetVisible(false);
    setSelectedRequestTicket(ticket);
    setRequestMemo('');
    setIsPushNotificationEnabled(true);
    const minDate = startOfDay(new Date(ticket.createdAt));
    setRequestDate(minDate);
    setRequestMessage(null);
    setIsRequestErrorMessage(false);
    setIsRequestSheetOpen(true);
  };

  const closeRequestSheet = () => {
    if (isRequesting) {
      return;
    }

    setIsRequestSheetVisible(false);

    if (requestSheetCloseTimerRef.current) {
      window.clearTimeout(requestSheetCloseTimerRef.current);
    }

    requestSheetCloseTimerRef.current = window.setTimeout(() => {
      setIsRequestSheetOpen(false);
      setSelectedRequestTicket(null);
      setRequestMemo('');
      setIsPushNotificationEnabled(true);
      setRequestDate(null);
      setRequestMessage(null);
      setIsRequestErrorMessage(false);
      requestSheetCloseTimerRef.current = null;
    }, SHEET_ANIMATION_DURATION_MS);
  };

  const handleRequestSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestMessage(null);
    setIsRequestErrorMessage(false);

    if (!selectedRequestTicket) {
      setIsRequestErrorMessage(true);
      setRequestMessage('요청할 티켓을 선택해주세요.');
      return;
    }

    if (availableRequestTickets.length === 0) {
      setIsRequestErrorMessage(true);
      setRequestMessage('현재 요청 가능한 티켓이 없습니다.');
      return;
    }

    if (!requestDate || !requestDateRange) {
      setIsRequestErrorMessage(true);
      setRequestMessage('사용 날짜를 선택해주세요.');
      return;
    }

    const normalizedRequestDate = startOfDay(requestDate);

    if (normalizedRequestDate.getTime() < requestDateRange.minDate.getTime()) {
      setIsRequestErrorMessage(true);
      setRequestMessage('사용 날짜는 티켓 발급일 이후여야 합니다.');
      return;
    }

    if (
      requestDateRange.maxDate &&
      normalizedRequestDate.getTime() > requestDateRange.maxDate.getTime()
    ) {
      setIsRequestErrorMessage(true);
      setRequestMessage('사용 날짜는 티켓 만료일 이전으로 선택해주세요.');
      return;
    }

    const normalizedMemo = requestMemo.trim();

    if (normalizedMemo.length > 300) {
      setIsRequestErrorMessage(true);
      setRequestMessage('메모는 300자 이하로 입력해주세요.');
      return;
    }

    setIsRequesting(true);

    try {
      const response = await fetch('/api/ticket-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: selectedRequestTicket.id,
          memo: normalizedMemo || null,
          requestedForDate: formatDateOnly(normalizedRequestDate),
        }),
      });

      const result = (await response.json()) as CreateTicketRequestResponse;

      if (!response.ok || !result.success) {
        setIsRequestErrorMessage(true);
        setRequestMessage(result.error ?? '티켓 사용 요청 전송에 실패했습니다.');
        return;
      }

      const synced = await loadTickets({ silent: true });
      if (!synced) {
        setIssuedTickets((previous) =>
          previous.map((ticket) =>
            ticket.id === selectedRequestTicket.id ? { ...ticket, status: 'requested' } : ticket,
          ),
        );
      }

      setIsErrorMessage(false);
      setMessage('티켓 사용 요청을 전송했습니다. 파트너 응답을 기다려주세요.');
      closeRequestSheet();
    } catch {
      setIsRequestErrorMessage(true);
      setRequestMessage('네트워크 오류로 요청 전송에 실패했습니다.');
    } finally {
      setIsRequesting(false);
    }
  };

  const openRespondSheet = (request: PendingTicketRequest) => {
    if (respondSheetCloseTimerRef.current) {
      window.clearTimeout(respondSheetCloseTimerRef.current);
      respondSheetCloseTimerRef.current = null;
    }

    setIsRespondSheetVisible(false);
    setSelectedPendingRequest(request);
    setResponseMemo('');
    setApprovedSummary(null);
    setRespondMessage(null);
    setIsRespondErrorMessage(false);
    setIsRespondSheetOpen(true);
  };

  const closeRespondSheet = () => {
    if (isResponding) {
      return;
    }

    setIsRespondSheetVisible(false);

    if (respondSheetCloseTimerRef.current) {
      window.clearTimeout(respondSheetCloseTimerRef.current);
    }

    respondSheetCloseTimerRef.current = window.setTimeout(() => {
      setIsRespondSheetOpen(false);
      setSelectedPendingRequest(null);
      setResponseMemo('');
      setApprovedSummary(null);
      setRespondMessage(null);
      setIsRespondErrorMessage(false);
      respondSheetCloseTimerRef.current = null;
    }, SHEET_ANIMATION_DURATION_MS);
  };

  const handleRespondRequest = async (action: 'approve' | 'reject' | 'return') => {
    if (!selectedPendingRequest) {
      setIsRespondErrorMessage(true);
      setRespondMessage('처리할 요청을 선택해주세요.');
      return;
    }

    const normalizedResponseMemo = responseMemo.trim();

    if (action === 'reject' && !normalizedResponseMemo) {
      setIsRespondErrorMessage(true);
      setRespondMessage('거절 사유를 입력해주세요.');
      return;
    }

    if (normalizedResponseMemo.length > 300) {
      setIsRespondErrorMessage(true);
      setRespondMessage('응답 메모는 300자 이하로 입력해주세요.');
      return;
    }

    setIsResponding(true);
    setRespondMessage(null);
    setIsRespondErrorMessage(false);

    try {
      const response = await fetch(`/api/ticket-requests/${selectedPendingRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          logMemo: action === 'return' ? null : normalizedResponseMemo || null,
        }),
      });

      const result = (await response.json()) as RespondTicketRequestResponse;

      if (!response.ok || !result.success) {
        setIsRespondErrorMessage(true);
        setRespondMessage(result.error ?? '요청 처리에 실패했습니다.');
        return;
      }

      const [ticketsSynced, pendingSynced] = await Promise.all([
        loadTickets({ silent: true }),
        loadPendingRequests({ silent: true }),
      ]);

      if (!ticketsSynced) {
        const nextTicketStatus = action === 'approve' ? 'used' : 'available';

        setIssuedTickets((previous) =>
          previous.map((ticket) =>
            ticket.id === selectedPendingRequest.ticketId
              ? { ...ticket, status: nextTicketStatus }
              : ticket,
          ),
        );
      }

      if (!pendingSynced) {
        setPendingRequests((previous) =>
          previous.filter((request) => request.id !== selectedPendingRequest.id),
        );
      }

      setIsErrorMessage(false);

      if (action === 'approve') {
        setMessage('요청을 승인했습니다.');
        setApprovedSummary({
          remainingAvailableTicketCount: remainingAvailableAfterApprovePreview,
        });
        return;
      }

      const actionLabel = action === 'reject' ? '거절(사유 기록)' : '반환(없던 일 처리)';

      setMessage(`요청을 ${actionLabel}했습니다.`);
      closeRespondSheet();
    } catch {
      setIsRespondErrorMessage(true);
      setRespondMessage('네트워크 오류로 요청 처리에 실패했습니다.');
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10 pb-24">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-teal-700">TICKETS</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            티켓 목록
          </h1>
          <p className="text-xs text-slate-600 sm:text-sm">
            상태별 티켓을 확인하고, 발급자는 수동 발급을 진행할 수 있습니다.
          </p>
        </div>

        {!isRoleLoading && role === 'issuer' && (
          <button
            type="button"
            onClick={openIssueModal}
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 sm:text-sm"
          >
            수동 발급
          </button>
        )}
      </section>

      {role === 'receiver' && (
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReceiverView('tickets')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              receiverView === 'tickets'
                ? 'border-teal-300 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            티켓 목록
          </button>
          <button
            type="button"
            onClick={() => setReceiverView('history')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              receiverView === 'history'
                ? 'border-teal-300 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            요청 처리 결과 ({requestHistoryCount})
          </button>
        </section>
      )}

      {(role !== 'receiver' || receiverView === 'tickets') && (
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
      )}

      {message && (
        <p className={`text-sm font-medium ${isErrorMessage ? 'text-rose-600' : 'text-teal-700'}`}>
          {message}
        </p>
      )}

      {role === 'issuer' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">대기 중인 요청</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {pendingRequests.length}건
            </span>
          </div>

          {isPendingRequestsLoading ? (
            <p className="text-sm text-slate-500">요청 목록을 불러오는 중입니다...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="text-sm text-slate-500">현재 처리할 요청이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => {
                const timeoutProgress = getTimeoutProgress(request.createdAt, request.expiresAt);
                const isWarning = isTimeoutWarning(request.expiresAt);

                return (
                  <article
                    key={request.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {request.ticketTitle}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          요청자: {request.requestedBy.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          사용 날짜: {request.requestedForDate}
                        </p>
                        <p
                          className={`mt-1 text-xs ${isWarning ? 'font-semibold text-rose-600' : 'text-slate-500'}`}
                        >
                          {formatRemainingTime(request.expiresAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openRespondSheet(request)}
                        className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                      >
                        요청 처리
                      </button>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${isWarning ? 'bg-rose-500' : 'bg-teal-500'}`}
                        style={{ width: `${timeoutProgress}%` }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {role === 'receiver' && receiverView === 'history' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">요청 처리 결과</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {requestHistoryCount}건
            </span>
          </div>

          {isRequestHistoryLoading ? (
            <p className="text-sm text-slate-500">요청 처리 이력을 불러오는 중입니다...</p>
          ) : requestHistory.length === 0 ? (
            <p className="text-sm text-slate-500">아직 처리 완료된 요청이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {requestHistory.map((history) => (
                <article
                  key={history.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{history.ticketTitle}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        사용 날짜: {history.requestedForDate}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        처리 시각:{' '}
                        {history.respondedAt
                          ? formatDateTime(history.respondedAt)
                          : '처리 시각 없음'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${requestHistoryStatusClassName[history.status]}`}
                    >
                      {requestHistoryStatusLabel[history.status]}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600">요청 메모: {history.memo || '없음'}</p>

                  {history.status === 'rejected' && (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                      거절 사유: {history.responseMemo || '사유 없음'}
                    </p>
                  )}

                  {history.status === 'returned' && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                      반환 처리: 기존 요청을 취소한 상태로, 같은 날짜로 다시 요청할 수 있습니다.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {(role !== 'receiver' || receiverView === 'tickets') &&
        (isTicketsLoading ? (
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

                      {role === 'receiver' && ticket.status === 'available' && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => openRequestSheet(ticket)}
                            className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                          >
                            사용 요청
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))}

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

      {isRequestSheetOpen && selectedRequestTicket && (
        <div
          className={`fixed inset-0 z-30 flex items-end justify-center bg-slate-900/50 transition-opacity duration-300 ${
            isRequestSheetVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeRequestSheet}
        >
          <div
            className={`w-full max-w-3xl rounded-t-3xl border border-slate-200 bg-white px-6 py-6 shadow-2xl transition-transform duration-300 ease-out ${
              isRequestSheetVisible ? 'translate-y-0' : 'translate-y-full'
            } max-h-[85svh] overflow-y-auto`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-teal-700">REQUEST TICKET</p>
                <h2 className="text-xl font-bold text-slate-900">티켓 사용 요청</h2>
                <p className="text-sm text-slate-600">
                  요청을 보내면 파트너가 승인/거절을 선택할 수 있습니다.
                </p>
              </div>

              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="request-ticket" className="text-sm font-semibold text-slate-700">
                    사용할 티켓
                  </label>
                  <select
                    id="request-ticket"
                    value={
                      availableRequestTickets.some(
                        (ticket) => ticket.id === selectedRequestTicket.id,
                      )
                        ? selectedRequestTicket.id
                        : ''
                    }
                    onChange={(event) => {
                      const nextTicket = availableRequestTickets.find(
                        (ticket) => ticket.id === event.target.value,
                      );

                      if (!nextTicket) {
                        return;
                      }

                      setSelectedRequestTicket(nextTicket);
                      setRequestDate(startOfDay(new Date(nextTicket.createdAt)));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                  >
                    {availableRequestTickets.length === 0 ? (
                      <option value="">요청 가능한 티켓 없음</option>
                    ) : (
                      availableRequestTickets.map((ticket) => (
                        <option key={ticket.id} value={ticket.id}>
                          {ticket.title} (#{ticket.id.slice(0, 8)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedRequestTicket.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    티켓 #{selectedRequestTicket.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    만료 시각:{' '}
                    {selectedRequestTicket.expiresAt
                      ? formatDateTime(selectedRequestTicket.expiresAt)
                      : '설정 안함'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="request-date" className="text-sm font-semibold text-slate-700">
                    사용 날짜
                  </label>
                  <DatePicker
                    id="request-date"
                    selected={requestDate}
                    onChange={(value: Date | [Date | null, Date | null] | null) => {
                      if (value instanceof Date || value === null) {
                        setRequestDate(value);
                      }
                    }}
                    minDate={requestDateRange?.minDate}
                    maxDate={requestDateRange?.maxDate ?? undefined}
                    dateFormat="yyyy.MM.dd"
                    locale={ko}
                    placeholderText="사용 날짜 선택"
                    wrapperClassName="block w-full"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                  />

                  {requestDateRange ? (
                    <p className="text-xs text-slate-500">
                      선택 가능 범위: {formatDateOnly(requestDateRange.minDate)} ~{' '}
                      {requestDateRange.maxDate
                        ? formatDateOnly(requestDateRange.maxDate)
                        : '만료일 없음'}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-rose-600">
                      현재 이 티켓은 요청 가능한 사용 날짜가 없습니다.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="request-memo" className="text-sm font-semibold text-slate-700">
                    요청 메모 (선택)
                  </label>
                  <textarea
                    id="request-memo"
                    value={requestMemo}
                    maxLength={300}
                    onChange={(event) => setRequestMemo(event.target.value)}
                    rows={4}
                    placeholder="예: 이번 주 토요일 저녁에 사용하고 싶어요."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                  />
                  <p className="text-right text-xs text-slate-500">{requestMemo.length}/300</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label
                    className="flex items-center justify-between gap-3"
                    htmlFor="request-push-toggle"
                  >
                    <span className="text-sm font-semibold text-slate-700">Push 알림 전송</span>
                    <input
                      id="request-push-toggle"
                      type="checkbox"
                      checked={isPushNotificationEnabled}
                      onChange={(event) => setIsPushNotificationEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {isPushNotificationEnabled
                      ? '요청 전송 시 파트너에게 알림을 보냅니다.'
                      : '알림 없이 요청만 저장됩니다.'}
                  </p>
                </div>

                <p className="text-xs text-slate-500">
                  요청 전송 후 파트너는 설정된 응답 대기 시간 내에 승인/거절을 선택할 수 있어요.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeRequestSheet}
                    disabled={isRequesting}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isRequesting || !requestDateRange || availableRequestTickets.length === 0
                    }
                    className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isRequesting ? '요청 전송 중...' : '요청 보내기'}
                  </button>
                </div>

                {requestMessage && (
                  <p
                    className={`text-sm font-medium ${
                      isRequestErrorMessage ? 'text-rose-600' : 'text-teal-700'
                    }`}
                  >
                    {requestMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {isRespondSheetOpen && selectedPendingRequest && (
        <div
          className={`fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 transition-opacity duration-300 ${
            isRespondSheetVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeRespondSheet}
        >
          <div
            className={`w-full max-w-3xl rounded-t-3xl border border-slate-200 bg-white px-6 py-6 shadow-2xl transition-transform duration-300 ease-out ${
              isRespondSheetVisible ? 'translate-y-0' : 'translate-y-full'
            } max-h-[85svh] overflow-y-auto`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700">RESPONSE REQUEST</p>
                <h2 className="text-xl font-bold text-slate-900">요청 승인/거절 처리</h2>
                <p className="text-sm text-slate-600">요청 정보를 확인하고 액션을 선택하세요.</p>
              </div>

              {approvedSummary ? (
                <section className="space-y-4 rounded-xl border border-teal-200 bg-teal-50 p-5 text-sm">
                  <div className="flex items-center gap-2 text-teal-800">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white"
                    >
                      ✓
                    </span>
                    <p className="text-base font-semibold">승인했어요</p>
                  </div>
                  <p className="text-sm text-teal-900">
                    차감 후 잔여 티켓: {approvedSummary.remainingAvailableTicketCount}장
                  </p>
                  <button
                    type="button"
                    onClick={closeRespondSheet}
                    className="w-full rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
                  >
                    닫기
                  </button>
                </section>
              ) : (
                <>
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {selectedPendingRequest.requestedBy.name.trim().charAt(0) || '요'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {selectedPendingRequest.requestedBy.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          요청 시각: {formatDateTime(selectedPendingRequest.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-500">요청 상세</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {selectedPendingRequest.ticketTitle}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        <li>티켓 번호: #{selectedPendingRequest.ticketId.slice(0, 8)}</li>
                        <li>
                          만료일:{' '}
                          {selectedPendingTicket?.expiresAt
                            ? formatDateTime(selectedPendingTicket.expiresAt)
                            : '설정 안함'}
                        </li>
                        <li>차감 후 잔여 티켓: {remainingAvailableAfterApprovePreview}장</li>
                        <li>사용 날짜: {selectedPendingRequest.requestedForDate}</li>
                      </ul>
                    </div>

                    <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-700">
                      요청 메모: {selectedPendingRequest.memo || '없음'}
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isTimeoutWarning(selectedPendingRequest.expiresAt)
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${getTimeoutProgress(
                            selectedPendingRequest.createdAt,
                            selectedPendingRequest.expiresAt,
                          )}%`,
                        }}
                      />
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        isTimeoutWarning(selectedPendingRequest.expiresAt)
                          ? 'font-semibold text-rose-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatRemainingTime(selectedPendingRequest.expiresAt)}
                    </p>
                  </section>

                  <div className="space-y-1.5">
                    <label htmlFor="response-memo" className="text-sm font-semibold text-slate-700">
                      거절 사유 (거절 시 필수, 반환 시 입력값은 무시)
                    </label>
                    <textarea
                      id="response-memo"
                      value={responseMemo}
                      maxLength={300}
                      onChange={(event) => setResponseMemo(event.target.value)}
                      rows={3}
                      placeholder="예: 일정이 맞지 않아 이번 요청은 거절할게요."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
                    />
                    <p className="text-right text-xs text-slate-500">{responseMemo.length}/300</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={closeRespondSheet}
                      disabled={isResponding}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondRequest('approve')}
                      disabled={isResponding}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondRequest('reject')}
                      disabled={isResponding}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondRequest('return')}
                      disabled={isResponding}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      반환 처리
                    </button>
                  </div>
                </>
              )}

              {respondMessage && (
                <p
                  className={`text-sm font-medium ${
                    isRespondErrorMessage ? 'text-rose-600' : 'text-teal-700'
                  }`}
                >
                  {respondMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
};

export default TicketsPage;
