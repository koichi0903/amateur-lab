'use client';

import Link from "next/link";
import { useState } from "react";
import WorkImage from "@/components/home/WorkImage";
import type { RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { BijyoReservedActions } from "./BijyoReservedActions";
import { UPCOMING_RELEASE_INITIAL_LIMIT, UPCOMING_RELEASE_PAGE_SIZE, visibleUpcomingReleaseCount } from "./ui";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RecentReleasedCard({ work }: { work: RecentReleaseWork }) {
  return <article className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-900"><WorkImage src={work.image_url} alt={work.title} sizes="64px" /></div>
    <div className="min-w-0 flex-1"><Link href={`/works/${work.id}`} target="_blank" className="line-clamp-2 font-black text-cyan-300">{work.title}</Link><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>work_id: <strong className="text-white">{work.id}</strong></span><span>発売日: <strong className="text-white">{work.release_date}</strong></span><span>登録日: <strong className="text-white">{dateLabel(work.created_at)}</strong></span><span>sample video: <strong className="text-emerald-300">あり</strong></span></div></div>
    <div className="flex shrink-0 items-center gap-3"><span className="rounded-full border border-emerald-700 px-2.5 py-1 text-xs font-bold text-emerald-200">未投稿</span><BijyoReservedActions workId={work.id} manualLabel="手動追加" /></div>
  </article>;
}

export function UpcomingBijyoReleases({ works }: { works: RecentReleaseWork[] }) {
  const [visibleCount, setVisibleCount] = useState(UPCOMING_RELEASE_INITIAL_LIMIT);
  const visibleWorks = works.slice(0, visibleUpcomingReleaseCount(works.length, visibleCount));
  const hasMore = visibleWorks.length < works.length;

  return <section id="upcoming-releases" className="mt-8 scroll-mt-6 rounded-2xl border border-emerald-800 bg-zinc-900 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">今後1週間の発売予定作品</h2><p className="mt-1 text-sm text-zinc-400">今後7日以内に発売予定の未投稿作品です。投稿済み・スキップ済みは除外しています。</p></div><span className="rounded-full border border-emerald-700 px-3 py-1 text-xs font-black text-emerald-200">{works.length}件</span></div>
    <div className="mt-4 grid gap-3">{visibleWorks.map((work) => <RecentReleasedCard key={work.id} work={work} />)}</div>
    {!works.length && <p className="p-6 text-sm text-zinc-500">対象作品はありません。</p>}
    {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => current + UPCOMING_RELEASE_PAGE_SIZE)} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-950/50">もっと見る（残り{works.length - visibleWorks.length}件）</button></div>}
  </section>;
}
