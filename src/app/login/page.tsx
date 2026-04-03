'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const toSafeClientNextPath = (value: string | null, fallbackPath: string): string => {
  if (!value) {
    return fallbackPath;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallbackPath;
  }

  return value;
};

const getNextPathFromCurrentLocation = (): string => {
  if (typeof window === 'undefined') {
    return '/home';
  }

  const params = new URLSearchParams(window.location.search);
  return toSafeClientNextPath(params.get('next'), '/home');
};

const LoginPage = () => {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('이메일 형식을 확인해주세요.');
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage('비밀번호는 8자 이상 입력해주세요.');
      return;
    }

    setIsEmailSubmitting(true);

    try {
      const nextPath = getNextPathFromCurrentLocation();

      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(result.error ?? '로그인에 실패했습니다.');
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      const nextPath = getNextPathFromCurrentLocation();

      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          next: nextPath,
        }),
      });

      const result = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !result.url) {
        setErrorMessage(result.error ?? 'Google 로그인 시작에 실패했습니다.');
        return;
      }

      window.location.href = result.url;
    } catch {
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">TicketBar 로그인</h1>
        <p className="text-sm text-slate-600">
          티켓 약속을 계속 관리하려면 로그인하세요. 이메일 또는 Google 계정을 사용할 수 있어요.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-slate-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상 입력"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
            />
          </div>

          {errorMessage && <p className="text-sm font-medium text-rose-600">{errorMessage}</p>}

          <button
            type="submit"
            disabled={isEmailSubmitting || isGoogleSubmitting}
            className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isEmailSubmitting ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </form>

        <div className="my-4 h-px w-full bg-slate-200" />

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isEmailSubmitting || isGoogleSubmitting}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isGoogleSubmitting ? 'Google 로그인 준비 중...' : 'Google로 로그인'}
        </button>
      </section>

      <p className="text-center text-sm text-slate-600">
        계정이 없나요?{' '}
        <Link href="/signup" className="font-semibold text-teal-700 hover:text-teal-800">
          회원가입
        </Link>
      </p>
    </main>
  );
};

export default LoginPage;
