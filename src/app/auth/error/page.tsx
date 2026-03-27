import Link from 'next/link';

const AuthErrorPage = () => {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold text-slate-900">인증 처리에 실패했어요</h1>
      <p className="text-slate-700">다시 로그인 절차를 진행해주세요.</p>
      <Link href="/" className="font-semibold text-teal-700 hover:text-teal-800">
        홈으로 이동
      </Link>
    </main>
  );
};

export default AuthErrorPage;
