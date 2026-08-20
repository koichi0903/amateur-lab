"use client";

import { useEffect, useState } from "react";

type Run = {
  run_id: string;
  status: "running" | "completed" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  log_file: string | null;
};

type Schedule = {
  group: string;
  latest: Run | null;
  lastSuccess: Run | null;
  lastFailure: Run | null;
};

const LABELS: Record<string, string> = {
  "daily-0030": "毎日 00:30",
  "daily-1030": "毎日 10:30",
  "tue-fri-1800": "火・金 18:00",
  "sunday-1800": "日曜 18:00",
};

const STATUS_LABELS: Record<Run["status"], string> = {
  running: "実行中",
  completed: "成功",
  failed: "失敗",
  skipped: "重複回避",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "記録なし";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function ScheduleStatusPanel() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/schedule-runs", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          schedules?: Schedule[];
          unavailable?: boolean;
        };
        if (!cancelled) {
          setSchedules(payload.schedules ?? []);
          setUnavailable(Boolean(payload.unavailable));
        }
      } catch (error) {
        console.error("Failed to load schedule status", error);
      }
    }

    void load();
    const intervalId = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-zinc-100">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-cyan-400">SCHEDULE MONITOR</p>
          <h2 className="mt-1 text-xl font-black">自動更新の稼働状況</h2>
        </div>
        <p className="text-xs text-zinc-500">1分ごとに更新</p>
      </div>

      {unavailable ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          監視テーブルのSQL適用後、次回の自動実行から履歴が表示されます。
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {schedules.map((schedule) => {
            const status = schedule.latest?.status;
            const statusColor =
              status === "completed"
                ? "text-emerald-400"
                : status === "failed"
                  ? "text-red-400"
                  : status === "running"
                    ? "text-amber-300"
                    : "text-zinc-400";

            return (
              <article key={schedule.group} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">{LABELS[schedule.group] ?? schedule.group}</h3>
                  <span className={`text-xs font-bold ${statusColor}`}>
                    {status ? STATUS_LABELS[status] : "未実行"}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">最終成功</dt>
                    <dd className="text-zinc-200">{formatDate(schedule.lastSuccess?.finished_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">最終実行</dt>
                    <dd className="text-zinc-200">{formatDate(schedule.latest?.started_at)}</dd>
                  </div>
                </dl>
                {schedule.latest?.status === "failed" && schedule.latest.error_message ? (
                  <p className="mt-3 line-clamp-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">
                    {schedule.latest.error_message}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
