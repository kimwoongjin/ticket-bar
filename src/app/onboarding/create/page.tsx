'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const generateInviteCode = (): string => {
  const randomNumber = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `TB-${randomNumber}`;
};

const OnboardingCreatePage = () => {
  const inviteCode = useMemo(() => generateInviteCode(), []);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
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
              {inviteCode}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            코드 복사
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
          이 코드는 생성 시점부터 24시간 동안 유효합니다.
        </div>

        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
