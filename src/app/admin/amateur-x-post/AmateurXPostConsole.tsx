"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import WorkImage from "@/components/home/WorkImage";

type Lane = "new_release" | "popular";
type Job = { id: number; account_handle: string; content_id: string; source_lane: Lane; status: "pending" | "posted" | "skipped"; main_text: string; reply_text: string; x_post_url: string | null; posted_at: string | null; created_at: string; work: { content_id: string; title: string | null; api_date: string | null; mp4_url: string | null } | null; image: string | null };
type Candidate = { content_id: string; title: string | null; api_date: string | null; mp4_url: string | null; mp4_status: string | null; image: string | null; rank?: number | null; job: { id: number; status: string } | null };
type Dashboard = { candidates: Candidate[]; jobs: Job[]; total: number; page: number; hasMore: boolean; error?: string };

const button = "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40";

async function api(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/amateur-x-post", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "処理に失敗しました。");
}

function CandidateCard({ item, lane, handle, refresh }: { item: Candidate; lane: Lane; handle: string; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function add() {
    setBusy(true); setMessage("");
    try {
      await api({ action: "add", account: handle, contentId: item.content_id, lane });
      refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <article className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:grid-cols-[160px_1fr_auto] sm:items-center">
    <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-950"><WorkImage src={item.image} alt={item.title ?? item.content_id} sizes="160px" className="object-contain" /></div>
    <div className="min-w-0"><p className="text-xs font-bold text-violet-300">{item.rank ? `人気順位 ${item.rank}位` : "直近7日間"}</p><p className="mt-1 line-clamp-2 font-bold">{item.title ?? item.content_id}</p><p className="mt-1 text-xs text-zinc-500">{item.content_id} / 発売日: {item.api_date?.slice(0, 10) ?? "未取得"}</p>
      {item.job && <p className="mt-2 text-xs text-amber-200">このアカウントには追加済み（{item.job.status === "posted" ? "投稿済み" : item.job.status === "skipped" ? "スキップ" : "準備中"}）</p>}{message && <p className="mt-2 text-xs text-rose-300">{message}</p>}</div>
    <button disabled={busy || Boolean(item.job)} onClick={add} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy ? "追加中…" : item.job ? "追加済み" : "投稿準備に追加"}</button>
  </article>;
}

function JobCard({ job, account, refresh }: { job: Job; account: string; refresh: () => void }) {
  const [mainText, setMainText] = useState(job.main_text);
  const [replyText, setReplyText] = useState(job.reply_text);
  const [postUrl, setPostUrl] = useState(job.x_post_url ?? "");
  const [trimStart, setTrimStart] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = job.status === "pending";
  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMessage("");
    try { await api({ action, account, jobId: job.id, ...extra }); setMessage("保存しました。"); refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function saveText() { await run("text", { mainText, replyText }); }
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setMessage(`${label}をコピーしました。`); } catch { setMessage("コピーできませんでした。表示された文面を選択してください。"); } }
  const videoUrl = `/api/admin/amateur-x-post/video?account=${encodeURIComponent(account)}&jobId=${job.id}&trimStart=${encodeURIComponent(trimStart)}`;
  return <article className="rounded-2xl border border-violet-900 bg-violet-950/10 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-200">{job.source_lane === "popular" ? "人気順候補" : "直近7日間"}</span><span className={`ml-2 text-sm font-black ${pending ? "text-cyan-200" : "text-zinc-400"}`}>{pending ? "準備中" : job.status === "posted" ? "投稿済み" : "スキップ"}</span></div><span className="text-xs text-zinc-500">@{account}</span></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
      <div><div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-black"><WorkImage src={job.image} alt={job.work?.title ?? job.content_id} sizes="280px" className="object-contain" /></div>
        {job.work?.mp4_url && <video controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" src={job.work.mp4_url}><track kind="captions" /></video>}
        <p className="mt-2 text-xs text-zinc-400">{job.work?.title ?? job.content_id}</p><Link href={`/amateur/${encodeURIComponent(job.content_id)}`} target="_blank" className="mt-1 inline-block text-xs text-cyan-300">作品ページを開く</Link>
        <label className="mt-3 block text-xs text-zinc-400">動画の開始位置（秒）<input type="number" min="0" max="600" step="0.1" value={trimStart} onChange={(event) => setTrimStart(event.target.value)} className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-white" /></label>
        <a aria-disabled={!pending} href={pending ? videoUrl : undefined} onClick={(event) => { if (!pending) event.preventDefault(); }} className={`mt-3 inline-block rounded-lg px-3 py-2 text-xs font-black ${pending ? "bg-emerald-500 text-black" : "cursor-not-allowed bg-zinc-800 text-zinc-500"}`}>X用MP4を生成・保存</a>
      </div>
      <div className="space-y-3">
        <label className="block text-xs font-bold text-zinc-400">投稿本文（{mainText.length}/280）<textarea disabled={!pending} maxLength={280} value={mainText} onChange={(event) => setMainText(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white disabled:opacity-60" /></label>
        <label className="block text-xs font-bold text-zinc-400">自己リプ（作品リンク）（{replyText.length}/280）<textarea disabled={!pending} maxLength={280} value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white disabled:opacity-60" /></label>
        {pending && <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={saveText} className={button}>本文を保存</button><button disabled={busy} onClick={() => copy(mainText, "本文")} className={button}>本文をコピー</button><button disabled={busy} onClick={() => copy(replyText, "自己リプ")} className={button}>自己リプをコピー</button><button disabled={busy} onClick={() => window.open(`https://x.com/compose/post?text=${encodeURIComponent(mainText)}`, "_blank", "noopener,noreferrer")} className={button}>X投稿画面を開く</button></div>}
        {pending && <p className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">公式HTTPSサンプル動画を手動で準備できます。投稿画面で @{account} にログインしていることを確認し、Xではセンシティブな内容として設定してください。</p>}
        {pending && <div className="flex flex-wrap items-end gap-2"><label className="min-w-60 flex-1 text-xs text-zinc-400">投稿後のX URL（任意）<input value={postUrl} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://x.com/.../status/..." className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label><button disabled={busy} onClick={() => run("posted", { xPostUrl: postUrl, mainText, replyText })} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-black">投稿済みにする</button><button disabled={busy} onClick={() => run("skip")} className={button}>スキップ</button></div>}
        {job.x_post_url && <a href={job.x_post_url} target="_blank" rel="noreferrer" className="block text-xs text-cyan-300">投稿URLを開く</a>}
        {message && <p className="whitespace-pre-wrap text-xs text-amber-200">{message}</p>}
      </div>
    </div>
  </article>;
}

export function AmateurXPostConsole() {
  const [accountInput, setAccountInput] = useState("");
  const [account, setAccount] = useState("");
  const [lane, setLane] = useState<Lane>("new_release");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handle = account.replace(/^@/, "").trim();
  const refresh = useCallback(async (nextPage = page, nextLane = lane, nextAccount = handle) => {
    if (!nextAccount) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/amateur-x-post?account=${encodeURIComponent(nextAccount)}&lane=${nextLane}&page=${nextPage}`, { credentials: "same-origin" });
      const body = await response.json() as Dashboard;
      if (!response.ok) throw new Error(body.error ?? "データを取得できませんでした。");
      setData(body); setPage(nextPage); setLane(nextLane); setAccount(nextAccount);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [handle, lane, page]);
  return <>
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <label className="block max-w-xl text-sm font-bold">投稿先Xアカウント<input value={accountInput} onChange={(event) => setAccountInput(event.target.value)} placeholder="例: hakkutsu_lab または @hakkutsu_lab" className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></label>
      <p className="mt-2 text-xs text-zinc-500">アカウントは候補の追加時に選べます。同じ作品でも別アカウントごとに管理します。</p>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void refresh(1, "new_release", accountInput.trim().replace(/^@/, ""))} disabled={loading || !accountInput.trim()} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-black text-white disabled:opacity-40">このアカウントで読み込む</button>{handle && <span className="self-center text-sm text-cyan-200">対象: @{handle}</span>}</div>
      {error && <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    </section>
    {account && <>
      <nav className="mt-6 flex flex-wrap gap-2"><button onClick={() => void refresh(1, "new_release")} className={`rounded-lg px-4 py-2 text-sm font-bold ${lane === "new_release" ? "bg-emerald-500 text-black" : "border border-zinc-700 text-zinc-300"}`}>直近7日分</button><button onClick={() => void refresh(1, "popular")} className={`rounded-lg px-4 py-2 text-sm font-bold ${lane === "popular" ? "bg-emerald-500 text-black" : "border border-zinc-700 text-zinc-300"}`}>人気動画TOP500</button><span className="self-center text-xs text-zinc-500">{lane === "popular" ? "DMM人気順・MP4確認済み作品を最大500件" : "JST直近7日間（今日を含む）・MP4確認済み作品。全アカウントの投稿済み・スキップ済みは除外"}</span></nav>
      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-black">候補作品</h2><span className="text-xs text-zinc-500">{loading ? "読み込み中…" : `${data?.total ?? 0}件`}</span></div><div className="space-y-3">{data?.candidates.map((item) => <CandidateCard key={item.content_id} item={item} lane={lane} handle={handle} refresh={() => void refresh()} />)}{!loading && !data?.candidates.length && <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">条件に合う作品はありません。人気順の上位500件でも、MP4未補完の作品は候補に表示しません。</p>}</div>{data?.hasMore && <div className="mt-4 text-center"><button disabled={loading} onClick={() => void refresh(page + 1)} className={button}>次の30件</button></div>}</section>
      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-black">@{handle} の投稿準備・履歴</h2><span className="text-xs text-zinc-500">直近100件</span></div><div className="space-y-4">{data?.jobs.map((job) => <JobCard key={job.id} job={job} account={handle} refresh={() => void refresh()} />)}{!data?.jobs.length && <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">このアカウントの投稿準備履歴はありません。</p>}</div></section>
      <p className="mt-4 text-xs leading-5 text-zinc-500">この機能は手動投稿用です。自動投稿は行いません。</p>
    </>}
  </>;
}

