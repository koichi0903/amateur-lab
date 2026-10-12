"use client";

import { useState } from "react";
import type { RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { BijyoReservedWorkCard } from "./BijyoReservedWorkCard";
import { BIJYO_RESERVED_PAGE_SIZE as BIJYO_RESERVED_QUEUE_PAGE_SIZE } from "@/lib/bijyoPagination";

export function ReservedBijyoWorks({ initialWorks, initialHasMore }: { initialWorks: RecentReleaseWork[]; initialHasMore: boolean }) {
  const [works, setWorks] = useState(initialWorks);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/bijyo-reserved?reservedPage=${page + 1}`, { credentials: "same-origin" });
      const data = await response.json() as { error?: string; reservedWorks?: RecentReleaseWork[]; reservedHasMore?: boolean };
      if (!response.ok || data.error) throw new Error(data.error ?? "予約作品を取得できませんでした。");
      const nextWorks = data.reservedWorks ?? [];
      setWorks((current) => [...current, ...nextWorks.filter((work) => !current.some((loaded) => loaded.id === work.id))]);
      setPage((current) => current + 1);
      setHasMore(data.reservedHasMore === true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  return <section id="reserved-works" className="mt-8 scroll-mt-6 rounded-2xl border border-emerald-800 bg-zinc-900 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">予約作品一覧</h2><p className="mt-1 text-sm text-zinc-400">発売前のRESERVED作品から、公式サンプル動画があり、Bijyoジョブに未登録の作品を発売日順で表示します。</p></div><span className="rounded-full border border-emerald-700 px-3 py-1 text-xs font-black text-emerald-200">{works.length}{hasMore ? "件以上" : "件"}</span></div>
    <div className="mt-4 grid gap-3">{works.map((work) => <BijyoReservedWorkCard key={work.id} work={work} />)}</div>
    {!works.length && <p className="p-6 text-sm text-zinc-500">対象作品はありません。</p>}
    {error && <p role="alert" className="mt-4 rounded border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
    {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={loadMore} disabled={loading} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50">{loading ? "読み込み中…" : `もっと見る（次の${BIJYO_RESERVED_QUEUE_PAGE_SIZE}件）`}</button></div>}
  </section>;
}
