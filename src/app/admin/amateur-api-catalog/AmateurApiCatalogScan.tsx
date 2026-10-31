"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  catalogRunStepEffects,
  type CatalogRunType,
} from "./AmateurApiCatalogMessages";

type RunType = CatalogRunType;
type ScanRun = {
  id: string;
  status: "running" | "completed" | "limit_reached" | "needs_attention" | "failed";
  run_type: RunType;
  total_count: number | null;
  next_offset: number;
  fetched_item_count: number;
  observed_item_key_paths: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  pending_ranges: { fromDate: string; toDate: string }[];
  current_range: { fromDate: string; toDate: string; offset: number; expectedCount: number | null } | null;
  expected_item_count: number;
  completed_range_count: number;
  range_count: number;
  rank_next_offset: number;
  rank_fetched_item_count: number;
  rank_total_count: number | null;
  rank_snapshot_at: string | null;
};
type RunResponse = { run: ScanRun | null; processedItemCount: number; error?: string };
type RunsResponse = { runs: Record<RunType, ScanRun | null>; activeRun: ScanRun | null; error?: string };
type CatalogRunRequest = (
  action: "start" | "continue",
  runType: RunType,
  runId?: string,
) => Promise<RunResponse>;
type AmateurWork = {
  content_id: string;
  title: string | null;
  api_date: string | null;
  rank: number | null;
  rank_observed_at: string | null;
  raw_item: Record<string, unknown>;
  fetched_at: string;
  is_listed: boolean;
  missing_since: string | null;
  mp4_url: string | null;
  mp4_status: "pending" | "found" | "no_video";
  mp4_attempt_count: number;
  mp4_checked_at: string | null;
};
type WorksResponse = { items: AmateurWork[]; page: number; pageSize: number; total: number; error?: string };

const RUN_LABELS: Record<RunType, string> = {
  daily_incremental: "旧・日次新作補完（履歴）",
  weekly_full: "週次・全作品API補完",
};

function count(value: number) {
  return value.toLocaleString("ja-JP");
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("ja-JP") : "未実行";
}

function isLegacyActiveRun(run: ScanRun | null) {
  return Boolean(run
    && run.status === "running"
    && !run.current_range
    && run.pending_ranges.length === 0
    && run.expected_item_count === 0
    && run.completed_range_count === 0
    && run.range_count === 0);
}

function statusLabel(run: ScanRun | null) {
  if (!run) return "未実行";
  if (run.status === "running") return "実行中";
  if (run.status === "completed") return "完了";
  if (run.status === "needs_attention") return "要確認";
  if (run.status === "limit_reached") return "API上限";
  return "失敗";
}

function runStatusTone(run: ScanRun | null, isLegacy: boolean) {
  if (isLegacy || run?.status === "needs_attention") {
    return "bg-amber-900 text-amber-200";
  }
  if (run?.status === "running") return "bg-blue-900 text-blue-200";
  return "bg-zinc-800 text-zinc-300";
}

