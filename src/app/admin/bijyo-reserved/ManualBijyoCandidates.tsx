'use client';

import Link from "next/link";
import { useState } from "react";
import WorkImage from "@/components/home/WorkImage";
import { BijyoReservedActions } from "./BijyoReservedActions";
import { evaluateBijyoFutureOperation, type RecentReleaseWork, type ReleaseDateRange } from "@/lib/bijyoReservedWorkflow";
import { MANUAL_CANDIDATE_INITIAL_LIMIT, MANUAL_CANDIDATE_PAGE_SIZE, visibleManualCandidateCount } from "./ui";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function remaining(value: string, todayDate: string) {
  const releaseDay = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayDate}T00:00:00Z`);
  return Math.max(0, Math.round((releaseDay - today) / 86_400_000));
}

export function ManualBijyoCandidates({ candidates, dateRange }: { candidates: RecentReleaseWork[]; dateRange: ReleaseDateRange }) {
  const [visibleCount, setVisibleCount] = useState(MANUAL_CANDIDATE_INITIAL_LIMIT);
  const visibleCandidates = candidates.slice(0, visibleManualCandidateCount(candidates.length, visibleCount));
  const hasMore = visibleCandidates.length < candidates.length;

  return <details className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950">
    <summary className="cursor-pointer list-inside px-4 py-3 text-sm font-bold text-violet-200">追加候補を表示（{candidates.length}件）</summary>
    <div className="space-y-3 px-2 pb-2">{visibleCandidates.map((work) => { const eligibility = evaluateBijyoFutureOperation(work.stage, work.release_date, dateRange); return <article key={work.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"><div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-950 sm:w-48"><WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 160px, 192px" className="object-contain" /></div><div className="min-w-0 flex-1"><Link href={`/works/${work.id}`} target="_blank" className="line-clamp-2 font-bold text-cyan-300">{work.title}</Link><p className="mt-1 text-xs text-zinc-600">work_id: {work.id}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>登録日: {dateLabel(work.created_at)}</span><span>発売まで{remaining(work.release_date, dateRange.todayDate)}日</span><span>発売日: {work.release_date}</span></div></div><div className="shrink-0">{eligibility.eligible ? <BijyoReservedActions workId={work.id} /> : <span className="text-xs text-amber-300">追加不可: {eligibility.reason}</span>}</div></article>; })}{!candidates.length && <p className="p-6 text-sm text-zinc-500">現在、条件を満たす待機候補はありません。</p>}{hasMore && <div className="mt-4 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => current + MANUAL_CANDIDATE_PAGE_SIZE)} className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-black text-violet-200 hover:bg-violet-950/50">もっと見る（残り{candidates.length - visibleCandidates.length}件）</button></div>}</div>
  </details>;
}
