"use client";

import { useState, useTransition } from "react";
import { ensureXGrowthMediaPreviewUrl } from "@/lib/xGrowthMediaPreview";
import { postJson } from "./xGrowthActionRequest";

function TrimPreview({
  previewRequested,
  previewSourceUrl,
  onLoadedMetadata,
  onError,
  onTimeUpdate,
  onRequestPreview,
}: {
  previewRequested: boolean;
  previewSourceUrl: string;
  onLoadedMetadata: (video: HTMLVideoElement) => void;
  onError: () => void;
  onTimeUpdate: (time: number) => void;
  onRequestPreview: () => void;
}) {
  return (
    <div className="mx-auto w-full min-w-0 rounded-lg bg-black">
      {previewRequested ? (
        <video
          src={previewSourceUrl}
          controls
          preload="metadata"
          playsInline
          onLoadedMetadata={(event) => onLoadedMetadata(event.currentTarget)}
          onError={onError}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          className="block aspect-video h-auto w-full min-w-0 object-contain"
        />
      ) : (
        <button type="button" onClick={onRequestPreview} className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-center hover:border-cyan-700">
          <span className="text-sm font-black text-cyan-100">動画を読み込んでプレビュー</span>
          <span className="text-xs text-zinc-500">押すと公式サンプル動画を取得します</span>
        </button>
      )}
    </div>
  );
}

function TrimStatus({
  currentTime,
  duration,
  previewRequested,
  mediaError,
  savedSeconds,
  dirty,
  trimAllowed,
  canModify,
  modifyConfirmed,
}: {
  currentTime: number;
  duration: number;
  previewRequested: boolean;
  mediaError: boolean;
  savedSeconds: number;
  dirty: boolean;
  trimAllowed: boolean;
  canModify?: boolean | null;
  modifyConfirmed: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-cyan-100">
      <span>現在 {currentTime.toFixed(1)}秒</span>
      <span>動画長 {duration > 0 ? `${duration.toFixed(1)}秒` : previewRequested ? "未取得" : "未読み込み"}</span>
      {mediaError && <span className="text-rose-200">動画を読み込めません</span>}
      <span>保存済み {savedSeconds.toFixed(1)}秒</span>
      {dirty && <span className="text-amber-200">未保存</span>}
      {savedSeconds > 0 && <span className="text-emerald-200">冒頭トリム: {savedSeconds.toFixed(1)}秒</span>}
      {!trimAllowed && savedSeconds > 0 && !canModify && !modifyConfirmed && <span className="text-rose-200">冒頭カット許可未確認のためトリム投稿不可</span>}
      {!trimAllowed && <span className={modifyConfirmed ? "text-emerald-200" : "text-amber-200"}>{modifyConfirmed ? "冒頭カット許可確認済み" : "冒頭カット許可未確認"}</span>}
    </div>
  );
}

