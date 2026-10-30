"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RunType = "daily_incremental" | "weekly_full";
type Mp4Run = {
  id: string;
  run_type: RunType;
  status: "running" | "completed" | "failed";
  target_count: number;
  processed_count: number;
  found_count: number;
  no_video_count: number;
  failed_attempt_count: number;
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};
type RunsResponse = { runs: Record<RunType, Mp4Run | null>; activeRun: Mp4Run | null; error?: string };
type RunResponse = { run: Mp4Run | null; error?: string };

const LABELS: Record<RunType, string> = {
  daily_incremental: "旧・日次新作MP4補完（履歴）",
  weekly_full: "週次・全対象MP4補完",
};

const STATUS_LABELS: Record<Mp4Run["status"], string> = {
  running: "実行中",
  completed: "完了",
  failed: "失敗",
};

function count(value: number) {
  return value.toLocaleString("ja-JP");
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("ja-JP") : "未実行";
}

function RunCardActions({
  runType,
  activeRun,
  busyType,
  onRunAll,
  onStop,
}: {
  runType: RunType;
  activeRun: Mp4Run | null;
  busyType: RunType | null;
  onRunAll: (runType: RunType, resumeRun?: Mp4Run) => void;
  onStop: () => void;
}) {
  const isActive = activeRun?.run_type === runType;
  const isBusy = busyType === runType;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {!activeRun && !isBusy && <button type="button" onClick={() => void onRunAll(runType)} className="rounded-xl bg-violet-400 px-4 py-3 text-sm font-black text-zinc-950">週次の全対象MP4補完を開始</button>}
      {isActive && !isBusy && <button type="button" onClick={() => void onRunAll(runType, activeRun!)} className="rounded-xl bg-violet-400 px-4 py-3 text-sm font-black text-zinc-950">続きから再開</button>}
      {isBusy && <button type="button" onClick={onStop} className="rounded-xl border border-zinc-600 px-4 py-3 text-sm font-bold">一時停止</button>}
    </div>
  );
}