function RunCardStatus({ run, isLegacy }: { run: ScanRun | null; isLegacy: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${runStatusTone(run, isLegacy)}`}>
      {isLegacy ? "旧仕様・要切替" : statusLabel(run)}
    </span>
  );
}

function RunCardMetrics({ run }: { run: ScanRun | null }) {
  const fetchedItemCount = run?.fetched_item_count ?? 0;
  const completedRangeCount = run?.completed_range_count ?? 0;
  const rangeCount = run?.range_count ?? 0;
  const lastRunAt = run?.completed_at ?? run?.started_at;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-500">処理済み</p><strong className="mt-1 block">{count(fetchedItemCount)}</strong></div>
      <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-500">分割範囲</p><strong className="mt-1 block">{count(completedRangeCount)} / {count(rangeCount)}</strong></div>
      <div className="rounded-xl bg-zinc-950 p-3"><p className="text-[11px] text-zinc-500">最終実行</p><strong className="mt-1 block text-xs">{dateTime(lastRunAt)}</strong></div>
    </div>
  );
}

function RunCardError({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <p className="mt-3 rounded-lg bg-amber-950/60 p-3 text-xs leading-5 text-amber-200">{error}</p>;
}

function RunCardActions({
  runType,
  activeRun,
  isActive,
  isLegacy,
  isBusy,
  onRunAll,
  onStop,
}: {
  runType: RunType;
  activeRun: ScanRun | null;
  isActive: boolean;
  isLegacy: boolean;
  isBusy: boolean;
  onRunAll: (runType: RunType, resumeRun?: ScanRun) => void;
  onStop: () => void;
}) {
  const startHref = "/admin/amateur-api-catalog?mode=full&start=1";

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {!activeRun && !isBusy && <a href={startHref} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950">週次の全作品補完を開始</a>}
      {isActive && isLegacy && !isBusy && <button type="button" onClick={() => void onRunAll(runType)} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950">旧履歴を保持して新方式で開始</button>}
      {isActive && !isLegacy && !isBusy && <button type="button" onClick={() => void onRunAll(runType, activeRun!)} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950">続きから再開</button>}
      {isBusy && <button type="button" onClick={onStop} className="rounded-xl border border-zinc-600 px-4 py-3 text-sm font-bold">一時停止</button>}
    </div>
  );
}

function AmateurApiCatalogRunCard({
  runType,
  run,
  activeRun,
  busyType,
  description,
  rangeDescription,
  onRunAll,
  onStop,
}: {
  runType: RunType;
  run: ScanRun | null;
  activeRun: ScanRun | null;
  busyType: RunType | null;
  description: string;
  rangeDescription: string;
  onRunAll: (runType: RunType, resumeRun?: ScanRun) => void;
  onStop: () => void;
}) {
  const isActive = activeRun?.run_type === runType;
  const isLegacy = isActive && isLegacyActiveRun(activeRun);
  const isBusy = busyType === runType;

  return (
    <article className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.14em] text-emerald-300">WEEKLY FULL RECONCILIATION</p>
          <h2 className="mt-2 text-xl font-black">{RUN_LABELS[runType]}</h2>
        </div>
        <RunCardStatus run={run} isLegacy={isLegacy} />
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{description}</p>
      <p className="mt-2 text-xs text-zinc-400">対象期間：{rangeDescription}</p>
      <RunCardMetrics run={run} />
      <RunCardError error={run?.last_error} />
      <RunCardActions
        runType={runType}
        activeRun={activeRun}
        isActive={isActive}
        isLegacy={isLegacy}
        isBusy={isBusy}
        onRunAll={onRunAll}
        onStop={onStop}
      />
    </article>
  );
}

async function continueCatalogRun({
  runType,
  resumeRun,
  request,
  refreshWorks,
  shouldStop,
  setMessage,
}: {
  runType: RunType;
  resumeRun?: ScanRun;
  request: CatalogRunRequest;
  refreshWorks: (page?: number) => Promise<void>;
  shouldStop: () => boolean;
  setMessage: (message: string) => void;
}) {
  let next = resumeRun
    ? { run: resumeRun, processedItemCount: resumeRun.fetched_item_count }
    : await request("start", runType);
  let step = 0;
  while (next.run?.status === "running" && !shouldStop()) {
    next = await request("continue", runType, next.run.id);
    step += 1;
    const effects = catalogRunStepEffects(next.run, RUN_LABELS[runType], runType, step);
    if (effects.message) setMessage(effects.message);
    if (effects.refreshWorks) await refreshWorks(1).catch(() => undefined);
    if (effects.wait) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (shouldStop() && next.run?.status === "running") {
    setMessage("一時停止しました。画面を開き直して「続きから再開」できます。");
  }
}

export default function AmateurApiCatalogScan() {
  const [runs, setRuns] = useState<Record<RunType, ScanRun | null>>({ daily_incremental: null, weekly_full: null });
  const [activeRun, setActiveRun] = useState<ScanRun | null>(null);
  const [busyType, setBusyType] = useState<RunType | null>(null);
  const [message, setMessage] = useState("");
  const [works, setWorks] = useState<AmateurWork[]>([]);
  const [worksPage, setWorksPage] = useState(1);
  const [worksTotal, setWorksTotal] = useState(0);
  const stopRef = useRef(false);
  const autoStartRef = useRef(false);

  const refreshRuns = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-amateur-api-catalog", { cache: "no-store" });
    const data = await response.json() as RunsResponse;
    if (!response.ok) throw new Error(data.error || "補完状況を読み込めませんでした。");
    setRuns(data.runs);
    setActiveRun(data.activeRun);
    return data;
  }, []);

  const refreshWorks = useCallback(async (page = 1) => {
    const response = await fetch(`/api/admin/fanza-amateur-api-catalog?items=1&page=${page}`, { cache: "no-store" });
    const data = await response.json() as WorksResponse;
    if (!response.ok) throw new Error(data.error || "作品別APIデータを読み込めませんでした。");
    setWorks(data.items);
    setWorksPage(data.page);
    setWorksTotal(data.total);
  }, []);

  const request = useCallback(async (action: "start" | "continue", runType: RunType, runId?: string) => {
    const response = await fetch("/api/admin/fanza-amateur-api-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, runType, ...(runId ? { runId } : {}) }),
    });
    const data = await response.json() as RunResponse;
    if (!response.ok) throw new Error(data.error || "補完を進められませんでした。");
    if (data.run) {
      setRuns((current) => ({ ...current, [data.run!.run_type]: data.run }));
      setActiveRun(data.run.status === "running" ? data.run : null);
    }
    return data;
  }, []);

  const runAll = useCallback(async (runType: RunType, resumeRun?: ScanRun) => {
    setBusyType(runType);
    stopRef.current = false;
    setMessage(`${RUN_LABELS[runType]}を準備しています。`);
    try {
      await continueCatalogRun({
        runType,
        resumeRun,
        request,
        refreshWorks,
        shouldStop: () => stopRef.current,
        setMessage,
      });
      await refreshRuns().catch(() => undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "DMM API補完に失敗しました。");
      await refreshRuns().catch(() => undefined);
    } finally {
      setBusyType(null);
      await refreshWorks(1).catch(() => undefined);
    }
  }, [refreshRuns, refreshWorks, request]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const mode = query.get("mode");
    const runType: RunType | null = mode === "full" || mode === "weekly" ? "weekly_full" : null;
    if (query.get("start") === "1" && runType && !autoStartRef.current) {
      autoStartRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      void runAll(runType);
      return;
    }
    void Promise.all([refreshRuns(), refreshWorks()]).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "補完状況を読み込めませんでした。"));
  }, [refreshRuns, refreshWorks, runAll]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-emerald-900 bg-zinc-900 p-6">
        <p className="text-xs font-black tracking-[0.16em] text-emerald-300">DMM ITEM API / OFFSET 5,000 SAFE</p>
        <h2 className="mt-2 text-2xl font-black">週次・全作品API補完</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">ボタンを押すとAPI掲載作品を全期間で再照合し、作品情報と価格・セール情報を更新します。1回の検索範囲が5,000件を超えた場合は日付範囲を自動分割します。途中失敗・件数不一致・分割できない範囲がある場合は掲載終了を判定せず、要確認で止まります。</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <AmateurApiCatalogRunCard
            runType="weekly_full"
            run={runs.weekly_full}
            activeRun={activeRun}
            busyType={busyType}
            description="全作品の価格・セール情報を含むAPIデータを再取得します。成功完了後にだけ未掲載候補を更新します。"
            rangeDescription="APIの発売日範囲全体を分割"
            onRunAll={runAll}
            onStop={() => { stopRef.current = true; }}
          />
        </div>
        {activeRun?.run_type === "daily_incremental" && <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">旧方式の日次新作補完が進行中です。新規の日次新作補完は停止しています。旧ジョブを安全に終えるには、続きから再開してください。<button type="button" disabled={busyType !== null} onClick={() => void runAll("daily_incremental", activeRun)} className="ml-3 rounded-lg bg-amber-400 px-3 py-2 font-bold text-zinc-950 disabled:opacity-50">旧ジョブを再開</button></div>}
        {message && <p role="status" className="mt-4 rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-200">{message}</p>}
        <p className="mt-4 text-[11px] leading-5 text-zinc-500">週次の全作品補完を必要に応じて手動で開始します。自動時刻実行は設定しません。5,000件以内に分割できない範囲が見つかった場合は要確認で停止し、全件完了とは表示しません。</p>
      </div>

      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-cyan-300">FANZA AMATEUR WORKS</p>
            <h3 className="mt-1 text-xl font-black">作品別API情報</h3>
            <p className="mt-1 text-xs text-zinc-400">素人専用テーブル · {count(worksTotal)}作品 · 作品を開くとAPI返却JSON全体を表示</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={worksPage <= 1} onClick={() => void refreshWorks(worksPage - 1)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">前へ</button>
            <span className="text-xs text-zinc-400">{worksPage} / {Math.max(1, Math.ceil(worksTotal / 20))}</span>
            <button type="button" disabled={worksPage * 20 >= worksTotal} onClick={() => void refreshWorks(worksPage + 1)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">次へ</button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-300"><tr><th className="px-3 py-3">content_id</th><th className="px-3 py-3">title</th><th className="px-3 py-3">date</th><th className="px-3 py-3">rank</th><th className="px-3 py-3">全APIキー</th><th className="px-3 py-3">MP4補完</th><th className="px-3 py-3">掲載状態</th></tr></thead>
            <tbody className="divide-y divide-zinc-800">
              {works.map((work) => (
                <tr key={work.content_id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-cyan-200">{work.content_id}</td>
                  <td className="min-w-64 max-w-md px-3 py-3">{work.title ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{work.api_date ?? "—"}</td>
                  <td className="px-3 py-3" title={work.rank_observed_at ? `取得日時: ${new Date(work.rank_observed_at).toLocaleString("ja-JP")}` : undefined}>{work.rank ?? "—"}{work.rank_observed_at && <span className="ml-1 text-zinc-500">取得済</span>}</td>
                  <td className="min-w-56 px-3 py-3">
                    <details>
                      <summary className="cursor-pointer text-cyan-300">{count(Object.keys(work.raw_item ?? {}).length)}項目を開く</summary>
                      <pre className="mt-2 max-h-96 max-w-3xl overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black p-3 font-mono text-[11px] leading-5 text-zinc-200">{JSON.stringify(work.raw_item, null, 2)}</pre>
                    </details>
                    <p className="mt-2 text-[10px] text-zinc-500">取得: {dateTime(work.fetched_at)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <p>{work.mp4_status === "found" ? "取得済み" : work.mp4_status === "no_video" ? "動画なし（3回失敗）" : "未取得"}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">試行 {work.mp4_attempt_count}/3 · {dateTime(work.mp4_checked_at)}</p>
                    {work.mp4_url && <a className="mt-1 inline-block text-cyan-300 underline" href={work.mp4_url} target="_blank" rel="noreferrer">MP4を開く</a>}
                  </td>
                  <td className="px-3 py-3">{work.is_listed ? (work.missing_since ? "未掲載候補（再確認中）" : "掲載中") : "未掲載確認"}</td>
                </tr>
              ))}
              {works.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-500">まだ作品データはありません。週次全件補完を開始すると、作品ごとのAPI情報がここに表示されます。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
