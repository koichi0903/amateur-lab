import Link from "next/link";
import { getBijyoDashboard } from "@/lib/bijyoReservedAutoPost";
import { BijyoHistory } from "./BijyoHistory";
import { BijyoReservedActions } from "./BijyoReservedActions";
import { ManualBijyoCandidates } from "./ManualBijyoCandidates";
import { UpcomingBijyoReleases } from "./UpcomingBijyoReleases";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = { pending: "未投稿", posted: "投稿済み", manual_posted: "投稿済み（手動）", skipped: "スキップ", excluded: "対象外", trim_failed: "trimエラー" };

function previewUrl(jobId: number, workId: number) { return `/api/admin/bijyo-reserved/video?jobId=${jobId}&workId=${workId}&preview=1`; }
function previewSource(job: { id: number; work_id: number; trim_status: string; }, sampleMovieUrl: string) { return job.trim_status === "ready" ? previewUrl(job.id, job.work_id) : sampleMovieUrl; }

function ManualJobCard({ job }: { job: Awaited<ReturnType<typeof getBijyoDashboard>>["jobs"][number] }) {
  const work = job.work;
  if (!work) return null;
  return <article className="rounded-xl border border-violet-800 bg-violet-950/10 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-200">手動追加</span><span className="text-sm font-black text-cyan-200">{STATUS_LABELS[job.status] ?? job.status}</span></div><div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]"><div><video controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" src={previewSource(job, work.sample_movie_url)}><track kind="captions" /></video><p className="mt-2 text-xs text-zinc-500">{job.trim_status === "ready" ? "trim済みpreview" : "元動画preview（trim未生成）"}</p></div><div><Link href={`/works/${work.id}`} target="_blank" className="text-lg font-black text-cyan-300">{work.title}</Link><p className="mt-2 text-xs text-zinc-500">work_id: {work.id} / trim: {Number(job.trim_start_seconds).toFixed(1)}秒 / {job.trim_status}</p><div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3"><p className="whitespace-pre-wrap text-sm font-bold">{job.main_text}</p><p className="mt-2 whitespace-pre-wrap text-xs text-violet-200">{job.reply_text}</p></div></div></div><div className="mt-4"><BijyoReservedActions jobId={job.id} workId={work.id} mainText={job.main_text} replyText={job.reply_text} status={job.status} sampleMovieUrl={work.sample_movie_url} trimStartSeconds={job.trim_start_seconds} /></div></article>;
}

export default async function BijyoReservedPage() {
  const dashboard = await getBijyoDashboard();
  return <main className="min-h-screen bg-zinc-950 p-6 text-white md:p-10"><div className="mx-auto max-w-7xl"><Link href="/admin" className="text-sm text-cyan-300">← ADMIN</Link><div className="mt-4"><p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">手動投稿司令塔</p><h1 className="mt-2 text-4xl font-black">@bijyo1010 予約作品 手動投稿</h1><p className="mt-2 text-zinc-400">動画・本文・自己リプを準備して、あなたがXへ手動投稿します。</p></div>
    <nav aria-label="セクション内リンク" className="sticky top-2 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 text-sm shadow-lg shadow-black/20"><a href="#manual" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">手動追加</a><a href="#upcoming-releases" className="rounded-lg px-3 py-2 text-emerald-200 hover:bg-emerald-950/50">今日から1週間</a><a href="#history" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">履歴</a></nav>
    {dashboard.error && <p className="mt-6 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">データを取得できませんでした: {dashboard.error}</p>}
    <section id="manual" className="mt-8 scroll-mt-20 rounded-2xl border border-violet-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">手動追加投稿</h2><p className="mt-1 text-sm text-zinc-400">選択済みの手動追加作品です。</p><div className="mt-4 grid gap-5">{dashboard.manualJobs.map((job) => <ManualJobCard key={job.id} job={job} />)}</div>{!dashboard.manualJobs.length && <p className="rounded-lg border border-dashed border-violet-900 p-5 text-sm text-zinc-500">選択済みの手動追加作品はありません。</p>}<ManualBijyoCandidates candidates={dashboard.candidates} dateRange={dashboard.recentReleaseDateRange} /></section>
    <UpcomingBijyoReleases works={dashboard.recentReleased} />
    <section id="history" className="mt-8 scroll-mt-20 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">投稿済み履歴</h2><BijyoHistory initialJobs={dashboard.jobs} initialHasMore={dashboard.historyHasMore} /></section>
  </div></main>;
}
