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
  daily_incremental: "日次・新作MP4補完",
  weekly_full: "週次・全作品MP4補完",
};

function count(value: number) {
  return value.toLocaleString("ja-JP");
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("ja-JP") : "未実行";
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
    const runType: RunType | null = mode === "daily" ? "daily_incremental" : mode === "weekly" ? "weekly_full" : null;
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
    const isActive = activeRun?.run_type === runType;
    const isBusy = busyType === runType;
    const status = !run ? "未実行" : run.status === "running" ? "実行中" : run.status === "completed" ? "完了" : "失敗";
    return (
      <article key={runType} className="rounded-2xl border border-violet-900 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black tracking-[0.14em] text-violet-300">{runType === "daily_incremental" ? "DAILY NEW WORKS" : "WEEKLY FULL CATALOG"}</p><h3 className="mt-2 text-lg font-black">{LABELS[runType]}</h3></div>
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
        <div className="mt-4 flex flex-wrap gap-2">
          {!activeRun && !isBusy && <button type="button" onClick={() => void runAll(runType)} className="rounded-xl bg-violet-400 px-4 py-3 text-sm font-black text-zinc-950">{runType === "daily_incremental" ? "日次MP4補完を開始" : "週次MP4補完を開始"}</button>}
          {isActive && !isBusy && <button type="button" onClick={() => void runAll(runType, activeRun!)} className="rounded-xl bg-violet-400 px-4 py-3 text-sm font-black text-zinc-950">続きから再開</button>}
          {isBusy && <button type="button" onClick={() => { stopRef.current = true; }} className="rounded-xl border border-zinc-600 px-4 py-3 text-sm font-bold">一時停止</button>}
        </div>
      </article>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-900 bg-zinc-900 p-6">
      <p className="text-xs font-black tracking-[0.16em] text-violet-300">FANZA AMATEUR / OFFICIAL MP4 URL</p>
      <h2 className="mt-2 text-2xl font-black">素人作品 MP4リンク補完</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">APIに含まれない公式MP4リンクを、既存と同じ商品ページ・プレイヤー検出方法で確認し、素人専用テーブルに保存します。MP4取得済みと動画なし確定の作品は再処理しません。失敗は実行ごとに1回だけ記録し、3回目で動画なしとして終了します。</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {renderCard("daily_incremental", "新着作品のMP4リンクを補完します。失敗作品は同じ実行中に繰り返さず、次の日次実行で再試行できます。", "今日の7日前〜7日後")}
        {renderCard("weekly_full", "全掲載中作品のうち、MP4未取得で試行回数が3回未満の作品を補完します。", "素人専用テーブルの未処理作品")}
      </div>
      {message && <p role="status" className="mt-4 rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-200">{message}</p>}
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">ローカル管理画面から手動で開始する処理です。週次/日次の自動スケジュールは設定しません。MP4 URLは期限付きの場合があるため、保存リンクの再生可否は取得後に別途確認が必要です。</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-500">{label}</p><strong className="mt-1 block text-xs">{value}</strong></div>;
}
