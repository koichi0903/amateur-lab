"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import WorkImage from "@/components/home/WorkImage";
import { getXPostAccountHandle } from "@/lib/fanzaAmateurXPostHelpers";

type Lane = "new_release" | "popular";
type Job = { id: number; account_handle: string; content_id: string; source_lane: Lane; status: "pending" | "posted" | "skipped"; main_text: string; reply_text: string; x_post_url: string | null; posted_at: string | null; created_at: string; work: { content_id: string; title: string | null; api_date: string | null; mp4_url: string | null } | null; image: string | null };
type Candidate = { content_id: string; title: string | null; api_date: string | null; mp4_url: string | null; mp4_status: string | null; image: string | null; rank?: number | null; job: { id: number; status: "pending" | "posted" | "skipped" } | null };
type Dashboard = { candidates: Candidate[]; jobs: Job[]; history: Job[]; total: number; page: number; hasMore: boolean; error?: string };
type Refresh = () => Promise<void>;

const button = "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40";

async function api(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/amateur-x-post", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "処理に失敗しました。");
}

function CandidateCard({ item, lane, refresh }: { item: Candidate; lane: Lane; refresh: Refresh }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function add() {
    setBusy(true); setMessage("");
    try {
      await api({ action: "add", contentId: item.content_id, lane });
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function skip() {
    setBusy(true); setMessage("");
    try {
      await api({ action: "skip_candidate", contentId: item.content_id, lane });
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <article className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:grid-cols-[160px_1fr_auto] sm:items-center">
    <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-950"><WorkImage src={item.image} alt={item.title ?? item.content_id} sizes="160px" className="object-contain" /></div>
    <div className="min-w-0"><p className="text-xs font-bold text-violet-300">{item.rank ? `人気順位 ${item.rank}位` : "新作7日間"}</p><p className="mt-1 line-clamp-2 font-bold">{item.title ?? item.content_id}</p><p className="mt-1 text-xs text-zinc-500">{item.content_id} / 発売日: {item.api_date?.slice(0, 10) ?? "未取得"}</p>
      {item.job && <p className="mt-2 text-xs text-amber-200">{item.job.status === "pending" ? "投稿リストに追加済み（準備中）" : item.job.status === "skipped" ? "スキップ済み" : "投稿済み"}</p>}{message && <p className="mt-2 text-xs text-rose-300">{message}</p>}</div>
    {!item.job && <div className="flex gap-2"><button disabled={busy} onClick={add} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy ? "処理中…" : "投稿準備に追加"}</button><button disabled={busy} onClick={skip} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">{busy ? "処理中…" : "スキップ"}</button></div>}
  </article>;
}

function useVideoPreviewSeek() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingPreviewSeek = useRef<number | null>(null);
  function seekPreview(value: string) {
    if (!value.trim()) return;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const video = videoRef.current;
    if (!video || video.readyState < 1) {
      pendingPreviewSeek.current = seconds;
      return;
    }
    const lastSeekableSecond = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : seconds;
    video.currentTime = Math.min(seconds, lastSeekableSecond);
    video.pause();
  }
  function syncPendingPreviewSeek() {
    if (pendingPreviewSeek.current == null) return;
    const seconds = pendingPreviewSeek.current;
    pendingPreviewSeek.current = null;
    seekPreview(String(seconds));
  }
  return { videoRef, seekPreview, syncPendingPreviewSeek };
}

function JobCard({ job, refresh }: { job: Job; refresh: Refresh }) {
  const [mainText, setMainText] = useState(job.main_text);
  const [replyText, setReplyText] = useState(job.reply_text);
  const [postUrl, setPostUrl] = useState(job.x_post_url ?? "");
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const { videoRef, seekPreview, syncPendingPreviewSeek } = useVideoPreviewSeek();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = job.status === "pending";
  const postedAccount = getXPostAccountHandle(job.x_post_url ?? "");
  const accountLabel = job.account_handle !== "unassigned" ? `@${job.account_handle}` : postedAccount ? `@${postedAccount}` : "共有リスト";
  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMessage("");
    try { await api({ action, jobId: job.id, ...extra }); setMessage("保存しました。"); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function saveText() { await run("text", { mainText, replyText }); }
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setMessage(`${label}をコピーしました。`); } catch { setMessage("コピーできませんでした。表示された文面を選択してください。"); } }
  const videoParams = new URLSearchParams({ jobId: String(job.id), trimStart: trimStart || "0" });
  if (trimEnd.trim()) videoParams.set("trimEnd", trimEnd.trim());
  const videoUrl = `/api/admin/amateur-x-post/video?${videoParams.toString()}`;
  return <article className="rounded-2xl border border-violet-900 bg-violet-950/10 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-200">{job.source_lane === "popular" ? "人気順候補" : "新作7日間"}</span><span className={`ml-2 text-sm font-black ${pending ? "text-cyan-200" : "text-zinc-400"}`}>{pending ? "準備中" : job.status === "posted" ? "投稿済み" : "スキップ"}</span></div><span className="text-xs text-zinc-500">{accountLabel}</span></div>
    <div className="mt-4 space-y-4">
      <JobCardMedia job={job} videoRef={videoRef} syncPendingPreviewSeek={syncPendingPreviewSeek} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <JobCardVideoControls job={job} pending={pending} trimStart={trimStart} setTrimStart={setTrimStart} trimEnd={trimEnd} setTrimEnd={setTrimEnd} videoUrl={videoUrl} seekPreview={seekPreview} />
        <JobCardPostingFields job={job} pending={pending} busy={busy} mainText={mainText} setMainText={setMainText} replyText={replyText} setReplyText={setReplyText} postUrl={postUrl} setPostUrl={setPostUrl} saveText={saveText} copy={copy} run={run} message={message} />
      </div>
    </div>
  </article>;
}

function JobCardMedia({ job, videoRef, syncPendingPreviewSeek }: { job: Job; videoRef: { current: HTMLVideoElement | null }; syncPendingPreviewSeek: () => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><p className="mb-1 text-xs font-bold text-zinc-400">サンプル動画</p>{job.work?.mp4_url ? <video ref={videoRef} controls preload="metadata" onLoadedMetadata={syncPendingPreviewSeek} className="aspect-video w-full rounded-lg bg-black" src={job.work.mp4_url}><track kind="captions" /></video> : <div className="flex aspect-video items-center justify-center rounded-lg bg-black text-xs text-zinc-500">動画がありません</div>}</div>
    <div><p className="mb-1 text-xs font-bold text-zinc-400">作品写真</p><div className="relative aspect-video overflow-hidden rounded-lg bg-black"><WorkImage src={job.image} alt={job.work?.title ?? job.content_id} sizes="(min-width: 640px) 50vw, 100vw" className="object-contain" /></div></div>
  </div>;
}

function JobCardVideoControls({ job, pending, trimStart, setTrimStart, trimEnd, setTrimEnd, videoUrl, seekPreview }: {
  job: Job;
  pending: boolean;
  trimStart: string;
  setTrimStart: (value: string) => void;
  trimEnd: string;
  setTrimEnd: (value: string) => void;
  videoUrl: string;
  seekPreview: (value: string) => void;
}) {
  return <div><p className="text-xs text-zinc-400">{job.work?.title ?? job.content_id}</p><Link href={`/amateur/${encodeURIComponent(job.content_id)}`} target="_blank" className="mt-1 inline-block text-xs text-cyan-300">作品ページを開く</Link>
    {pending && <div className="mt-3 flex flex-wrap gap-3"><label className="block text-xs text-zinc-400">動画の開始位置（秒）<input type="number" min="0" max="600" step="0.1" value={trimStart} onChange={(event) => { const value = event.target.value; setTrimStart(value); seekPreview(value); }} className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-white" /></label>
      <label className="block text-xs text-zinc-400">動画の終了位置（秒・空欄で最後まで）<input type="number" min={Number(trimStart) + 0.1} max="600" step="0.1" value={trimEnd} onChange={(event) => { const value = event.target.value; setTrimEnd(value); seekPreview(value); }} className="mt-1 block w-40 rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-white" /></label></div>}
    {pending && <a href={videoUrl} className="mt-3 inline-block rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-black">X用MP4を生成・保存</a>}
  </div>;
}

function JobCardPostingFields({ job, pending, busy, mainText, setMainText, replyText, setReplyText, postUrl, setPostUrl, saveText, copy, run, message }: {
  job: Job;
  pending: boolean;
  busy: boolean;
  mainText: string;
  setMainText: (value: string) => void;
  replyText: string;
  setReplyText: (value: string) => void;
  postUrl: string;
  setPostUrl: (value: string) => void;
  saveText: () => Promise<void>;
  copy: (value: string, label: string) => Promise<void>;
  run: (action: string, extra?: Record<string, unknown>) => Promise<void>;
  message: string;
}) {
  return <div className="space-y-3">
    <label className="block text-xs font-bold text-zinc-400">投稿本文（{mainText.length}/280）<textarea disabled={!pending} maxLength={280} value={mainText} onChange={(event) => setMainText(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white disabled:opacity-60" /></label>
    <label className="block text-xs font-bold text-zinc-400">自己リプ（作品名・価格・作品リンク）（{replyText.length}/280）<textarea disabled={!pending} maxLength={280} value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={6} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white disabled:opacity-60" /></label>
    {pending && <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={saveText} className={button}>本文を保存</button><button disabled={busy} onClick={() => copy(mainText, "本文")} className={button}>本文をコピー</button><button disabled={busy} onClick={() => copy(replyText, "自己リプ")} className={button}>自己リプをコピー</button><button disabled={busy} onClick={() => window.open(`https://x.com/compose/post?text=${encodeURIComponent(mainText)}`, "_blank", "noopener,noreferrer")} className={button}>X投稿画面を開く</button></div>}
    {pending && <p className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">公式HTTPSサンプル動画を手動で準備できます。利用するXアカウントを確認して投稿してください。Xではセンシティブな内容として設定してください。</p>}
    {pending && <div className="flex flex-wrap items-end gap-2"><label className="min-w-60 flex-1 text-xs text-zinc-400">投稿後のX URL（任意・投稿アカウント記録に使用）<input value={postUrl} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://x.com/.../status/..." className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label><button disabled={busy} onClick={() => run("posted", { xPostUrl: postUrl, mainText, replyText })} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-black">投稿済みにする</button><button disabled={busy} onClick={() => run("skip")} className={button}>スキップ</button></div>}
    {job.x_post_url && <a href={job.x_post_url} target="_blank" rel="noreferrer" className="block text-xs text-cyan-300">投稿URLを開く</a>}
    {message && <p className="whitespace-pre-wrap text-xs text-amber-200">{message}</p>}
  </div>;
}

function HistoryRow({ job }: { job: Job }) {
  const account = job.account_handle !== "unassigned" ? `@${job.account_handle}` : getXPostAccountHandle(job.x_post_url ?? "") ?? "共有リスト";
  const status = job.status === "posted" ? "投稿済み" : "スキップ";
  return <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs">
    <span className="min-w-0 flex-1 truncate text-zinc-300">{job.work?.title ?? job.content_id}</span>
    <span className="text-zinc-500">{account} · {status} · {new Date(job.posted_at ?? job.created_at).toLocaleDateString("ja-JP")}</span>
    {job.x_post_url && <a href={job.x_post_url} target="_blank" rel="noreferrer" className="text-cyan-300">投稿を開く ↗</a>}
  </li>;
}

function JobQueueSection({ data, loading, error, refreshCurrent }: { data: Dashboard | null; loading: boolean; error: string; refreshCurrent: Refresh }) {
  return <section className="mt-4 rounded-2xl border border-cyan-900 bg-zinc-900 p-4 sm:p-5"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-black">投稿するリスト</h2><span className="text-xs text-zinc-500">{loading ? "読み込み中…" : `未投稿 ${data?.jobs.length ?? 0}/100件`}</span></div><div className="space-y-4">{data?.jobs.map((job) => <JobCard key={job.id} job={job} refresh={refreshCurrent} />)}{!loading && !error && !data?.jobs.length && <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">未投稿リストは空です。下の候補作品から追加できます。</p>}</div></section>;
}

function HistorySection({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return null;
  return <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"><summary className="cursor-pointer text-sm font-bold text-zinc-300">投稿済み・スキップ履歴（直近{jobs.length}件）</summary><ul className="mt-3 space-y-2">{jobs.map((job) => <HistoryRow key={job.id} job={job} />)}</ul></details>;
}

function CandidateBrowseSection({ data, lane, page, loading, refresh, refreshCurrent }: { data: Dashboard | null; lane: Lane; page: number; loading: boolean; refresh: (nextPage: number, nextLane: Lane) => Promise<void>; refreshCurrent: Refresh }) {
  return <>
    <nav className="mt-8 flex flex-wrap gap-2"><button onClick={() => void refresh(1, "new_release")} disabled={loading} className={`rounded-lg px-4 py-2 text-sm font-bold ${lane === "new_release" ? "bg-emerald-500 text-black" : "border border-zinc-700 text-zinc-300"}`}>直近7日分</button><button onClick={() => void refresh(1, "popular")} disabled={loading} className={`rounded-lg px-4 py-2 text-sm font-bold ${lane === "popular" ? "bg-emerald-500 text-black" : "border border-zinc-700 text-zinc-300"}`}>人気動画TOP500</button><span className="self-center text-xs text-zinc-500">{lane === "popular" ? "DMM人気順・MP4確認済み作品を最大500件" : "JST直近7日間（今日を含む）・MP4確認済み作品。全アカウントの投稿済み・スキップ済みは除外"}</span></nav>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-black">候補作品</h2><span className="text-xs text-zinc-500">{loading ? "読み込み中…" : `${data?.total ?? 0}件`}</span></div><div className="space-y-3">{data?.candidates.map((item) => <CandidateCard key={item.content_id} item={item} lane={lane} refresh={refreshCurrent} />)}{!loading && !data?.candidates.length && <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">条件に合う作品はありません。人気順の上位500件でも、MP4未補完の作品は候補に表示しません。</p>}</div>{data?.hasMore && <div className="mt-4 text-center"><button disabled={loading} onClick={() => void refresh(page + 1, lane)} className={button}>次の30件</button></div>}</section>
  </>;
}

export function AmateurXPostConsole() {
  const [lane, setLane] = useState<Lane>("new_release");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async (nextPage: number, nextLane: Lane) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/amateur-x-post?lane=${nextLane}&page=${nextPage}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as Dashboard;
      if (!response.ok) throw new Error(body.error ?? "データを取得できませんでした。");
      setData(body); setPage(nextPage); setLane(nextLane);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(1, "new_release"); }, [refresh]);
  const refreshCurrent = () => refresh(page, lane);
  return <>
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-300">複数アカウント共通の投稿リスト。投稿後のX URLからアカウントを記録します。</p>
      <button onClick={refreshCurrent} disabled={loading} className={button}>{loading ? "読み込み中…" : "リストを更新"}</button>
    </section>
    {error && <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    <JobQueueSection data={data} loading={loading} error={error} refreshCurrent={refreshCurrent} />
    <HistorySection jobs={data?.history ?? []} />
    <CandidateBrowseSection data={data} lane={lane} page={page} loading={loading} refresh={refresh} refreshCurrent={refreshCurrent} />
    <p className="mt-4 text-xs leading-5 text-zinc-500">Xへの投稿は手動です。投稿後にX URLを登録すると、実際に投稿したアカウントを記録します。URLを省略した場合は共有リストの記録として残ります。</p>
  </>;
}