'use client';

import { useState } from 'react';

type TimeoutAction = 'return' | 'auto_approve' | 'auto_reject';
type AutoIssueCycle = 'none' | 'weekly' | 'monthly';

const RulesSettingsPage = () => {
  const [timeoutHours, setTimeoutHours] = useState<number>(24);
  const [timeoutAction, setTimeoutAction] = useState<TimeoutAction>('return');
  const [autoIssueCycle, setAutoIssueCycle] = useState<AutoIssueCycle>('none');
  const [autoIssueCount, setAutoIssueCount] = useState<number>(0);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (timeoutHours <= 0) {
      setMessage('응답 대기 시간은 1시간 이상이어야 합니다.');
      return;
    }

    if (autoIssueCount < 0) {
      setMessage('자동 발급 장수는 0 이상이어야 합니다.');
      return;
    }

    setMessage('룰 기본값이 임시 저장되었습니다. 다음 단계에서 DB 연동이 추가됩니다.');
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-teal-700">RULE SETTINGS</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">룰 설정</h1>
        <p className="text-sm text-slate-600">
          요청 응답 규칙과 자동 발급 규칙을 설정합니다. (현재는 UI 단계)
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <label htmlFor="timeout-hours" className="text-sm font-semibold text-slate-700">
            요청 응답 대기 시간 (시간)
          </label>
          <input
            id="timeout-hours"
            type="number"
            min={1}
            value={timeoutHours}
            onChange={(event) => setTimeoutHours(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="timeout-action" className="text-sm font-semibold text-slate-700">
            타임아웃 시 자동 처리
          </label>
          <select
            id="timeout-action"
            value={timeoutAction}
            onChange={(event) => setTimeoutAction(event.target.value as TimeoutAction)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
          >
            <option value="return">반환 처리</option>
            <option value="auto_approve">자동 승인</option>
            <option value="auto_reject">자동 거절</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auto-issue-cycle" className="text-sm font-semibold text-slate-700">
            자동 발급 주기
          </label>
          <select
            id="auto-issue-cycle"
            value={autoIssueCycle}
            onChange={(event) => setAutoIssueCycle(event.target.value as AutoIssueCycle)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
          >
            <option value="none">사용 안함</option>
            <option value="weekly">매주</option>
            <option value="monthly">매월</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auto-issue-count" className="text-sm font-semibold text-slate-700">
            자동 발급 장수
          </label>
          <input
            id="auto-issue-count"
            type="number"
            min={0}
            value={autoIssueCount}
            onChange={(event) => setAutoIssueCount(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:border-teal-400 focus:ring-2"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          룰 저장
        </button>

        {message && <p className="text-sm font-medium text-teal-700">{message}</p>}
      </form>
    </main>
  );
};

export default RulesSettingsPage;
