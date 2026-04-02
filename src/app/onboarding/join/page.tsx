'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const INVITE_CODE_REGEX = /^TB-[0-9]{4}$/;

const normalizeInviteCode = (value: string): string => {
  const compact = value.replace(/\s+/g, '').toUpperCase();

  if (compact.length <= 2) {
    return compact;
  }

  if (compact.startsWith('TB') && !compact.startsWith('TB-')) {
    return `TB-${compact.slice(2)}`;
  }

  return compact;
};

const OnboardingJoinPage = () => {
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const trimmedCode = inviteCode.trim();
  const isValidFormat = INVITE_CODE_REGEX.test(trimmedCode);

  const helperMessage = useMemo(() => {
    if (!trimmedCode) {
      return '코드 형식: TB-1234';
    }

    if (!isValidFormat) {
      return '올바른 코드 형식이 아니에요. 예: TB-1234';
    }

    return '형식이 올바릅니다.';
  }, [isValidFormat, trimmedCode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidFormat) {
      setSubmitState('error');
      setSubmitMessage('코드 형식을 확인해주세요.');
      return;
    }

    setSubmitState('loading');
    setSubmitMessage(null);

    try {
      const response = await fetch('/api/onboarding/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: trimmedCode,
        }),
      });

      const result = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok || !result.success) {
        setSubmitState('error');
        setSubmitMessage(result.error ?? '코드 확인에 실패했어요. 다시 시도해주세요.');
        return;
      }

      setSubmitState('success');
      setSubmitMessage('코드 확인 성공! 온보딩을 완료했어요.');

      router.push('/home');
      router.refresh();
    } catch {
      setSubmitState('error');
      setSubmitMessage('네트워크 오류로 연결에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 px-6 py-10">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">Step 2 / 초대 코드 입력</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          코드로 파트너와 연결해요
        </h1>
        <p className="text-sm text-slate-600">
          발급자에게 받은 초대 코드를 입력하면 커플 연결을 진행할 수 있습니다.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="invite-code" className="text-sm font-semibold text-slate-700">
            초대 코드
          </label>
          <input
            id="invite-code"
            type="text"
            value={inviteCode}
            onChange={(event) => {
              setInviteCode(normalizeInviteCode(event.target.value));
              if (submitState !== 'idle') {
                setSubmitState('idle');
                setSubmitMessage(null);
              }
            }}
            placeholder="TB-1234"
            autoComplete="off"
            maxLength={7}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-3xl font-bold tracking-widest text-slate-900 outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
          />

          <p
            className={`text-sm ${isValidFormat || !trimmedCode ? 'text-slate-600' : 'text-rose-600'}`}
          >
            {helperMessage}
          </p>

          {submitState === 'error' && (
            <p className="text-sm font-medium text-rose-600">{submitMessage}</p>
          )}
          {submitState === 'success' && (
            <p className="text-sm font-medium text-emerald-600">{submitMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitState === 'loading' ? '연결 확인 중...' : '연결하기'}
          </button>
        </form>
      </section>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/onboarding" className="font-semibold text-slate-600 hover:text-slate-800">
          역할 선택으로 돌아가기
        </Link>
        <Link href="/onboarding/create" className="font-semibold text-teal-700 hover:text-teal-800">
          발급자 화면 보기
        </Link>
      </div>
    </main>
  );
};

export default OnboardingJoinPage;
