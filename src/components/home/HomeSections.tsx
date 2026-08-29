import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BadgePercent,
  Building2,
  Crown,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";
import type { Work } from "@/types/work";
import WorkImage from "./WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";
import SaleCountdown from "./SaleCountdown";

const formatNumber = (value: number) => new Intl.NumberFormat("ja-JP").format(value);
const salePrice = (work: Work) => work.sale_price > 0 ? work.sale_price : 0;
const displayPrice = (work: Work) => salePrice(work) || work.price;
const discountRate = (work: Work) => {
  if (work.discount_rate > 0) return Math.round(work.discount_rate);
  if (work.price > 0 && salePrice(work) > 0 && salePrice(work) < work.price) {
    return Math.round((1 - salePrice(work) / work.price) * 100);
  }
  return 0;
};

export function StatStrip({
  totalWorks,
  todayUpdates,
  saleWorks,
  aiInsights,
}: {
  totalWorks: number;
  todayUpdates: number;
  saleWorks: number;
  aiInsights: number;
}) {
  const stats = [
    ["発掘作品数", totalWorks, "作品", "text-pink-600"],
    ["今日の更新", todayUpdates, "件", "text-blue-600"],
    ["セール中の作品", saleWorks, "作品", "text-emerald-600"],
    ["AI発掘インサイト", aiInsights, "件", "text-violet-600"],
  ];

  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="mx-auto -mt-1 grid max-w-[1500px] grid-cols-2 gap-3 rounded-b-[28px] border border-t-0 border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
        {stats.map(([label, value, unit, color]) => (
          <div key={String(label)} className="rounded-xl border border-slate-100 px-3 py-4 text-center">
            <p className="text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
            <p className={`mt-1 text-xl font-black sm:text-2xl ${color}`}>
              {formatNumber(Number(value))}<span className="ml-1 text-xs text-slate-600">{unit}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SaleSection({ works }: { works: Work[] }) {
  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">SALE DISCOVERY</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">セール中のおすすめ作品</h2>
        </div>
        <Link href="/sale" className="shrink-0 text-sm font-black text-pink-700 hover:underline">もっと見る →</Link>
      </div>
      {works.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {works.map((work) => (
            <Link key={work.id} href={workDetailHref(work.id, "home")} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-100">
                <WorkImage src={work.image_url} alt={work.title} className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 768px) 45vw, 300px" />
                <span className="absolute left-2 top-2 rounded-md bg-pink-600 px-2 py-1 text-[11px] font-black text-white">SALE</span>
                {discountRate(work) > 0 && <span className="absolute bottom-2 right-2 rounded-full bg-pink-600 px-2 py-1 text-xs font-black text-white">{discountRate(work)}%OFF</span>}
              </div>
              <h3 className="mt-3 line-clamp-2 h-10 text-sm font-bold leading-5">{work.title}</h3>
              <div className="mt-2 min-h-12">
                {salePrice(work) > 0 && work.price > salePrice(work) && <p className="text-xs font-bold text-slate-600 line-through">通常 ¥{formatNumber(work.price)}</p>}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-lg font-black text-pink-600">{displayPrice(work) > 0 ? `¥${formatNumber(displayPrice(work))}` : "価格未取得"}</p>
                  <SaleCountdown saleEndAt={work.sale_end_at} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">セール作品を取得中です。</div>
      )}
    </section>
  );
}

export function CategorySection() {
  const categories = [
    ["女優", "/actress", UserRound, "text-violet-600"],
    ["ジャンル", "/genre", Tags, "text-blue-600"],
    ["メーカー", "/maker", Building2, "text-cyan-600"],
    ["シリーズ", "/series", BookOpen, "text-emerald-600"],
    ["新作", "/new", Sparkles, "text-fuchsia-600"],
    ["ランキング", "/ranking", Crown, "text-amber-500"],
  ] as const;

  return (
    <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-black sm:text-3xl">人気のカテゴリ</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map(([label, href, Icon, color]) => (
          <Link key={href} href={href} className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 font-black shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
            <Icon className={color} size={30} strokeWidth={2.4} />
            <span className="mt-3">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RevenuePathSection() {
  const paths = [
    ["今日の買い時", "/price-insights", BadgePercent, "買い時スコアと価格推移で、今チェックする理由がある作品へ。", "text-rose-600"],
    ["今日の発掘", "/discovery", Sparkles, "埋もれ名作や値下げ候補から、まだ見つかっていない一本へ。", "text-amber-600"],
    ["女優別おすすめ", "/actress", UserRound, "女優名からおすすめ作品・セール・埋もれ名作BEST10へ。", "text-fuchsia-600"],
    ["ジャンル別おすすめ", "/genre", Tags, "ジャンルごとのBEST10から、好みに近い作品へ進めます。", "text-blue-600"],
  ] as const;

  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">BUYING PATHS</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">目的別に今見る作品へ</h2>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {paths.map(([label, href, Icon, detail, color]) => (
          <Link key={href} href={href} className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
            <Icon className={color} size={26} strokeWidth={2.4} />
            <h3 className="mt-4 text-base font-black">{label}</h3>
            <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{detail}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-pink-700">見る <ArrowRight size={14} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
