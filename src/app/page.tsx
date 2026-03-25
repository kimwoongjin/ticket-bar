import Link from 'next/link';

const HomePage = () => {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">TicketBar</h1>
      <p className="text-lg text-slate-700">
        커플 간 약속을 티켓으로 관리하는 룰 기반 협약 플랫폼의 개발을 시작했습니다.
      </p>

      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white transition hover:bg-teal-700"
        >
          로그인 준비하기
        </Link>
        <Link href="/signup" className="font-semibold text-teal-700 hover:text-teal-800">
          회원가입 페이지 설계
        </Link>
      </div>
    </main>
  );
};

export default HomePage;
