'use client';

import Link from "next/link";
import { useState } from "react";
import WorkImage from "@/components/home/WorkImage";
import { BijyoReservedActions } from "./BijyoReservedActions";
import { type RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { MANUAL_CANDIDATE_PAGE_SIZE } from "./ui";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ManualBijyoCandidates({ candidates: initialCandidates, candidateTotal, candidateHasMore: initialHasMore }: { candidates: RecentReleaseWork[]; candidateTotal: number; candidateHasMore: boolean }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/bijyo-reserved?candidatePage=${page + 1}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("候補を取得できませんでした。");
      const data = await response.json() as { candidates?: RecentReleaseWork[]; candidateHasMore?: boolean };
      setCandidates((current) => [...current, ...(data.candidates ?? [])]);
      setPage((current) => current + 1);
      setHasMore(data.candidateHasMore === true);
    } finally {
      setLoading(false);
    }
  }

  return <details className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950">
    <summary className="cursor-pointer list-inside px-4 py-3 text-sm font-bold text-violet-200">追加候補を表示（{candidateTotal}件）</summary>
    <div className="space-y-3 px-2 pb-2">{candidates.map((work) => <article key={work.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"><div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-950 sm:w-48"><WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 160px, 192px" className="object-contain" /></div><div className="min-w-0 flex-1"><Link href={`/works/${work.id}`} target="_blank" className="line-clamp-2 font-bold text-cyan-300">{work.title}</Link><p className="mt-1 text-xs text-zinc-600">work_id: {work.id}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>登録日: {dateLabel(work.created_at)}</span><span>発売日: {work.release_date}</span></div></div><div className="shrink-0"><BijyoReservedActions workId={work.id} /></div></article>)}{!candidates.length && <p className="p-6 text-sm text-zinc-500">現在、条件を満たす待機候補はありません。</p>}{hasMore && <div className="mt-4 flex justify-center"><button type="button" onClick={loadMore} disabled={loading} className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-black text-violet-200 hover:bg-violet-950/50">{loading ? "読み込み中…" : `次の${MANUAL_CANDIDATE_PAGE_SIZE}件を表示`}</button></div>}</div>
  </details>;
}
