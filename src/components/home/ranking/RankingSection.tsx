import Link from "next/link";
import type { Work } from "@/types/work";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";

export default function RankingSection({
  works,
  priceInsightsByWorkId,
  title = "注目ランキング",
  moreHref = "/ranking",
  eyebrow = "順位 × 前回観測比 × レビュー",
}: {
  works: Work[];
  priceInsightsByWorkId?: ReadonlyMap<number, HomePriceInsightWork>;
  title?: string;
  moreHref?: string;
  eyebrow?: string;
}) {
  return (
    <section className="mx-auto mt-10 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">{eyebrow}</p>
          <h2 className="mt-2 text-[1.35rem] font-black leading-tight sm:text-3xl">{title}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">FANZA順位・前回観測からの上昇幅・レビュー数で選定</p>
        </div>
        <Link href={moreHref} className="shrink-0 text-sm font-black text-pink-700 hover:underline">もっと見る →</Link>
      </div>
      {works.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {works.map((work, index) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="home" itemListName={title === "注目ランキング" ? "home-ranking" : title === "VR人気ランキング" ? "home-vr-ranking" : "home-ranking"} rank={index + 1} insight={priceInsightsByWorkId?.get(work.id)} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">作品を取得中です。</div>
      )}
    </section>
  );
}
