'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const HomePage = () => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-teal-700">HOME</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">안녕하세요 👋</h1>
          <p className="text-sm text-slate-600">
            온보딩이 완료되었습니다. 다음 스프린트에서 실제 대시보드 데이터가 연결됩니다.
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

      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
        <p className="text-sm font-semibold text-teal-700">이번 달 잔여 티켓</p>
        <p className="mt-2 text-5xl font-bold text-teal-800">0</p>
        <p className="mt-2 text-sm text-teal-800/80">초기 데이터가 아직 없어서 0으로 표시됩니다.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">승인 대기 요청</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">0건</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">이번 달 사용</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">0회</p>
        </article>
      </section>

      <section className="flex items-center gap-3">
        <Link
          href="/onboarding/create"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          초대 코드 다시 보기
        </Link>
        <Link
          href="/onboarding/join"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          코드 입력 화면 보기
        </Link>
      </section>
    </main>
  );
};

export default HomePage;
