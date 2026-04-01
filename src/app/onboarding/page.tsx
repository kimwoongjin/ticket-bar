import Link from 'next/link';

const OnboardingPage = () => {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-10">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">Step 1 / 역할 선택</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">온보딩을 시작해요</h1>
        <p className="text-sm text-slate-600">
          두 사람의 약속 흐름을 정하려면 먼저 역할을 선택해주세요. 이후 초대 코드 생성/입력 단계로
          이어집니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-teal-700">ISSUER</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">발급자</h2>
          <p className="mt-2 text-sm text-slate-600">
            티켓을 발급하고 요청을 승인/거절하며 규칙을 관리합니다.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            <li>• 초대 코드 생성</li>
            <li>• 티켓 발급 및 승인/거절</li>
            <li>• 룰 설정 접근 가능</li>
          </ul>
          <Link
            href="/onboarding/create"
            className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            발급자로 시작하기
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-600">RECEIVER</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">수신자</h2>
          <p className="mt-2 text-sm text-slate-600">
            발급자가 만든 초대 코드로 연결하고 티켓 사용 요청을 보냅니다.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            <li>• 초대 코드 입력으로 연결</li>
            <li>• 티켓 사용 요청 전송</li>
            <li>• 상태/알림 확인</li>
          </ul>
          <Link
            href="/onboarding/join"
            className="mt-5 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            수신자로 시작하기
          </Link>
        </article>
      </section>
    </main>
  );
};

export default OnboardingPage;
