import Link from "next/link";
import type { Work } from "@/types/work";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";

export function SaleSection({
  works,
  priceInsightsByWorkId,
}: {
  works: Work[];
  priceInsightsByWorkId?: ReadonlyMap<number, HomePriceInsightWork>;
}) {
  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">SALE RANKING</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">セールの人気順</h2>
        </div>
        <Link href="/sale" className="shrink-0 text-sm font-black text-pink-700 hover:underline">もっと見る →</Link>
      </div>
      {works.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {works.map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="home" insight={priceInsightsByWorkId?.get(work.id)} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">セール作品を取得中です。</div>
      )}
    </section>
  );
}

export function NewSection({
  works,
}: {
  works: Work[];
  priceInsightsByWorkId?: ReadonlyMap<number, HomePriceInsightWork>;
}) {
  return (
    <section className="mx-auto mt-10 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">NEW RELEASES</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">新着作品</h2>
        </div>
        <Link href="/new" className="shrink-0 text-sm font-black text-pink-700 hover:underline">もっと見る →</Link>
      </div>
      {works.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {works.slice(0, 12).map((work) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="new" showChart={false} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">新着作品を取得中です。</div>
      )}
    </section>
  );
}
