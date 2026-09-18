"use client";

import { useState } from "react";

async function call(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/bijyo-reserved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error ?? "処理に失敗しました。");
  return data;
}

function openExternal(url: string) { window.open(url, "_blank", "noopener,noreferrer"); }

export function BijyoReservedActions({ jobId, workId, mainText, replyText, status, sampleMovieUrl }: { jobId?: number; workId?: number; mainText?: string; replyText?: string; status?: string; sampleMovieUrl?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: string) {
    setBusy(true); setMessage("");
    try { await call({ action, jobId, workId }); setMessage(action === "posted" ? "投稿済みにしました。" : action === "skip" ? "スキップして候補を補充しました。" : action === "exclude" ? "今後の候補から外しました。" : "手動追加枠を作成しました。画面を更新してください。"); if (["posted", "skip", "exclude", "manual"].includes(action)) window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setMessage(`${label}をコピーしました。`); } catch { setMessage("コピーできませんでした。表示された文面を選択してください。"); } }
  return <div className="flex flex-wrap gap-2">
    {jobId && <>
      <button disabled={busy} onClick={() => openExternal(`/api/admin/bijyo-reserved/video?jobId=${jobId}`)} className="rounded bg-emerald-500 px-3 py-2 text-xs font-black text-black">動画を開く / 保存</button>
      {sampleMovieUrl && <button disabled={busy} onClick={() => openExternal(sampleMovieUrl)} className="rounded border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-200">元動画preview</button>}
      <button disabled={busy} onClick={() => copy(mainText ?? "", "本文")} className="rounded border border-cyan-700 px-3 py-2 text-xs font-bold text-cyan-200">本文をコピー</button>
      <button disabled={busy} onClick={() => { const text = encodeURIComponent(mainText ?? ""); openExternal(`https://x.com/compose/post?text=${text}`); }} className="rounded border border-sky-700 px-3 py-2 text-xs font-bold text-sky-200">X投稿画面を開く</button>
      <button disabled={busy} onClick={() => copy(replyText ?? "", "自己リプ")} className="rounded border border-violet-700 px-3 py-2 text-xs font-bold text-violet-200">自己リプをコピー</button>
      <button disabled={busy || !["pending", "trim_failed"].includes(status ?? "")} onClick={() => run("posted")} className="rounded bg-cyan-500 px-3 py-2 text-xs font-black text-black">投稿済みにする</button>
      <button disabled={busy || status !== "pending"} onClick={() => run("skip")} className="rounded border border-amber-700 px-3 py-2 text-xs font-bold text-amber-200">スキップ</button>
      <button disabled={busy || ["posted", "manual_posted"].includes(status ?? "")} onClick={() => run("exclude")} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">自動対象から外す</button>
    </>}
    {workId && <button disabled={busy} onClick={() => run("manual")} className="rounded bg-violet-500 px-3 py-2 text-xs font-black text-white">手動追加投稿</button>}
    {message && <p className="w-full whitespace-pre-wrap text-xs text-amber-200">{message}</p>}
  </div>;
}
