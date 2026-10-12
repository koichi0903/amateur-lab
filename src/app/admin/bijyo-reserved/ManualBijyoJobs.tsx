"use client";

import Link from "next/link";
import { useState } from "react";
import type { getBijyoManualJobsPage } from "@/lib/bijyoManualJobs";
import { appendUniqueById } from "@/lib/bijyoPagination";
import { BijyoReservedActions } from "./BijyoReservedActions";

type ManualJob = Awaited<ReturnType<typeof getBijyoManualJobsPage>>["jobs"][number];
type ManualPage = Awaited<ReturnType<typeof getBijyoManualJobsPage>>;

const STATUS_LABELS: Record<string, string> = { pending: "未投稿", trim_failed: "投稿処理エラー" };
const TRIM_STATUS_LABELS: Record<string, string> = { not_ready: "動画未準備", preparing: "動画準備中", ready: "動画準備済み", trim_failed: "動画準備失敗" };

function ManualJobCard({ job }: { job: ManualJob }) {
  const work = job.work;
  if (!work) return null;
  return <article className="rounded-xl border border-violet-800 bg-violet-950/10 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-200">手動追加</span><span className="text-sm font-black text-cyan-200">{STATUS_LABELS[job.status] ?? job.status} ・ {TRIM_STATUS_LABELS[job.trim_status] ?? job.trim_status}</span></div><div className="mt-4"><Link href={`/works/${work.id}`} target="_blank" className="text-lg font-black text-cyan-300">{work.title}</Link><p className="mt-2 text-xs text-zinc-500">work_id: {work.id} / trim開始位置: {Number(job.trim_start_seconds).toFixed(1)}秒</p><div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3"><p className="whitespace-pre-wrap text-sm font-bold">{job.main_text}</p><p className="mt-2 whitespace-pre-wrap text-xs text-violet-200">{job.reply_text}</p></div></div><div className="mt-4"><BijyoReservedActions jobId={job.id} workId={work.id} mainText={job.main_text} replyText={job.reply_text} status={job.status} sampleMovieUrl={work.sample_movie_url} trimStartSeconds={job.trim_start_seconds} /></div></article>;
}

export function ManualBijyoJobs({ initialPage }: { initialPage: ManualPage }) {
  const [jobs, setJobs] = useState(initialPage.jobs);
  const [page, setPage] = useState(initialPage.page);
  const [total, setTotal] = useState(initialPage.total);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialPage.error ?? "");

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/bijyo-reserved/manual-jobs?page=${page + 1}`, { credentials: "same-origin" });
      const data = await response.json() as ManualPage;
      if (!response.ok || data.error) throw new Error(data.error ?? "手動投稿待ちを取得できませんでした。");
      setJobs((current) => appendUniqueById(current, data.jobs));
      setPage(data.page);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  return <section id="manual" className="mt-8 scroll-mt-20 rounded-2xl border border-violet-800 bg-zinc-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">手動追加した投稿</h2><p className="mt-1 text-sm text-zinc-400">選択して手動追加したBijyoジョブです。投稿待ちは作成順で20件ずつ表示します。</p></div><span className="rounded-full border border-violet-700 px-3 py-1 text-xs font-black text-violet-200">{jobs.length}/{total}件表示</span></div><div className="mt-4 grid gap-5">{jobs.map((job) => <ManualJobCard key={job.id} job={job} />)}</div>{!jobs.length && !error && <p className="rounded-lg border border-dashed border-violet-900 p-5 text-sm text-zinc-500">手動追加した作品はありません。</p>}{error && <p role="alert" className="mt-4 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}{hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={loadMore} disabled={loading} className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-black text-violet-200 hover:bg-violet-950/50 disabled:opacity-50">{loading ? "読み込み中…" : `もっと見る（残り${Math.max(0, total - jobs.length)}件）`}</button></div>}</section>;
}