export default function FanzaAmateurMp4Completion() {
  const [runs, setRuns] = useState<Record<RunType, Mp4Run | null>>({ daily_incremental: null, weekly_full: null });
  const [activeRun, setActiveRun] = useState<Mp4Run | null>(null);
  const [busyType, setBusyType] = useState<RunType | null>(null);
  const [message, setMessage] = useState("");
  const stopRef = useRef(false);
  const autoStartRef = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-amateur-mp4-completion", { cache: "no-store" });
    const data = await response.json() as RunsResponse;
    if (!response.ok) throw new Error(data.error || "MP4補完状態を読み込めませんでした。");
    setRuns(data.runs);
    setActiveRun(data.activeRun);
    return data;
  }, []);

  const request = useCallback(async (action: "start" | "continue", runType: RunType, runId?: string) => {
    const response = await fetch("/api/admin/fanza-amateur-mp4-completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, runType, ...(runId ? { runId } : {}) }),
    });
    const data = await response.json() as RunResponse;
    if (!response.ok) throw new Error(data.error || "MP4補完を進められませんでした。");
    if (data.run) {
      setRuns((current) => ({ ...current, [data.run!.run_type]: data.run }));
      setActiveRun(data.run.status === "running" ? data.run : null);
    }
    return data.run;
  }, []);

  const runAll = useCallback(async (runType: RunType, resumeRun?: Mp4Run) => {
    setBusyType(runType);
    stopRef.current = false;
    setMessage(`${LABELS[runType]}を準備しています。`);
    try {
      let run = resumeRun ?? await request("start", runType);
      while (run?.status === "running" && !stopRef.current) {
        run = await request("continue", runType, run.id);
        if (run?.status === "completed") {
          setMessage(`${LABELS[runType]}が完了しました。取得${count(run.found_count)}件・動画なし${count(run.no_video_count)}件。`);
        } else if (run?.status === "running") {
          setMessage(`${LABELS[runType]}：${count(run.processed_count)} / ${count(run.target_count)}件を確認 · MP4取得 ${count(run.found_count)}件 · 3回失敗で動画なしとして終了`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      if (stopRef.current && run?.status === "running") setMessage("一時停止しました。再開ボタンから続けられます。");
      await refresh().catch(() => undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MP4補完に失敗しました。");
      await refresh().catch(() => undefined);
    } finally {
      setBusyType(null);
    }
  }, [refresh, request]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mp4");
    const runType: RunType | null = mode === "full" || mode === "weekly" ? "weekly_full" : null;
    if (params.get("startMp4") === "1" && runType && !autoStartRef.current) {
      autoStartRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      void runAll(runType);
      return;
    }
    void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "MP4補完状態を読み込めませんでした。"));
  }, [refresh, runAll]);

  function renderCard(runType: RunType, description: string, rangeDescription: string) {
    const run = runs[runType];
    const status = run ? STATUS_LABELS[run.status] : "未実行";
    return (
      <article key={runType} className="rounded-2xl border border-violet-900 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black tracking-[0.14em] text-violet-300">WEEKLY FULL CATALOG</p><h3 className="mt-2 text-lg font-black">{LABELS[runType]}</h3></div>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold">{status}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-300">{description}</p>
        <p className="mt-2 text-xs text-zinc-400">対象：{rangeDescription}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="処理済み / 対象" value={`${count(run?.processed_count ?? 0)} / ${count(run?.target_count ?? 0)}`} />
          <Metric label="MP4取得" value={`${count(run?.found_count ?? 0)}件`} />
          <Metric label="動画なし確定" value={`${count(run?.no_video_count ?? 0)}件`} />
          <Metric label="最終実行" value={dateTime(run?.completed_at ?? run?.started_at)} />
        </div>
        {run?.last_error && <p className="mt-3 rounded-lg bg-amber-950/60 p-3 text-xs leading-5 text-amber-200">{run.last_error}</p>}
        <RunCardActions
          runType={runType}
          activeRun={activeRun}
          busyType={busyType}
          onRunAll={runAll}
          onStop={() => { stopRef.current = true; }}
        />
      </article>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-900 bg-zinc-900 p-6">
      <p className="text-xs font-black tracking-[0.16em] text-violet-300">FANZA AMATEUR / OFFICIAL MP4 URL</p>
      <h2 className="mt-2 text-2xl font-black">週次・全対象MP4リンク補完</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">APIに含まれない公式MP4リンクを、既存と同じ商品ページ・プレイヤー検出方法で確認し、素人専用テーブルに保存します。処理時間を抑えるため、最大3作品を同時に確認し、1回の通信で最大6作品を進めます。MP4取得済みと動画なし確定の作品は再処理しません。失敗は実行ごとに1回だけ記録し、3回目で動画なしとして終了します。</p>
      <div className="mt-5">{renderCard("weekly_full", "掲載中作品のうちMP4未取得で試行回数が3回未満の作品をすべて確認します。取得済みと3回失敗済みは対象外です。", "素人専用テーブルの全未処理作品")}</div>
      {activeRun?.run_type === "daily_incremental" && <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">旧方式の日次新作MP4補完が進行中です。続きから再開して終了できます。<button type="button" disabled={busyType !== null} onClick={() => void runAll("daily_incremental", activeRun)} className="ml-3 rounded-lg bg-amber-400 px-3 py-2 font-bold text-zinc-950 disabled:opacity-50">旧ジョブを再開</button></div>}
      {message && <p role="status" className="mt-4 rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-200">{message}</p>}
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">週次の全対象補完を必要に応じて手動で開始します。自動時刻実行は設定しません。MP4取得済み・3回失敗済みの作品は再処理しません。</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-500">{label}</p><strong className="mt-1 block text-xs">{value}</strong></div>;
}
