"use client";

import { useEffect, useRef, useState } from "react";

type BijyoApiResponse = { error?: string; trim?: { ok?: boolean; error?: string; trimStartSeconds?: number }; [key: string]: unknown };

class BijyoApiError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

async function call(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/bijyo-reserved", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.text();
  let data: BijyoApiResponse = {};
  try { data = JSON.parse(body) as BijyoApiResponse; } catch { /* proxy errors may be plain text */ }
  if (!response.ok || data.error) throw new BijyoApiError(response.status === 401 ? "管理画面の認証が切れています。ページを再読み込みしてから再試行してください。" : data.error ?? "処理に失敗しました。", typeof data.code === "string" ? data.code : undefined);
  return data;
}

function openExternal(url: string) { window.open(url, "_blank", "noopener,noreferrer"); }

export function BijyoReservedActions({ jobId, workId, mainText, replyText, status, trimStatus = "not_ready", sampleMovieUrl, trimStartSeconds, manualLabel = "手動追加投稿", allowWorkSkip = false, allowWorkManualAdd = true }: { jobId?: number; workId?: number; mainText?: string; replyText?: string; status?: string; trimStatus?: string; sampleMovieUrl?: string; trimStartSeconds?: number; manualLabel?: string; allowWorkSkip?: boolean; allowWorkManualAdd?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionBlocked, setActionBlocked] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [trimSeconds, setTrimSeconds] = useState(Number(trimStartSeconds ?? 0));
  const [trimMode, setTrimMode] = useState<"manual" | "resetAuto">("manual");
  const [preparedVideoUrl, setPreparedVideoUrl] = useState<string | null>(null);
  const [currentTrimStatus, setCurrentTrimStatus] = useState(trimStatus);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (preparedVideoUrl) URL.revokeObjectURL(preparedVideoUrl); }, [preparedVideoUrl]);
  async function run(action: string) {
    setBusy(true); setMessage("");
    try { await call({ action, jobId, workId }); setMessage(action === "posted" ? "投稿済みにしました。" : action === "skip" ? "スキップして候補を補充しました。" : action === "exclude" ? "今後の候補から外しました。" : "手動追加しました。動画はまだ取得していません。"); if (["posted", "skip", "exclude", "manual"].includes(action)) window.location.reload(); }
    catch (error) { if (error instanceof BijyoApiError && error.code === "already_selected") setActionBlocked(true); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setMessage(`${label}をコピーしました。`); } catch { setMessage("コピーできませんでした。表示された文面を選択してください。"); } }
  async function saveTrim() {
    if (!jobId) return;
    setBusy(true); setMessage("");
    try {
      const result = await call({ action: "manualTrim", jobId, workId, mode: trimMode, trimStartSeconds: trimSeconds });
      setMessage(`trim ${Number(result.trim?.trimStartSeconds ?? trimSeconds).toFixed(1)}秒で再生成しました。`);
      setTrimOpen(false);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function prepareVideo() {
    if (!jobId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/bijyo-reserved", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepareVideo", jobId, workId }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(response.status === 401 ? "管理画面の認証が切れています。ページを再読み込みしてから再試行してください。" : body.error ?? "動画準備に失敗しました。");
      }
      const blob = await response.blob();
      if (!blob.type.includes("video")) throw new Error("動画ではない応答を受け取りました。画面を更新してから再試行してください。");
      const nextUrl = URL.createObjectURL(blob);
      setPreparedVideoUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      setCurrentTrimStatus("ready");
      setMessage("動画準備が完了しました。下のpreviewで確認できます。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCurrentTrimStatus(errorMessage.includes("すでに実行中") ? "preparing" : "trim_failed");
      setMessage(errorMessage);
    } finally { setBusy(false); }
  }
  function setCurrentTime() { setTrimSeconds(Number((videoRef.current?.currentTime ?? 0).toFixed(1))); setTrimMode("manual"); }
  function openTrim() { setTrimMode("manual"); setTrimOpen(true); }
  return <div className="flex flex-wrap gap-2">
    {jobId && <>
      <button disabled={busy || currentTrimStatus === "preparing"} onClick={prepareVideo} className="rounded bg-emerald-400 px-3 py-2 text-xs font-black text-black">{busy ? "動画準備中…" : currentTrimStatus === "ready" ? "動画を再準備" : currentTrimStatus === "trim_failed" ? "動画準備を再試行" : "動画準備"}</button>
      <button disabled={busy} onClick={openTrim} className="rounded bg-orange-400 px-3 py-2 text-xs font-black text-black">手動トリム</button>
      {preparedVideoUrl && <video controls playsInline preload="metadata" className="basis-full max-h-80 rounded-lg bg-black" src={preparedVideoUrl}><track kind="captions" /></video>}
      <span className="self-center text-xs text-zinc-400">{currentTrimStatus === "ready" ? "動画準備済み" : currentTrimStatus === "preparing" ? "動画準備中" : currentTrimStatus === "trim_failed" ? "動画準備失敗" : "動画未準備"}</span>
      {sampleMovieUrl && <button disabled={busy} onClick={() => openExternal(sampleMovieUrl)} className="rounded border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-200">元動画preview</button>}
      <button disabled={busy} onClick={() => copy(mainText ?? "", "本文")} className="rounded border border-cyan-700 px-3 py-2 text-xs font-bold text-cyan-200">本文をコピー</button>
      <button disabled={busy} onClick={() => { const text = encodeURIComponent(mainText ?? ""); openExternal(`https://x.com/compose/post?text=${text}`); }} className="rounded border border-sky-700 px-3 py-2 text-xs font-bold text-sky-200">X投稿画面を開く</button>
      <button disabled={busy} onClick={() => copy(replyText ?? "", "自己リプ")} className="rounded border border-violet-700 px-3 py-2 text-xs font-bold text-violet-200">自己リプをコピー</button>
      <button disabled={busy || !["pending", "trim_failed"].includes(status ?? "")} onClick={() => run("posted")} className="rounded bg-cyan-500 px-3 py-2 text-xs font-black text-black">投稿済みにする</button>
      <button disabled={busy || status !== "pending"} onClick={() => run("skip")} className="rounded border border-amber-700 px-3 py-2 text-xs font-bold text-amber-200">スキップ</button>
      <button disabled={busy || ["posted", "manual_posted"].includes(status ?? "")} onClick={() => run("exclude")} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">自動対象から外す</button>
      {trimOpen && <div className="basis-full rounded-xl border border-orange-700 bg-zinc-950 p-4">
        <p className="font-black text-orange-200">手動トリム位置を指定</p>
        <video ref={videoRef} controls preload="metadata" className="mt-3 max-h-72 w-full rounded-lg bg-black" src={sampleMovieUrl} onTimeUpdate={(event) => setTrimSeconds(Number(event.currentTarget.currentTime.toFixed(1)))}><track kind="captions" /></video>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-300">開始秒<input type="number" min="0" step="0.1" value={trimSeconds} onChange={(event) => { setTrimSeconds(Number(event.target.value)); setTrimMode("manual"); }} className="mt-1 block w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-white" /></label>
          <button disabled={busy} onClick={setCurrentTime} className="rounded border border-orange-700 px-3 py-2 text-xs font-bold text-orange-200">現在位置を開始点にする</button>
          <button disabled={busy} onClick={() => { setTrimSeconds(0); setTrimMode("manual"); }} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">0秒に戻す</button>
          <button disabled={busy} onClick={() => setTrimMode("resetAuto")} className={`rounded border px-3 py-2 text-xs font-bold ${trimMode === "resetAuto" ? "border-cyan-400 text-cyan-200" : "border-cyan-800 text-cyan-300"}`}>自動値に戻す</button>
          <button disabled={busy} onClick={saveTrim} className="rounded bg-orange-400 px-3 py-2 text-xs font-black text-black">{busy ? "保存・生成中…" : "保存して再生成"}</button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">現在位置: {trimSeconds.toFixed(1)}秒 / 「自動値に戻す」は自動解析を再実行します。</p>
      </div>}
    </>}
    {workId && allowWorkManualAdd && <button disabled={busy || actionBlocked} onClick={() => run("manual")} className="rounded bg-violet-500 px-3 py-2 text-xs font-black text-white">{actionBlocked ? "追加済み" : manualLabel}</button>}
    {workId && !allowWorkManualAdd && <span className="self-center text-xs text-zinc-500">手動追加対象外</span>}
    {allowWorkSkip && workId && <button disabled={busy || actionBlocked} onClick={() => run("skip")} className="rounded border border-amber-700 px-3 py-2 text-xs font-bold text-amber-200">スキップ</button>}
    {message && <p className="w-full whitespace-pre-wrap text-xs text-amber-200">{message}</p>}
  </div>;
}
