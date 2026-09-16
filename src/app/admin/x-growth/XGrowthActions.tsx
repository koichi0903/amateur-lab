"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { shouldShowTopPickTrimControls, trimPostButtonLabel } from "@/lib/xGrowthTrimUi";

type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemHandlePermissionDescriptor = { mode?: FileSystemPermissionMode };
type FileSystemPermissionState = "granted" | "denied" | "prompt";
type FileSystemWritableFileStream = WritableStream<Uint8Array> & {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
};
type FileSystemFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
};
type FileSystemDirectoryHandle = {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { id?: string; mode?: FileSystemPermissionMode; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
  }
}

const TEMP_DIR_DB = "x-growth-temp-folder-v1";
const TEMP_DIR_STORE = "handles";
const TEMP_DIR_KEY = "x-post-temp-folder";
const TEMP_TTL_MS = 24 * 60 * 60 * 1000;
const MANUAL_TAGS = [
  ["first_seconds_strong", "冒頭が強い"],
  ["visual_mismatch", "ジャケとの差"],
  ["actress_fit", "女優×作品相性"],
  ["scene_surprise", "展開の意外性"],
  ["safe_preview", "安全な試聴"],
  ["too_explicit_for_reach", "REACH不向き"],
  ["weak_visual", "映像が弱い"],
] as const;

type XGrowthMediaType = "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";

type TrimControlAsset = {
  id: number;
  can_modify?: boolean | null;
  trim_modify_confirmed?: boolean | null;
  trim_start_seconds?: number | null;
  trim_note?: string | null;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  return data as Record<string, unknown>;
}

function fileSystemSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
}

function openTempDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(TEMP_DIR_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TEMP_DIR_STORE);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function loadDirectoryHandle() {
  const db = await openTempDb();
  return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(TEMP_DIR_STORE, "readonly");
    const request = tx.objectStore(TEMP_DIR_STORE).get(TEMP_DIR_KEY);
    request.onerror = () => reject(request.error ?? new Error("一時フォルダ情報を読めませんでした。"));
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
    tx.oncomplete = () => db.close();
  });
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  const db = await openTempDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TEMP_DIR_STORE, "readwrite");
    tx.objectStore(TEMP_DIR_STORE).put(handle, TEMP_DIR_KEY);
    tx.onerror = () => reject(tx.error ?? new Error("一時フォルダ情報を保存できませんでした。"));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function ensurePermission(handle: FileSystemDirectoryHandle) {
  const descriptor = { mode: "readwrite" as const };
  if ((await handle.queryPermission?.(descriptor)) === "granted") return true;
  return (await handle.requestPermission?.(descriptor)) === "granted";
}

function sanitizeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 48) || "work";
}

function buildTempFilename(input: { workId: number; intent?: string; pickOrder?: number; extension: string; trimStartSeconds?: number }) {
  const date = new Date().toISOString().slice(0, 10);
  const order = String(input.pickOrder ?? 1).padStart(2, "0");
  const intent = sanitizeFilePart(input.intent ?? "POST");
  const trim = input.trimStartSeconds && input.trimStartSeconds > 0 ? `_trim${input.trimStartSeconds.toFixed(1)}` : "";
  return `${date}_${order}_${intent}_${sanitizeFilePart(String(input.workId))}${trim}.${sanitizeFilePart(input.extension).toLowerCase()}`;
}

async function countOldTempFiles(handle: FileSystemDirectoryHandle) {
  const now = Date.now();
  let old = 0;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file") continue;
    const file = await entry.getFile();
    if (now - file.lastModified > TEMP_TTL_MS) old += 1;
  }
  return old;
}

async function cleanupOldTempFiles(handle: FileSystemDirectoryHandle) {
  const now = Date.now();
  let deleted = 0;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file") continue;
    const file = await entry.getFile();
    if (now - file.lastModified <= TEMP_TTL_MS) continue;
    await handle.removeEntry(entry.name);
    deleted += 1;
  }
  return deleted;
}

