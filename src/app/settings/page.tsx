import Link from 'next/link';

const SettingsPage = () => {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">SETTINGS</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">설정</h1>
        <p className="text-sm text-slate-600">
          설정 카테고리 화면은 스프린트 후반에 확장됩니다. 우선 룰 설정 화면으로 이동해 기본값을
          확인해보세요.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">룰 설정</h2>
        <p className="mt-1 text-sm text-slate-600">
          응답 타임아웃, 자동 처리, 자동 발급 주기를 설정합니다.
        </p>

        <Link
          href="/settings/rules"
          className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          룰 설정 열기
        </Link>
      </section>
    </main>
  );
};

export default SettingsPage;
