'use client';

import { useState } from "react";
import type { RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { BijyoReservedWorkCard } from "./BijyoReservedWorkCard";
import { UPCOMING_RELEASE_INITIAL_LIMIT, UPCOMING_RELEASE_PAGE_SIZE, visibleUpcomingReleaseCount } from "./ui";

export function UpcomingBijyoReleases({ works }: { works: RecentReleaseWork[] }) {
  const [visibleCount, setVisibleCount] = useState(UPCOMING_RELEASE_INITIAL_LIMIT);
  const visibleWorks = works.slice(0, visibleUpcomingReleaseCount(works.length, visibleCount));
  const hasMore = visibleWorks.length < works.length;

  return <section id="upcoming-releases" className="mt-8 scroll-mt-6 rounded-2xl border border-emerald-800 bg-zinc-900 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">今日から1週間の発売予定作品</h2><p className="mt-1 text-sm text-zinc-400">今日から7日後までに発売予定の未追加作品です。Bijyoアカウントに追加済み・投稿済み・スキップ済み・除外済みの作品は除外しています。</p><p className="mt-1 text-xs text-zinc-500">手動追加は、公式サンプル動画があり、Bijyoアカウントで未追加・未投稿・未スキップ・未除外の作品が対象です。NEW/RESERVEDや登録日数による制限はありません。</p></div><span className="rounded-full border border-emerald-700 px-3 py-1 text-xs font-black text-emerald-200">{works.length}件</span></div>
    <div className="mt-4 grid gap-3">{visibleWorks.map((work) => <BijyoReservedWorkCard key={work.id} work={work} />)}</div>
    {!works.length && <p className="p-6 text-sm text-zinc-500">対象作品はありません。</p>}
    {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => current + UPCOMING_RELEASE_PAGE_SIZE)} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-950/50">もっと見る（残り{works.length - visibleWorks.length}件）</button></div>}
  </section>;
}