async function saveBlobOnce(handle: FileSystemDirectoryHandle, filename: string, blob: Blob) {
  try {
    const existing = await handle.getFileHandle(filename);
    const file = await existing.getFile();
    if (file.size === blob.size) return { filename, reused: true };
  } catch {
  }
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { filename, reused: false };
}

function fallbackDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function xGrowthMediaUrl(input: { workId: number; mediaType: XGrowthMediaType; mediaAssetId?: number | null }) {
  if (input.mediaType !== "sample_movie" && input.mediaType !== "existing_link_image" && input.mediaType !== "data_card") return null;
  return `/api/admin/x-growth/media/download?workId=${encodeURIComponent(String(input.workId))}&mediaType=${encodeURIComponent(input.mediaType)}${input.mediaAssetId ? `&assetId=${encodeURIComponent(String(input.mediaAssetId))}` : ""}`;
}

export function TempFolderStatus() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [oldCount, setOldCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const ok = fileSystemSupported();
    setSupported(ok);
    if (!ok) return;
    const handle = await loadDirectoryHandle().catch(() => null);
    if (!handle) {
      setConfigured(false);
      setOldCount(null);
      return;
    }
    const permitted = await ensurePermission(handle).catch(() => false);
    setConfigured(permitted);
    setOldCount(permitted ? await countOldTempFiles(handle).catch(() => null) : null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setup = async () => {
    setMessage("");
    try {
      if (!window.showDirectoryPicker) throw new Error("このブラウザは一時フォルダ設定に非対応です。");
      const handle = await window.showDirectoryPicker({ id: "x-post-temp-folder", mode: "readwrite" });
      await saveDirectoryHandle(handle);
      await refresh();
      setMessage("一時フォルダを設定しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "一時フォルダを設定できませんでした。");
    }
  };

  const cleanup = async () => {
    setMessage("");
    try {
      const handle = await loadDirectoryHandle();
      if (!handle || !(await ensurePermission(handle))) throw new Error("一時フォルダを再設定してください。");
      const deleted = await cleanupOldTempFiles(handle);
      await refresh();
      setMessage(`古い一時ファイルを${deleted}件削除しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除できませんでした。");
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-400">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black text-zinc-200">一時フォルダ: {configured ? "設定済み" : "未設定"}</span>
        <span>古いファイル: {oldCount ?? "-"}件</span>
        <button type="button" onClick={setup} className="h-7 rounded-lg border border-zinc-700 px-2 font-black text-zinc-100">{configured ? "再許可" : "一時フォルダを設定"}</button>
        <button type="button" onClick={cleanup} disabled={!configured} className="h-7 rounded-lg border border-amber-700 px-2 font-black text-amber-100 disabled:opacity-40">掃除</button>
      </div>
      <p className="mt-1 leading-5">
        {supported ? "X_USER_ACCESS_TOKENなしでも手動動画投稿は可能です。自動投稿/自動添付だけUser Access Tokenが必要です。" : "File System Access API非対応です。通常ダウンロードに戻るため、PC内に残る可能性があります。"}
      </p>
      {message && <p className="mt-1 font-bold text-emerald-200">{message}</p>}
    </div>
  );
}

export function OpportunityActions({ id, canNativeVideo }: { id: number | null; canNativeVideo: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (!id) return <p className="mt-3 text-[11px] font-bold text-amber-300">保存後に採用操作が使えます。</p>;
  const run = (action: "adopted" | "rejected" | "posted") => startTransition(async () => {
    setMessage("");
    try {
      const result = action === "posted"
        ? await postJson("/api/admin/x-growth/post", { id })
        : await postJson("/api/admin/x-growth/opportunities", { id, status: action, reason: "admin_x_growth" });
      setMessage(action === "posted" ? `投稿完了: ${String(result.xPostId)}` : "保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "失敗しました。");
    }
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={pending} onClick={() => run("adopted")} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50">採用</button>
      <button disabled={pending} onClick={() => run("posted")} className="h-9 rounded-lg bg-sky-600 px-3 text-xs font-black text-white disabled:opacity-50">
        {canNativeVideo ? "mp4投稿実行" : "投稿/記録実行"}
      </button>
      <button disabled={pending} onClick={() => run("rejected")} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-300 disabled:opacity-50">却下</button>
      {message && <p className="basis-full text-[11px] font-bold text-amber-200">{message}</p>}
    </div>
  );
}

export function ManualPostActions({
  postText,
  replyText,
  linkPlan = "none",
  affiliateUrl,
  mediaUrl,
  mediaType,
  quoteUrl,
  workId,
  mediaAssetId,
  candidateId,
  slotId,
  candidateRank,
  slotRole,
  title,
  intent,
  pickOrder,
  trimStartSeconds = 0,
  canModify = false,
}: {
  postText: string;
  replyText?: string | null;
  linkPlan?: "none" | "body" | "self_reply";
  affiliateUrl?: string | null;
  mediaUrl: string | null;
  mediaType: "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";
  quoteUrl?: string | null;
  workId: number;
  mediaAssetId?: number | null;
  candidateId?: string | null;
  slotId?: string | null;
  candidateRank?: string | null;
  slotRole?: string | null;
  title?: string;
  intent?: string;
  pickOrder?: number;
  trimStartSeconds?: number;
  canModify?: boolean;
}) {
  const [message, setMessage] = useState("");
  const encodedText = encodeURIComponent(postText);
  const xComposeUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
  const downloadUrl = xGrowthMediaUrl({ workId, mediaType, mediaAssetId });
  const tempFilename = useMemo(() => buildTempFilename({
    workId,
    intent,
    pickOrder,
    extension: mediaType === "sample_movie" ? "mp4" : "png",
    trimStartSeconds,
  }), [intent, mediaType, pickOrder, trimStartSeconds, workId]);
  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage("コピーできませんでした。本文を選択してコピーしてください。");
    }
  };
  const copy = () => copyText(postText, linkPlan === "self_reply" ? "本投稿をコピーしました。" : "完成文をコピーしました。");
  const copyReply = () => replyText ? copyText(replyText, "自己リプをコピーしました。") : setMessage("自己リプ文がありません。");
  const copyLink = () => affiliateUrl ? copyText(affiliateUrl, "リンクをコピーしました。") : setMessage("リンクがありません。");
  const copyImage = async () => {
    if (!downloadUrl || !(mediaType === "existing_link_image" || mediaType === "data_card")) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("画像コピー非対応");
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("画像を取得できませんでした");
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("画像変換に失敗しました");
      context.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG変換に失敗しました")), "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setMessage("画像をコピーしました。X投稿画面で貼り付けできます。");
    } catch {
      setMessage("画像コピーに失敗しました。画像を開くか保存して添付してください。");
    }
  };
  const useVideoForX = async () => {
    if (!downloadUrl || mediaType !== "sample_movie") return;
    setMessage("");
    try {
      await navigator.clipboard.writeText(postText);
      if (trimStartSeconds > 0 && !canModify) throw new Error("この動画は冒頭カット許可が未確認のため、トリム済み動画は保存できません。");
      const response = await fetch(downloadUrl, { cache: "no-store" });
      const errorBody = await response.clone().json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(errorBody?.error ?? "動画を取得できませんでした。");
      const blob = await response.blob();
      if (!fileSystemSupported()) {
        fallbackDownload(downloadUrl, tempFilename);
        window.open(xComposeUrl, "_blank", "noopener,noreferrer");
        setMessage("完成文をコピーし、X投稿画面を開きました。動画は通常ダウンロードです。投稿後に手動削除してください。");
        return;
      }
      const handle = await loadDirectoryHandle();
      if (!handle || !(await ensurePermission(handle))) throw new Error("先に一時フォルダを設定/再許可してください。");
      await cleanupOldTempFiles(handle);
      const saved = await saveBlobOnce(handle, tempFilename, blob);
      window.open(xComposeUrl, "_blank", "noopener,noreferrer");
      setMessage(`${saved.reused ? "既存動画を再利用" : trimStartSeconds > 0 ? "トリム済み動画を一時保存" : "動画を一時保存"}: ${saved.filename}。この動画をXで添付してください。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "動画投稿準備に失敗しました。");
    }
  };
  const deleteTempFile = async () => {
    setMessage("");
    try {
      await postJson("/api/admin/x-growth/mark-posted", { workId, candidateId, slotId, candidateRank, slotRole, title, postText, intent, mediaAssetId, linkStrategy: linkPlan });
      const handle = await loadDirectoryHandle();
      if (handle && (await ensurePermission(handle))) await handle.removeEntry(tempFilename).catch(() => undefined);
      setMessage(`投稿済みとして記録しました。${tempFilename} を削除しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除できませんでした。既に削除済みの可能性があります。");
    }
  };
  const materialLabel = mediaType === "sample_movie" ? "動画を開く/保存"
    : mediaType === "existing_link_image" || mediaType === "data_card" ? "画像を開く"
      : mediaType === "quote" ? "引用元を開く"
        : "";
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="h-10 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black">{linkPlan === "self_reply" ? "本投稿をコピー" : "完成文をコピー"}</button>
        {linkPlan === "body" && affiliateUrl && (
          <button type="button" onClick={copyLink} className="h-10 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 text-xs font-black text-emerald-100">リンクをコピー</button>
        )}
        {linkPlan === "self_reply" && (
          <button type="button" onClick={copyReply} className="h-10 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 text-xs font-black text-emerald-100">自己リプをコピー</button>
        )}
        {mediaUrl && downloadUrl && (mediaType === "existing_link_image" || mediaType === "data_card") && (
          <button type="button" onClick={copyImage} className="h-10 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black">画像をコピー</button>
        )}
        {mediaUrl && downloadUrl && mediaType === "sample_movie" && (
          <button type="button" onClick={useVideoForX} className="h-10 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black">{trimPostButtonLabel(trimStartSeconds)}</button>
        )}
        {mediaUrl && downloadUrl && materialLabel && (
          <a href={downloadUrl} className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-700 bg-cyan-950/40 px-3 text-xs font-black text-cyan-100">
            {materialLabel}
          </a>
        )}
        {quoteUrl && (
          <a href={quoteUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-700 bg-amber-950/40 px-3 text-xs font-black text-amber-100">引用元を開く</a>
        )}
        <a href={xComposeUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-100">X投稿画面を開く</a>
        <button type="button" onClick={deleteTempFile} className="h-10 rounded-lg border border-rose-700 bg-rose-950/30 px-3 text-xs font-black text-rose-100">{mediaType === "sample_movie" ? "投稿済み・一時ファイル削除" : "投稿済みとして記録"}</button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        {linkPlan === "self_reply" ? "順序: 本投稿を投稿 → 投稿後に自己リプを付ける。画像はコピー優先です。動画は一時フォルダへ保存してXで手動添付します。" : linkPlan === "body" ? "この投稿の本文にリンクを入れる。完成文コピーにはURLも含まれます。画像はコピー優先です。動画は一時フォルダへ保存してXで手動添付します。" : "この投稿にはリンクを入れない。画像はコピー優先です。動画は一時フォルダへ保存してXで手動添付します。"}
      </p>
      {message && <p className="mt-2 text-[11px] font-bold text-emerald-200">{message}</p>}
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
  compact = false,
  onSaved,
}: {
  assetId: number;
  sourceUrl: string;
  initialTrimStartSeconds?: number | null;
  initialTrimNote?: string | null;
  canModify?: boolean | null;
  trimModifyConfirmed?: boolean | null;
  compact?: boolean;
  onSaved?: (value: { trimStartSeconds: number; trimModifyConfirmed: boolean; trimNote: string }) => void;
}) {
  const [seconds, setSeconds] = useState(Number(initialTrimStartSeconds ?? 0).toFixed(1));
  const [savedSeconds, setSavedSeconds] = useState(Number(initialTrimStartSeconds ?? 0));
  const [currentTime, setCurrentTime] = useState(0);
  const [note, setNote] = useState(initialTrimNote ?? "");
  const [modifyConfirmed, setModifyConfirmed] = useState(Boolean(trimModifyConfirmed));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const numericSeconds = Number(seconds);
  const dirty = Number.isFinite(numericSeconds) && Math.round(numericSeconds * 10) / 10 !== savedSeconds;
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
      <div className="mx-auto w-full min-w-0 rounded-lg bg-black">
        <video
          src={sourceUrl}
          controls
          preload="metadata"
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          className="block aspect-video h-auto w-full min-w-0 object-contain"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-cyan-100">
        <span>現在 {currentTime.toFixed(1)}秒</span>
        <span>保存済み {savedSeconds.toFixed(1)}秒</span>
        {dirty && <span className="text-amber-200">未保存</span>}
        {savedSeconds > 0 && <span className="text-emerald-200">冒頭トリム: {savedSeconds.toFixed(1)}秒</span>}
        {savedSeconds > 0 && !canModify && !modifyConfirmed && <span className="text-rose-200">冒頭カット許可未確認のためトリム投稿不可</span>}
        <span className={modifyConfirmed ? "text-emerald-200" : "text-amber-200"}>{modifyConfirmed ? "冒頭カット許可確認済み" : "冒頭カット許可未確認"}</span>
      </div>
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
      <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={modifyConfirmed}
          onChange={(event) => setModifyConfirmed(event.target.checked)}
          className="h-4 w-4 accent-emerald-400"
        />
        冒頭カット許可確認済み
      </label>
      <button
        type="button"
        onClick={(event) => {
          const video = event.currentTarget.parentElement?.querySelector("video");
          if (video) {
            video.currentTime = Number(seconds) || 0;
            void video.play().catch(() => undefined);
          }
        }}
        className="h-9 w-fit rounded-lg border border-cyan-700 px-3 text-xs font-black text-cyan-100"
      >
        この位置から確認
      </button>
      {message && <p className="text-[11px] font-bold text-emerald-200">{message}</p>}
    </div>
  );
}

export function TrimReviewActions(props: Parameters<typeof XVideoTrimControls>[0]) {
  return <XVideoTrimControls {...props} />;
}

export function TopPickVideoActions({
  postText,
  replyText,
  linkPlan,
  affiliateUrl,
  mediaUrl,
  quoteUrl,
  workId,
  mediaAsset,
  candidateId,
  slotId,
  candidateRank,
  slotRole,
  title,
  intent,
  pickOrder,
  mediaType,
}: {
  postText: string;
  replyText?: string | null;
  linkPlan?: "none" | "body" | "self_reply";
  affiliateUrl?: string | null;
  mediaUrl: string | null;
  quoteUrl?: string | null;
  workId: number;
  mediaAsset?: TrimControlAsset | null;
  candidateId?: string | null;
  slotId?: string | null;
  candidateRank?: string | null;
  slotRole?: string | null;
  title?: string;
  intent?: string;
  pickOrder?: number;
  mediaType: XGrowthMediaType;
}) {
  const [trimStartSeconds, setTrimStartSeconds] = useState(Number(mediaAsset?.trim_start_seconds ?? 0));
  const [trimModifyConfirmed, setTrimModifyConfirmed] = useState(Boolean(mediaAsset?.trim_modify_confirmed));
  const canModify = mediaAsset?.can_modify === true || trimModifyConfirmed;
  const filename = useMemo(() => buildTempFilename({
    workId,
    intent,
    pickOrder,
    extension: mediaType === "sample_movie" ? "mp4" : "png",
    trimStartSeconds,
  }), [intent, mediaType, pickOrder, trimStartSeconds, workId]);
  const showTrimControls = shouldShowTopPickTrimControls({ mediaType, mediaUrl, assetId: mediaAsset?.id });
  const previewUrl = xGrowthMediaUrl({ workId, mediaType, mediaAssetId: mediaAsset?.id ?? null });

  if (mediaType !== "sample_movie") {
    return (
      <ManualPostActions
        postText={postText}
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        quoteUrl={quoteUrl}
        workId={workId}
        mediaAssetId={mediaAsset?.id ?? null}
        candidateId={candidateId}
        slotId={slotId}
        candidateRank={candidateRank}
        slotRole={slotRole}
        title={title}
        intent={intent}
        pickOrder={pickOrder}
        linkPlan={linkPlan}
        affiliateUrl={affiliateUrl}
        replyText={replyText}
        trimStartSeconds={trimStartSeconds}
        canModify={canModify}
      />
    );
  }

  return (
    <div className="mt-4 min-w-0 rounded-lg border border-cyan-900 bg-zinc-900 p-3">
      {showTrimControls && (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-cyan-100">現在の投稿動画: asset {mediaAsset?.id}</span>
            <span className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100">冒頭トリム: {trimStartSeconds.toFixed(1)}秒</span>
            <span className={`rounded-lg border px-3 py-2 ${canModify ? "border-emerald-800 bg-emerald-950/30 text-emerald-100" : "border-amber-800 bg-amber-950/30 text-amber-100"}`}>
              {canModify ? "冒頭カット許可確認済み" : "冒頭カット許可未確認のためトリム投稿不可"}
            </span>
            <span className="min-w-0 break-all rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-zinc-300">一時ファイル名: {filename}</span>
          </div>
          <XVideoTrimControls
            compact
            assetId={mediaAsset?.id as number}
            sourceUrl={previewUrl ?? (mediaUrl as string)}
            initialTrimStartSeconds={trimStartSeconds}
            initialTrimNote={mediaAsset?.trim_note}
            canModify={mediaAsset?.can_modify}
            trimModifyConfirmed={trimModifyConfirmed}
            onSaved={(value) => {
              setTrimStartSeconds(value.trimStartSeconds);
              setTrimModifyConfirmed(value.trimModifyConfirmed);
            }}
          />
        </div>
      )}
      {!showTrimControls && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs font-bold leading-5 text-amber-100">
          投稿動画のasset情報が不足しているため、このカードでは冒頭編集を表示できません。動画投稿用assetを再生成してください。
        </div>
      )}
      <ManualPostActions
        postText={postText}
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        quoteUrl={quoteUrl}
        workId={workId}
        mediaAssetId={mediaAsset?.id ?? null}
        candidateId={candidateId}
        slotId={slotId}
        candidateRank={candidateRank}
        slotRole={slotRole}
        title={title}
        intent={intent}
        pickOrder={pickOrder}
        linkPlan={linkPlan}
        affiliateUrl={affiliateUrl}
        replyText={replyText}
        trimStartSeconds={trimStartSeconds}
        canModify={canModify}
      />
    </div>
  );
}

export function CandidateSelectAction({
  slotId,
  candidateId,
  selected,
}: {
  slotId?: string;
  candidateId?: string;
  selected?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  if (!slotId || !candidateId) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending || selected}
        onClick={() => startTransition(async () => {
          setMessage("");
          try {
            await postJson("/api/admin/x-growth/select-candidate", { slotId, candidateId });
            setMessage("選択を保存しました。");
            window.location.reload();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "選択を保存できませんでした。");
          }
        })}
        className={`h-9 rounded-lg px-3 text-xs font-black disabled:opacity-70 ${selected ? "border border-emerald-700 bg-emerald-500 text-black" : "border border-zinc-700 bg-zinc-900 text-zinc-100"}`}
      >
        {selected ? "選択中" : pending ? "保存中" : "この候補を選ぶ"}
      </button>
      {message && <p className="mt-2 text-[11px] font-bold text-emerald-200">{message}</p>}
    </div>
  );
}

export function MetricSyncActions() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(["1h", "6h", "24h", "72h"] as const).map((age) => (
        <button key={age} disabled={pending} onClick={() => startTransition(async () => {
          try {
            const result = await postJson("/api/admin/x-growth/metrics", { age });
            setMessage(`${age}: ${String(result.saved)}件保存`);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "取得に失敗しました。");
          }
        })} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-200 disabled:opacity-50">{age}</button>
      ))}
      {message && <p className="basis-full text-[11px] font-bold text-amber-200">{message}</p>}
    </div>
  );
}

export function MediaPipelineActions() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (url: string, label: string, batchSize: number) => startTransition(async () => {
    try {
      const result = await postJson(url, { batchSize });
      setMessage(`${label}: ${Object.entries(result).map(([key, value]) => `${key} ${String(value)}`).join(" / ")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    }
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={pending} onClick={() => run("/api/admin/x-growth/media/sync", "同期", 250)} className="h-9 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black disabled:opacity-50">動画候補を同期</button>
      <button disabled={pending} onClick={() => run("/api/admin/x-growth/media/check", "URL確認", 50)} className="h-9 rounded-lg border border-sky-700 px-3 text-xs font-black text-sky-100 disabled:opacity-50">URL状態を確認</button>
      {message && <p className="basis-full text-[11px] font-bold text-amber-200">{message}</p>}
    </div>
  );
}

export function RegenerateTopPicksAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const regenerate = () => {
    setMessage("");
    startTransition(async () => {
      try {
        const data = await postJson("/api/admin/x-growth/regenerate", {});
        setMessage(`再生成しました。候補 ${data.topPicks ?? 0}件 / ${data.elapsedMs ?? "-"}ms`);
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "再生成できませんでした。");
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
      <button type="button" onClick={regenerate} disabled={pending} className="h-9 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 font-black text-emerald-100 disabled:opacity-50">
        {pending ? "再生成中" : "今日の候補を再生成"}
      </button>
      {message && <span className="font-bold text-emerald-200">{message}</span>}
    </div>
  );
}

type DeferredPayload = {
  ok: boolean;
  error?: string;
  supplyDiagnostics?: {
    generatedByRole?: Record<string, number>;
    gateOkByRole?: Record<string, number>;
    shortagesByRole?: Record<string, number>;
    shortages?: string[];
    nativeVoiceNgBySource?: Record<string, number>;
    crossPostDiversityRejected?: number;
  };
  nativeXLearning?: {
    overusedPatterns?: string[];
    winningPatterns?: string[];
    avoidConstructions?: string[];
  };
  mediaSupply?: Record<string, unknown>;
  rightsReviewQueue?: Array<Record<string, unknown>>;
  conversationRadar?: Array<Record<string, unknown>>;
  learning?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
  audit?: Record<string, string[]>;
  performanceTimings?: Record<string, number>;
};

function InlineMap({ values }: { values?: Record<string, unknown> }) {
  const entries = Object.entries(values ?? {});
  if (!entries.length) return <p>なし</p>;
  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => <p key={key}>{key}: {Array.isArray(value) ? value.join(" / ") : String(value)}</p>)}
    </div>
  );
}

function SimpleList({ items, empty }: { items?: unknown[]; empty: string }) {
  if (!items?.length) return <p>{empty}</p>;
  return (
    <div className="space-y-2">
      {items.slice(0, 12).map((item, index) => (
        <pre key={index} className="overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-2 text-[10px] leading-4 text-zinc-400">
          {JSON.stringify(item, null, 2)}
        </pre>
      ))}
    </div>
  );
}

export function DeferredXGrowthSections() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeferredPayload | null>(null);

  const load = async () => {
    setOpen((current) => !current);
    if (data || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/x-growth/deferred", { cache: "no-store" });
      const payload = await response.json();
      setData(payload as DeferredPayload);
    } catch (error) {
      setData({ ok: false, error: error instanceof Error ? error.message : "後読み詳細を取得できませんでした。" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <button type="button" onClick={load} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-lg font-black text-white">後読み詳細</span>
          <span className="mt-1 block text-sm leading-6 text-zinc-400">Supply diagnostics、Native X Learning、Rights Review、Conversation Radar、Learning Lab、Opportunity一覧を必要な時だけ読み込みます。</span>
        </span>
        <span className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-200">{open ? "閉じる" : "展開"}</span>
      </button>
      {open && (
        <div className="mt-5">
          {loading && <p className="text-sm text-zinc-400">後読み中...</p>}
          {data?.error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-100">{data.error}</p>}
          {data?.ok && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Supply diagnostics</p>
                <InlineMap values={data.supplyDiagnostics?.generatedByRole} />
                <p className="mt-2">Gate OK</p>
                <InlineMap values={data.supplyDiagnostics?.gateOkByRole} />
                <p className="mt-2">不足理由: {data.supplyDiagnostics?.shortages?.length ? data.supplyDiagnostics.shortages.join(" / ") : "なし"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Native X Learning</p>
                <p>使いすぎ: {data.nativeXLearning?.overusedPatterns?.length ? data.nativeXLearning.overusedPatterns.join(" / ") : "検出なし"}</p>
                <p>最近強かったHook: {data.nativeXLearning?.winningPatterns?.length ? data.nativeXLearning.winningPatterns.join(" / ") : "実績不足"}</p>
                <p>避ける構文: {data.nativeXLearning?.avoidConstructions?.length ? data.nativeXLearning.avoidConstructions.join(" / ") : "検出なし"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Media supply counters</p>
                <InlineMap values={data.mediaSupply} />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Audit / diagnostics</p>
                <InlineMap values={data.audit} />
                <p className="mt-2">Performance</p>
                <InlineMap values={data.performanceTimings} />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Media Rights Review</p>
                <SimpleList items={data.rightsReviewQueue} empty="rights確認待ちはありません。" />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Conversation Radar</p>
                <SimpleList items={data.conversationRadar} empty="会話候補はありません。" />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Learning Lab詳細</p>
                <SimpleList items={data.learning} empty="学習ログはまだありません。" />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-400">
                <p className="font-black text-zinc-100">Opportunity一覧</p>
                <SimpleList items={data.opportunities} empty="候補はありません。" />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function RightsReviewActions({ assetId }: { assetId: number }) {
  const [basisType, setBasisType] = useState("insufficient_evidence");
  const [basisUrl, setBasisUrl] = useState("");
  const [note, setNote] = useState("");
  const [quality, setQuality] = useState("unreviewed");
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = (status: "review" | "allowed" | "blocked") => startTransition(async () => {
    try {
      if (status === "allowed" && !confirm("権利根拠を確認済みの素材だけallowedにします。続行しますか？")) return;
      await postJson("/api/admin/x-growth/media/review", {
        id: assetId,
        status,
        rightsBasisType: basisType,
        rightsBasisUrl: basisUrl,
        rightsBasisNote: note,
        mediaQuality: quality,
        manualTags,
        reviewSource: status === "allowed" && note.includes("User confirmed") ? "user_confirmed" : "admin",
      });
      setMessage("保存しました。再読み込みで反映されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  });
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={basisType} onChange={(event) => setBasisType(event.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100">
          {["insufficient_evidence", "explicit_permission", "official_policy", "creator_permission", "license", "prohibited"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={quality} onChange={(event) => setQuality(event.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100">
          {["unreviewed", "strong", "normal", "weak"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <input suppressHydrationWarning value={basisUrl} onChange={(event) => setBasisUrl(event.target.value)} placeholder="根拠URL" className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100" />
      <textarea suppressHydrationWarning value={note} onChange={(event) => setNote(event.target.value)} placeholder="根拠メモ / blocked理由" className="h-20 resize-none rounded-lg border border-zinc-700 bg-black p-2 text-xs text-zinc-100" />
      <div className="grid gap-2 rounded-lg border border-zinc-800 bg-black/40 p-2 sm:grid-cols-2">
        {MANUAL_TAGS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
            <input
              suppressHydrationWarning
              type="checkbox"
              checked={manualTags.includes(value)}
              onChange={(event) => setManualTags((current) => event.target.checked ? [...current, value] : current.filter((tag) => tag !== value))}
              className="h-4 w-4 accent-emerald-400"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => submit("review")} className="h-9 rounded-lg border border-amber-700 px-3 text-xs font-black text-amber-100 disabled:opacity-50">reviewにする</button>
        <button disabled={pending} onClick={() => submit("allowed")} className="h-9 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black disabled:opacity-50">allowedにする</button>
        <button disabled={pending} onClick={() => submit("blocked")} className="h-9 rounded-lg border border-rose-700 px-3 text-xs font-black text-rose-100 disabled:opacity-50">blockedにする</button>
      </div>
      {message && <p className="text-[11px] font-bold text-amber-200">{message}</p>}
    </div>
  );
}
