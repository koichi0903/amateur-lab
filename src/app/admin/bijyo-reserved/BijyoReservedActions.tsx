"use client";

import { useEffect, useRef, useState } from "react";
import { runBijyoReservedAction, type BijyoReservedAction } from "@/lib/bijyoReservedActionHelpers";

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

type BijyoTrimMode = "manual" | "resetAuto";

function JobVideoControls({
  busy,
  currentTrimStatus,
  sampleMovieUrl,
  preparedVideoUrl,
  onPrepareVideo,
  onSavePreparedVideo,
  onOpenTrim,
}: {
  busy: boolean;
  currentTrimStatus: string;
  sampleMovieUrl?: string;
  preparedVideoUrl: string | null;
  onPrepareVideo: () => void;
  onSavePreparedVideo: () => void;
  onOpenTrim: () => void;
}) {
  return <>
    <button disabled={busy || currentTrimStatus === "preparing"} onClick={onPrepareVideo} className="rounded bg-emerald-400 px-3 py-2 text-xs font-black text-black">{busy ? "動画準備中…" : currentTrimStatus === "ready" ? "動画を再準備" : currentTrimStatus === "trim_failed" ? "動画準備を再試行" : "動画準備"}</button>
    {currentTrimStatus === "ready" && <button disabled={busy} onClick={onSavePreparedVideo} className="rounded border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-200">トリム済み動画を保存</button>}
    <button disabled={busy} onClick={onOpenTrim} className="rounded bg-orange-400 px-3 py-2 text-xs font-black text-black">手動トリム</button>
    {preparedVideoUrl && <video controls playsInline preload="metadata" className="basis-full max-h-80 rounded-lg bg-black" src={preparedVideoUrl}><track kind="captions" /></video>}
    <span className="self-center text-xs text-zinc-400">{currentTrimStatus === "ready" ? "動画準備済み" : currentTrimStatus === "preparing" ? "動画準備中" : currentTrimStatus === "trim_failed" ? "動画準備失敗" : "動画未準備"}</span>
    {sampleMovieUrl && <button disabled={busy} onClick={() => openExternal(sampleMovieUrl)} className="rounded border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-200">元動画preview</button>}
  </>;
}

function JobPostControls({
  busy,
  status,
  mainText,
  replyText,
  onCopy,
  onMarkPosted,
  onSkip,
  onExclude,
}: {
  busy: boolean;
  status?: string;
  mainText?: string;
  replyText?: string;
  onCopy: (value: string, label: string) => void;
  onMarkPosted: () => void;
  onSkip: () => void;
  onExclude: () => void;
}) {
  return <>
    <button disabled={busy} onClick={() => onCopy(mainText ?? "", "本文")} className="rounded border border-cyan-700 px-3 py-2 text-xs font-bold text-cyan-200">本文をコピー</button>
    <button disabled={busy} onClick={() => openExternal(`https://x.com/compose/post?text=${encodeURIComponent(mainText ?? "")}`)} className="rounded border border-sky-700 px-3 py-2 text-xs font-bold text-sky-200">X投稿画面を開く</button>
    <button disabled={busy} onClick={() => onCopy(replyText ?? "", "自己リプ")} className="rounded border border-violet-700 px-3 py-2 text-xs font-bold text-violet-200">自己リプをコピー</button>
    <button disabled={busy || !["pending", "trim_failed"].includes(status ?? "")} onClick={onMarkPosted} className="rounded bg-cyan-500 px-3 py-2 text-xs font-black text-black">投稿済みにする</button>
    <button disabled={busy || status !== "pending"} onClick={onSkip} className="rounded border border-amber-700 px-3 py-2 text-xs font-bold text-amber-200">スキップ</button>
    <button disabled={busy || ["posted", "manual_posted"].includes(status ?? "")} onClick={onExclude} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">自動対象から外す</button>
  </>;
}

