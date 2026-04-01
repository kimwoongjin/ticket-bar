'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface CreateInviteCodeResponse {
  success: boolean;
  coupleId: string;
  inviteCode: string;
  expiresInHours: number;
}

const OnboardingCreatePage = () => {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [isGenerating, setIsGenerating] = useState(true);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle');

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
  }, []);

  useEffect(() => {
    void createInviteCode();
  }, [createInviteCode]);

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
        >
          파트너 연결 확인
        </button>
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