export function XVideoTrimControls({
  assetId,
  sourceUrl,
  initialTrimStartSeconds,
  initialTrimNote,
  canModify,
  trimModifyConfirmed,
  trimAllowed = false,
  compact = false,
  onSaved,
}: {
  assetId: number;
  sourceUrl: string;
  initialTrimStartSeconds?: number | null;
  initialTrimNote?: string | null;
  canModify?: boolean | null;
  trimModifyConfirmed?: boolean | null;
  trimAllowed?: boolean;
  compact?: boolean;
  onSaved?: (value: { trimStartSeconds: number; trimModifyConfirmed: boolean; trimNote: string }) => void;
}) {
  const [seconds, setSeconds] = useState(Number(initialTrimStartSeconds ?? 0).toFixed(1));
  const [savedSeconds, setSavedSeconds] = useState(Number(initialTrimStartSeconds ?? 0));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [playOnLoad, setPlayOnLoad] = useState(false);
  const [note, setNote] = useState(initialTrimNote ?? "");
  const [modifyConfirmed, setModifyConfirmed] = useState(Boolean(trimModifyConfirmed));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const numericSeconds = Number(seconds);
  const previewSourceUrl = ensureXGrowthMediaPreviewUrl(sourceUrl);
  const dirty = Number.isFinite(numericSeconds) && Math.round(numericSeconds * 10) / 10 !== savedSeconds;
  const handleLoadedMetadata = (video: HTMLVideoElement) => {
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setMediaError(false);
    if (playOnLoad) {
      video.currentTime = Number(seconds) || 0;
      void video.play().catch(() => undefined);
      setPlayOnLoad(false);
    }
  };
  const save = () => startTransition(async () => {
    setMessage("");
    try {
      const rounded = Math.round(Number(seconds) * 10) / 10;
      if (!Number.isFinite(rounded) || rounded < 0) throw new Error("開始秒が不正です。");
      const defaultNote = "User confirmed trimming only the leading black/title-card segment of FANZA/DMM official sample videos is permitted for X affiliate use.";
      const result = await postJson("/api/admin/x-growth/media/trim", {
        id: assetId,
        trimStartSeconds: rounded,
        trimNote: note.trim() || defaultNote,
        trimModifyConfirmed: modifyConfirmed,
      });
      const saved = Number(result.trimStartSeconds ?? rounded);
      setSeconds(saved.toFixed(1));
      setSavedSeconds(saved);
      const savedNote = note.trim() || defaultNote;
      if (!note.trim()) setNote(defaultNote);
      onSaved?.({ trimStartSeconds: saved, trimModifyConfirmed: modifyConfirmed, trimNote: savedNote });
      setMessage("開始位置を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  });
  return (
    <div className="mt-3 grid min-w-0 gap-2 rounded-lg border border-cyan-900 bg-cyan-950/10 p-3">
      {compact && <p className="text-xs font-black text-cyan-100">動画の最終調整</p>}
      <TrimPreview
        previewRequested={previewRequested}
        previewSourceUrl={previewSourceUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setMediaError(true)}
        onTimeUpdate={setCurrentTime}
        onRequestPreview={() => setPreviewRequested(true)}
      />
      <TrimStatus
        currentTime={currentTime}
        duration={duration}
        previewRequested={previewRequested}
        mediaError={mediaError}
        savedSeconds={savedSeconds}
        dirty={dirty}
        trimAllowed={trimAllowed}
        canModify={canModify}
        modifyConfirmed={modifyConfirmed}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          suppressHydrationWarning
          type="number"
          min="0"
          step="0.1"
          value={seconds}
          onChange={(event) => setSeconds(event.target.value)}
          className="h-9 min-w-0 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100"
        />
        <button type="button" onClick={() => setSeconds((Math.round(currentTime * 10) / 10).toFixed(1))} className="min-h-9 rounded-lg bg-cyan-400 px-3 py-2 text-center text-[11px] font-black leading-4 text-black">現在位置を開始点にする</button>
        <button type="button" onClick={() => setSeconds("0.0")} className="min-h-9 rounded-lg border border-zinc-700 px-3 py-2 text-center text-[11px] font-black leading-4 text-zinc-100">0秒に戻す</button>
        <button type="button" disabled={pending} onClick={save} className="min-h-9 rounded-lg bg-emerald-500 px-3 py-2 text-center text-[11px] font-black leading-4 text-black disabled:opacity-50">開始位置を保存</button>
      </div>
      {!compact && <textarea suppressHydrationWarning value={note} onChange={(event) => setNote(event.target.value)} placeholder="トリムメモ" className="h-16 resize-none rounded-lg border border-zinc-700 bg-black p-2 text-xs text-zinc-100" />}
      {!trimAllowed && <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={modifyConfirmed}
          onChange={(event) => setModifyConfirmed(event.target.checked)}
          className="h-4 w-4 accent-emerald-400"
        />
        冒頭カット許可確認済み
      </label>}
      <button
        type="button"
        onClick={(event) => {
          const video = event.currentTarget.parentElement?.querySelector("video");
          if (video) {
            video.currentTime = Number(seconds) || 0;
            void video.play().catch(() => undefined);
          } else {
            setPlayOnLoad(true);
            setPreviewRequested(true);
          }
        }}
        className="h-9 w-fit rounded-lg border border-cyan-700 px-3 text-xs font-black text-cyan-100"
      >
        {previewRequested ? "この位置から確認" : "動画を読み込んでこの位置から確認"}
      </button>
      {message && <p className="text-[11px] font-bold text-emerald-200">{message}</p>}
    </div>
  );
}

export function TrimReviewActions(props: Parameters<typeof XVideoTrimControls>[0]) {
  return <XVideoTrimControls {...props} />;
}