function ManualTrimEditor({
  trimOpen,
  busy,
  sampleMovieUrl,
  trimSeconds,
  trimMode,
  videoRef,
  onTrimSecondsChange,
  onTrimModeChange,
  onSetCurrentTime,
  onResetTrim,
  onSaveTrim,
}: {
  trimOpen: boolean;
  busy: boolean;
  sampleMovieUrl?: string;
  trimSeconds: number;
  trimMode: BijyoTrimMode;
  videoRef: { current: HTMLVideoElement | null };
  onTrimSecondsChange: (seconds: number) => void;
  onTrimModeChange: (mode: BijyoTrimMode) => void;
  onSetCurrentTime: () => void;
  onResetTrim: () => void;
  onSaveTrim: () => void;
}) {
  if (!trimOpen) return null;
  return <div className="basis-full rounded-xl border border-orange-700 bg-zinc-950 p-4">
    <p className="font-black text-orange-200">手動トリム位置を指定</p>
    <video ref={videoRef} controls preload="metadata" className="mt-3 max-h-72 w-full rounded-lg bg-black" src={sampleMovieUrl} onTimeUpdate={(event) => onTrimSecondsChange(Number(event.currentTarget.currentTime.toFixed(1)))}><track kind="captions" /></video>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs text-zinc-300">開始秒<input type="number" min="0" step="0.1" value={trimSeconds} onChange={(event) => onTrimSecondsChange(Number(event.target.value))} className="mt-1 block w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-white" /></label>
      <button disabled={busy} onClick={onSetCurrentTime} className="rounded border border-orange-700 px-3 py-2 text-xs font-bold text-orange-200">現在位置を開始点にする</button>
      <button disabled={busy} onClick={onResetTrim} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">0秒に戻す</button>
      <button disabled={busy} onClick={() => onTrimModeChange("resetAuto")} className={`rounded border px-3 py-2 text-xs font-bold ${trimMode === "resetAuto" ? "border-cyan-400 text-cyan-200" : "border-cyan-800 text-cyan-300"}`}>自動値に戻す</button>
      <button disabled={busy} onClick={onSaveTrim} className="rounded bg-orange-400 px-3 py-2 text-xs font-black text-black">{busy ? "保存・生成中…" : "保存して再生成"}</button>
    </div>
    <p className="mt-2 text-xs text-zinc-500">現在位置: {trimSeconds.toFixed(1)}秒 / 「自動値に戻す」は自動解析を再実行します。</p>
  </div>;
}

type BijyoReservedActionViewProps = {
  jobId?: number;
  workId?: number;
  mainText?: string;
  replyText?: string;
  status?: string;
  sampleMovieUrl?: string;
  manualLabel: string;
  allowWorkSkip: boolean;
  allowWorkManualAdd: boolean;
  busy: boolean;
  message: string;
  actionBlocked: boolean;
  trimOpen: boolean;
  trimSeconds: number;
  trimMode: BijyoTrimMode;
  currentTrimStatus: string;
  preparedVideoUrl: string | null;
  videoRef: { current: HTMLVideoElement | null };
  onRun: (action: BijyoReservedAction) => void;
  onCopy: (value: string, label: string) => void;
  onPrepareVideo: () => void;
  onSavePreparedVideo: () => void;
  onOpenTrim: () => void;
  onTrimSecondsChange: (seconds: number) => void;
  onTrimModeChange: (mode: BijyoTrimMode) => void;
  onSetCurrentTime: () => void;
  onResetTrim: () => void;
  onSaveTrim: () => void;
};

