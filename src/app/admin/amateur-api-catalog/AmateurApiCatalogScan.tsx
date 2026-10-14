"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScanRun = {
  id: string;
  status: "running" | "completed" | "limit_reached";
  source_sort: "date";
  total_count: number | null;
  next_offset: number;
  fetched_item_count: number;
  observed_item_key_paths: string[];
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};

type ScanResponse = { run: ScanRun | null; processedItemCount: number; error?: string };

function count(value: number) {
  return value.toLocaleString("ja-JP");
}

export default function AmateurApiCatalogScan() {
  const [run, setRun] = useState<ScanRun | null>(null);
  const [processedItemCount, setProcessedItemCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stopRef = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-amateur-api-catalog", { cache: "no-store" });
    const data = await response.json() as ScanResponse;
    if (!response.ok) throw new Error(data.error || "取得状況を読み込めませんでした。");
    setRun(data.run);
    setProcessedItemCount(data.processedItemCount);
    return data.run;
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "取得状況を読み込めませんでした。"));
  }, [refresh]);

  async function request(action: "start" | "continue", runId?: string) {
    const response = await fetch("/api/admin/fanza-amateur-api-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(runId ? { runId } : {}) }),
    });
    const data = await response.json() as ScanResponse;
    if (!response.ok) throw new Error(data.error || "取得を進められませんでした。");
    setRun(data.run);
    setProcessedItemCount(data.processedItemCount);
    return data;
  }

  async function runAll() {
    setBusy(true);
    stopRef.current = false;
    setMessage("準備中…");
    try {
      let next = await request("start");
      while (next.run?.status === "running" && !stopRef.current) {
        const batch = await request("continue", next.run.id);
        next = batch;
        setMessage(next.run?.status === "completed" ? "API掲載作品の取得が完了しました。" : next.run?.status === "limit_reached" ? "APIの取得上限まで処理しました。上限より先に作品があるかは確認できません。" : `取得中：${count(batch.processedItemCount)}件のAPI作品レコードを処理済み`);
        if (next.run?.status === "running") await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (stopRef.current && next.run?.status === "running") setMessage("一時停止しました。再開ボタンから続けられます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取得に失敗しました。");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!run) return;
    setBusy(true);
    stopRef.current = false;
    setMessage("取得を再開しました。");
    try {
      let next: ScanResponse = { run, processedItemCount };
      while (next.run?.status === "running" && !stopRef.current) {
        next = await request("continue", next.run.id);
        setMessage(next.run?.status === "completed" ? "API掲載作品の取得が完了しました。" : next.run?.status === "limit_reached" ? "APIの取得上限まで処理しました。上限より先に作品があるかは確認できません。" : `取得中：${count(next.processedItemCount)}件のAPI作品レコードを処理済み`);
        if (next.run?.status === "running") await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (stopRef.current && next.run?.status === "running") setMessage("一時停止しました。再開ボタンから続けられます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取得に失敗しました。");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const total = run?.total_count ?? 0;
  const progress = total > 0 ? Math.min(100, Math.floor((processedItemCount / total) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-emerald-900 bg-zinc-900 p-6">
      <p className="text-xs font-black tracking-[0.16em] text-emerald-300">DMM ITEM API / FULL CATALOG</p>
      <h2 className="mt-2 text-2xl font-black">素人作品のAPI情報を全件取得</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
        人気順位づけとは分けて、発売日順でAPI掲載作品をページ単位に読み込み、作品ごとの生JSONをSupabaseへ保存します。定期実行はせず、この管理画面から手動で開始・再開します。
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-950 p-4"><p className="text-xs text-zinc-400">API処理済みレコード</p><strong className="mt-1 block text-xl">{count(processedItemCount)}</strong></div>
        <div className="rounded-xl bg-zinc-950 p-4"><p className="text-xs text-zinc-400">API掲載件数</p><strong className="mt-1 block text-xl">{run?.total_count == null ? "未取得" : count(run.total_count)}</strong></div>
        <div className="rounded-xl bg-zinc-950 p-4"><p className="text-xs text-zinc-400">取得カーソル</p><strong className="mt-1 block text-xl">{run ? count(Math.min(run.next_offset - 1, 50_000)) : "未開始"}</strong></div>
      </div>
      {run && run.observed_item_key_paths.length > 0 && (
        <details className="mt-4 rounded-xl bg-zinc-950 p-4">
          <summary className="cursor-pointer text-sm font-bold">この取得で確認した作品APIキー（{count(run.observed_item_key_paths.length)}種類）</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-zinc-300 sm:grid-cols-2">
            {run.observed_item_key_paths.map((path) => <li key={path}>{path}</li>)}
          </ul>
        </details>
      )}

      {run && <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-700"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>}
      {run?.total_count != null && run.total_count >= 50_000 && <p className="mt-3 text-xs leading-5 text-amber-300">APIの取得上限50,000件に達する可能性があります。上限まで処理しても、それより先に作品があるかはこの取得だけでは判定できません。</p>}
      {run?.last_error && <p className="mt-3 text-sm text-rose-300">前回エラー：{run.last_error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-zinc-200">{message}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        {!run && <button type="button" disabled={busy} onClick={() => void runAll()} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">全件取得を開始</button>}
        {run?.status === "running" && !busy && <button type="button" onClick={() => void resume()} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-zinc-950">続きから取得</button>}
        {run?.status === "running" && busy && <button type="button" onClick={() => { stopRef.current = true; }} className="rounded-xl border border-zinc-600 px-5 py-3 text-sm font-bold">一時停止</button>}
        {run?.status === "completed" && <span className="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-bold text-emerald-300">取得完了 · {count(processedItemCount)}件のAPIレコード</span>}
        {run?.status === "limit_reached" && <span className="rounded-xl bg-amber-950 px-5 py-3 text-sm font-bold text-amber-200">API上限到達 · {count(processedItemCount)}件まで</span>}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">1ページ100件ずつ取得します。停止後も進捗と生データを保持します。各作品のAPI項目はJSONそのまま保存し、ランキング順位はこの取得順から作りません。</p>
    </section>
  );
}
