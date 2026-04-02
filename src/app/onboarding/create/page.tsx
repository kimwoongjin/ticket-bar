'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface CreateInviteCodeResponse {
  success: boolean;
  coupleId: string;
  inviteCode: string;
  expiresInHours: number;
}

interface OnboardingStatusResponse {
  connected: boolean;
  memberCount: number;
  role?: string;
  inviteCode?: string;
  status?: string;
  error?: string;
}

const OnboardingCreatePage = () => {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [isGenerating, setIsGenerating] = useState(true);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionState, setConnectionState] = useState<
    'idle' | 'checking' | 'waiting' | 'connected' | 'error'
  >('idle');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const checkConnectionStatus = useCallback(
    async (isPolling: boolean): Promise<OnboardingStatusResponse | null> => {
      if (!isPolling) {
        setConnectionState('checking');
        setConnectionMessage(null);
      }

      try {
        const response = await fetch('/api/onboarding/status', { method: 'GET' });
        const result = (await response.json()) as OnboardingStatusResponse;

        if (!response.ok) {
          setConnectionState('error');
          setConnectionMessage(result.error ?? '연결 상태 확인에 실패했습니다.');
          return null;
        }

        if (result.role === 'issuer' && result.inviteCode) {
          setInviteCode((currentInviteCode) => currentInviteCode ?? result.inviteCode ?? null);
        }

        if (result.connected) {
          setConnectionState('connected');
          setConnectionMessage('파트너 연결이 완료되었어요. 이제 홈으로 이동할 수 있어요.');
          return result;
        }

        setConnectionState('waiting');
        if (!isPolling) {
          setConnectionMessage(
            '아직 연결 대기 중이에요. 파트너가 코드를 입력하면 자동으로 갱신됩니다.',
          );
        }

        return result;
      } catch {
        setConnectionState('error');
        setConnectionMessage('네트워크 오류로 연결 상태 확인에 실패했습니다.');
        return null;
      }
    },
    [],
  );

  const createInviteCode = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setCopyFeedback('idle');

    try {
      const response = await fetch('/api/onboarding/create', {
        method: 'POST',
      });

      const result = (await response.json()) as Partial<CreateInviteCodeResponse> & {
        error?: string;
      };

      if (!response.ok || !result.inviteCode || !result.expiresInHours) {
        if (response.status === 409) {
          const statusResult = await checkConnectionStatus(false);

          if (statusResult?.inviteCode) {
            setInviteCode(statusResult.inviteCode);
            setExpiresInHours(24);
            setGenerateError(null);
            return;
          }
        }

        setGenerateError(result.error ?? '초대 코드 생성에 실패했습니다. 다시 시도해주세요.');
        setInviteCode(null);
        return;
      }

      setInviteCode(result.inviteCode);
      setExpiresInHours(result.expiresInHours);
    } catch {
      setGenerateError('네트워크 오류로 코드 생성에 실패했습니다. 다시 시도해주세요.');
      setInviteCode(null);
    } finally {
      setIsGenerating(false);
    }
  }, [checkConnectionStatus]);

  useEffect(() => {
    void createInviteCode();
  }, [createInviteCode]);

  useEffect(() => {
    if (!inviteCode || connectionState === 'connected') {
      return;
    }

    const timer = setInterval(() => {
      void checkConnectionStatus(true);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [checkConnectionStatus, connectionState, inviteCode]);

  const handleCopy = async () => {
    if (!inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyFeedback('success');
    } catch {
      setCopyFeedback('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-6 py-10">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">Step 2 / 초대 코드 생성</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">파트너를 초대해요</h1>
        <p className="text-sm text-slate-600">
          생성된 코드를 파트너에게 전달하면 연결을 시작할 수 있습니다. 코드 유효시간은 24시간입니다.
        </p>
      </section>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">초대 코드</p>
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-center">
            <span className="font-mono text-4xl font-bold tracking-wider text-teal-700">
              {isGenerating ? '생성 중...' : (inviteCode ?? '생성 실패')}
            </span>
          </div>
          {generateError && <p className="text-sm font-medium text-rose-600">{generateError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isGenerating || !inviteCode}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            코드 복사
          </button>

          <button
            type="button"
            onClick={() => {
              void createInviteCode();
            }}
            disabled={isGenerating}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isGenerating ? '생성 중...' : '코드 다시 생성'}
          </button>

          {copyFeedback === 'success' && (
            <p className="text-sm font-medium text-emerald-600">코드가 클립보드에 복사되었어요.</p>
          )}
          {copyFeedback === 'error' && (
            <p className="text-sm font-medium text-rose-600">
              복사에 실패했어요. 직접 코드를 전달해주세요.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          이 코드는 생성 시점부터 {expiresInHours}시간 동안 유효합니다.
        </div>

        <button
          type="button"
          disabled={isGenerating || !inviteCode}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          onClick={() => {
            void checkConnectionStatus(false);
          }}
        >
          {connectionState === 'checking' ? '확인 중...' : '파트너 연결 확인'}
        </button>

        {connectionMessage && (
          <p
            className={`text-sm font-medium ${connectionState === 'connected' ? 'text-emerald-600' : connectionState === 'error' ? 'text-rose-600' : 'text-slate-600'}`}
          >
            {connectionMessage}
          </p>
        )}

        {connectionState === 'connected' && (
          <Link
            href="/home"
            className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            홈으로 이동
          </Link>
        )}
      </section>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/onboarding" className="font-semibold text-slate-600 hover:text-slate-800">
          역할 선택으로 돌아가기
        </Link>
        <Link href="/onboarding/join" className="font-semibold text-teal-700 hover:text-teal-800">
          수신자 화면 보기
        </Link>
      </div>
    </main>
  );
};

export default OnboardingCreatePage;
