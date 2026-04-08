import BottomNav from '@/components/navigation/bottom-nav';

const LogsPage = () => {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-8 pb-24">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">LOGS</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">기록</h1>
        <p className="text-sm text-slate-600">
          사용 기록 타임라인은 다음 단계에서 상세하게 확장됩니다.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">아직 표시할 기록이 없습니다.</p>
      </section>

      <BottomNav />
    </main>
  );
};

export default LogsPage;