function BijyoReservedActionView({
  jobId,
  workId,
  mainText,
  replyText,
  status,
  sampleMovieUrl,
  manualLabel,
  allowWorkSkip,
  allowWorkManualAdd,
  busy,
  message,
  actionBlocked,
  trimOpen,
  trimSeconds,
  trimMode,
  currentTrimStatus,
  preparedVideoUrl,
  videoRef,
  onRun,
  onCopy,
  onPrepareVideo,
  onSavePreparedVideo,
  onOpenTrim,
  onTrimSecondsChange,
  onTrimModeChange,
  onSetCurrentTime,
  onResetTrim,
  onSaveTrim,
}: BijyoReservedActionViewProps) {
  return <div className="flex flex-wrap gap-2">
    {jobId && <>
      <JobVideoControls busy={busy} currentTrimStatus={currentTrimStatus} sampleMovieUrl={sampleMovieUrl} preparedVideoUrl={preparedVideoUrl} onPrepareVideo={onPrepareVideo} onSavePreparedVideo={onSavePreparedVideo} onOpenTrim={onOpenTrim} />
      <JobPostControls busy={busy} status={status} mainText={mainText} replyText={replyText} onCopy={onCopy} onMarkPosted={() => onRun("posted")} onSkip={() => onRun("skip")} onExclude={() => onRun("exclude")} />
      <ManualTrimEditor trimOpen={trimOpen} busy={busy} sampleMovieUrl={sampleMovieUrl} trimSeconds={trimSeconds} trimMode={trimMode} videoRef={videoRef} onTrimSecondsChange={onTrimSecondsChange} onTrimModeChange={onTrimModeChange} onSetCurrentTime={onSetCurrentTime} onResetTrim={onResetTrim} onSaveTrim={onSaveTrim} />
    </>}
    {workId && allowWorkManualAdd && <button disabled={busy || actionBlocked} onClick={() => onRun("manual")} className="rounded bg-violet-500 px-3 py-2 text-xs font-black text-white">{actionBlocked ? "追加済み" : manualLabel}</button>}
    {workId && !allowWorkManualAdd && <span className="self-center text-xs text-zinc-500">手動追加対象外</span>}
    {allowWorkSkip && workId && <button disabled={busy || actionBlocked} onClick={() => onRun("skip")} className="rounded border border-amber-700 px-3 py-2 text-xs font-bold text-amber-200">スキップ</button>}
    {message && <p className="w-full whitespace-pre-wrap text-xs text-amber-200">{message}</p>}
  </div>;
}

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
  function run(action: BijyoReservedAction) {
    void runBijyoReservedAction({
      action,
      promptXPostUrl: () => window.prompt("投稿済みのX投稿URLを貼り付けてください。"),
      request: (requestedAction, xPostUrl) => call({ action: requestedAction, jobId, workId, ...(xPostUrl ? { xPostUrl } : {}) }),
      setBusy,
      setMessage,
      setActionBlocked,
      isAlreadySelected: (error) => error instanceof BijyoApiError && error.code === "already_selected",
      reload: () => window.location.reload(),
    });
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
  async function savePreparedVideo() {
    if (!jobId || !workId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/bijyo-reserved/save", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, workId }) });
      const result = await response.json().catch(() => ({})) as { error?: string; path?: string };
      if (!response.ok) throw new Error(result.error ?? "トリム済み動画を保存できませんでした。");
      setMessage(`保存しました: ${result.path ?? `Desktop\\Bijyo一時動画\\bijyo_${workId}.mp4`}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  function setCurrentTime() { setTrimSeconds(Number((videoRef.current?.currentTime ?? 0).toFixed(1))); setTrimMode("manual"); }
  function openTrim() { setTrimMode("manual"); setTrimOpen(true); }
  return <BijyoReservedActionView
    jobId={jobId}
    workId={workId}
    mainText={mainText}
    replyText={replyText}
    status={status}
    sampleMovieUrl={sampleMovieUrl}
    manualLabel={manualLabel}
    allowWorkSkip={allowWorkSkip}
    allowWorkManualAdd={allowWorkManualAdd}
    busy={busy}
    message={message}
    actionBlocked={actionBlocked}
    trimOpen={trimOpen}
    trimSeconds={trimSeconds}
    trimMode={trimMode}
    currentTrimStatus={currentTrimStatus}
    preparedVideoUrl={preparedVideoUrl}
    videoRef={videoRef}
    onRun={run}
    onCopy={copy}
    onPrepareVideo={prepareVideo}
    onSavePreparedVideo={savePreparedVideo}
    onOpenTrim={openTrim}
    onTrimSecondsChange={(seconds) => { setTrimSeconds(seconds); setTrimMode("manual"); }}
    onTrimModeChange={setTrimMode}
    onSetCurrentTime={setCurrentTime}
    onResetTrim={() => { setTrimSeconds(0); setTrimMode("manual"); }}
    onSaveTrim={saveTrim}
  />;
}
