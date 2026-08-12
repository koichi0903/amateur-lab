import Link from "next/link";
import type { Work } from "@/types/work";
import WorkImage from "../WorkImage";

const medals = ["🥇", "🥈", "🥉"];

const saleDetails = (work: Work) => {
  const salePrice = work.sale_price > 0 ? work.sale_price : 0;
  const regularPrice = work.list_price && work.list_price > salePrice
    ? work.list_price
    : work.price;
  const isSale = salePrice > 0 && regularPrice > salePrice;
  const rate = isSale
    ? Math.round(work.discount_rate > 0
      ? work.discount_rate
      : (1 - salePrice / regularPrice) * 100)
    : 0;

  return { isSale, rate, regularPrice, salePrice };
};

export default function RankingSection({ works }: { works: Work[] }) {
  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-600">AI SCORE RANKING</p>
          <h2 className="mt-2 text-[1.35rem] font-black leading-tight sm:text-3xl">発掘スコアランキング TOP10</h2>
        </div>
        <Link href="/ranking" className="shrink-0 text-sm font-black text-pink-600 hover:underline">もっと見る →</Link>
      </div>

      {works.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {works.map((work, index) => {
            const sale = saleDetails(work);
            return (
            <Link key={work.id} href={`/works/${work.id}`} className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-3">
              <div className="flex h-8 items-center justify-between">
                <span className="text-xl font-black text-slate-700">{medals[index] ?? `${index + 1}位`}</span>
                <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-black text-pink-600">SCORE</span>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                <WorkImage src={work.image_url} alt={work.title} className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px" />
                {sale.isSale && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-black text-white shadow-sm sm:text-xs">
                    {sale.rate}%OFF
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-black leading-none text-pink-600">{work.score > 0 ? work.score : "-"}</p>
              <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5">{work.title}</h3>
              <div className="mt-3 min-h-10 border-t border-slate-100 pt-2">
                {sale.isSale ? (
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="whitespace-nowrap text-[10px] font-bold text-slate-400 line-through sm:text-xs">
                      ¥{sale.regularPrice.toLocaleString("ja-JP")}
                    </span>
                    <span className="whitespace-nowrap text-sm font-black text-rose-600 sm:text-base">
                      ¥{sale.salePrice.toLocaleString("ja-JP")}
                    </span>
                  </div>
                ) : (
                  <p className="whitespace-nowrap text-xs font-black sm:text-sm">
                    {work.price > 0 ? `¥${work.price.toLocaleString("ja-JP")}` : "価格未取得"}
                  </p>
                )}
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ランキングを集計中です。</div>
      )}
    </section>
  );
}
