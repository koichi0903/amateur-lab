"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
  mediaUrl,
  mediaType,
  quoteUrl,
  workId,
  mediaAssetId,
  intent,
  pickOrder,
  trimStartSeconds = 0,
  canModify = false,
}: {
  postText: string;
  mediaUrl: string | null;
  mediaType: "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";
  quoteUrl?: string | null;
  workId: number;
  mediaAssetId?: number | null;
  intent?: string;
  pickOrder?: number;
  trimStartSeconds?: number;
  canModify?: boolean;
}) {
  const [message, setMessage] = useState("");
  const encodedText = encodeURIComponent(postText);
  const xComposeUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
  const downloadUrl = mediaType === "sample_movie" || mediaType === "existing_link_image" || mediaType === "data_card"
    ? `/api/admin/x-growth/media/download?workId=${encodeURIComponent(String(workId))}&mediaType=${encodeURIComponent(mediaType)}${mediaAssetId ? `&assetId=${encodeURIComponent(String(mediaAssetId))}` : ""}`
    : null;
  const tempFilename = useMemo(() => buildTempFilename({
    workId,
    intent,
    pickOrder,
    extension: mediaType === "sample_movie" ? "mp4" : "png",
    trimStartSeconds,
  }), [intent, mediaType, pickOrder, trimStartSeconds, workId]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postText);
      setMessage("完成文をコピーしました。");
    } catch {
      setMessage("コピーできませんでした。本文を選択してコピーしてください。");
    }
  };
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
      const handle = await loadDirectoryHandle();
      if (!handle || !(await ensurePermission(handle))) throw new Error("一時フォルダを再設定してください。");
      await handle.removeEntry(tempFilename);
      setMessage(`投稿済みとして ${tempFilename} を削除しました。`);
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
        <button type="button" onClick={copy} className="h-10 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black">完成文をコピー</button>
        {mediaUrl && downloadUrl && (mediaType === "existing_link_image" || mediaType === "data_card") && (
          <button type="button" onClick={copyImage} className="h-10 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black">画像をコピー</button>
        )}
        {mediaUrl && downloadUrl && mediaType === "sample_movie" && (
          <button type="button" onClick={useVideoForX} className="h-10 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black">{trimStartSeconds > 0 ? "トリム済み動画を使ってX投稿" : "動画を使ってX投稿"}</button>
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
        {mediaType === "sample_movie" && (
          <button type="button" onClick={deleteTempFile} className="h-10 rounded-lg border border-rose-700 bg-rose-950/30 px-3 text-xs font-black text-rose-100">投稿済み・一時ファイル削除</button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">画像はコピー優先です。動画は一時フォルダへ保存してXで手動添付します。投稿完了はブラウザだけでは検知できないため、投稿後に削除ボタンを押します。</p>
      {message && <p className="mt-2 text-[11px] font-bold text-emerald-200">{message}</p>}
    </div>
  );
}

export function TrimReviewActions({
  assetId,
  sourceUrl,
  initialTrimStartSeconds,
  initialTrimNote,
  canModify,
  trimModifyConfirmed,
}: {
  assetId: number;
  sourceUrl: string;
  initialTrimStartSeconds?: number | null;
  initialTrimNote?: string | null;
  canModify?: boolean | null;
  trimModifyConfirmed?: boolean | null;
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
      const result = await postJson("/api/admin/x-growth/media/trim", { id: assetId, trimStartSeconds: rounded, trimNote: note, trimModifyConfirmed: modifyConfirmed });
      const saved = Number(result.trimStartSeconds ?? rounded);
      setSeconds(saved.toFixed(1));
      setSavedSeconds(saved);
      setMessage("開始位置を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  });
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-cyan-900 bg-cyan-950/10 p-3">
      <video
        src={sourceUrl}
        controls
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        className="h-44 w-full bg-black"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-cyan-100">
        <span>現在 {currentTime.toFixed(1)}秒</span>
        <span>保存済み {savedSeconds.toFixed(1)}秒</span>
        {dirty && <span className="text-amber-200">未保存</span>}
        {savedSeconds > 0 && <span className="text-emerald-200">冒頭トリム: {savedSeconds.toFixed(1)}秒</span>}
        {savedSeconds > 0 && !canModify && !modifyConfirmed && <span className="text-rose-200">冒頭カット許可が未確認のため投稿用trim生成は不可</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          suppressHydrationWarning
          type="number"
          min="0"
          step="0.1"
          value={seconds}
          onChange={(event) => setSeconds(event.target.value)}
          className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100"
        />
        <button type="button" onClick={() => setSeconds((Math.round(currentTime * 10) / 10).toFixed(1))} className="h-9 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black">現在位置を開始点にする</button>
        <button type="button" onClick={() => setSeconds("0.0")} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-100">0秒に戻す</button>
        <button type="button" disabled={pending} onClick={save} className="h-9 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black disabled:opacity-50">保存</button>
      </div>
      <textarea suppressHydrationWarning value={note} onChange={(event) => setNote(event.target.value)} placeholder="トリムメモ" className="h-16 resize-none rounded-lg border border-zinc-700 bg-black p-2 text-xs text-zinc-100" />
      <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
        <input
          suppressHydrationWarning
          type="checkbox"
          checked={modifyConfirmed}
          onChange={(event) => setModifyConfirmed(event.target.checked)}
          className="h-4 w-4 accent-emerald-400"
        />
        冒頭カットも許可確認済みとして記録
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
        この位置からプレビュー
      </button>
      {message && <p className="text-[11px] font-bold text-emerald-200">{message}</p>}
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
        setMessage(`再生成しました。Top Picks ${data.topPicks ?? 0}件 / ${data.elapsedMs ?? "-"}ms`);
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "再生成できませんでした。");
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
      <button type="button" onClick={regenerate} disabled={pending} className="h-9 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 font-black text-emerald-100 disabled:opacity-50">
        {pending ? "再生成中" : "今日のTop Picksを再生成"}
      </button>
      {message && <span className="font-bold text-emerald-200">{message}</span>}
    </div>
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
