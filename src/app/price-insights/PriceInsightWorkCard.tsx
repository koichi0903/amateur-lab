import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AffiliateLink from "@/app/components/AffiliateLink";
import MiniPriceHistoryChart from "@/components/home/MiniPriceHistoryChart";
import WorkImage from "@/components/home/WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";

function formatPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "確認中";
}

function primaryReasons(reasons: string[]) {
  return reasons.slice(0, 2);
}

function insightBadgeTone(badge: string) {
  if (badge === "急落") return "bg-blue-50 text-blue-700";
  if (badge === "過去最安" || badge === "90日安値") return "bg-emerald-50 text-emerald-700";
  if (badge === "価格上昇") return "bg-amber-50 text-amber-700";
  return "bg-pink-50 text-pink-700";
}

function buyTimingLabel(score: number) {
  return score >= 82 ? "今買う価値が高い" : score >= 68 ? "条件が合えば買い" : "もう少し比較したい";
}

function priceInsightReasons(work: HomePriceInsightWork, discountRate: number) {
  return primaryReasons([
    discountRate >= 45 ? `${discountRate}%OFFで割引幅が大きい` : "",
    work.badge === "過去最安" ? "過去最安値クラスの価格" : "",
    work.peak90Price > work.currentPrice ? "過去90日の価格推移を確認" : "",
  ].filter(Boolean));
}

function PriceInsightBadges({ work, label }: { work: HomePriceInsightWork; label: string }) {
  const insight = work;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-700">判断 {work.buyScore}/100</span>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{label}</span>
      {insight && <span className={`rounded-full px-3 py-1 text-xs font-black ${insightBadgeTone(insight.badge)}`}>{insight.badge}</span>}
    </div>
  );
}

function PriceInsightCurrentPrice({
  work,
  regularPrice,
  discountRate,
}: {
  work: HomePriceInsightWork;
  regularPrice: number | null;
  discountRate: number;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-2xl font-black text-pink-600">{formatPrice(work.currentPrice)}</span>
      {regularPrice && work.currentPrice && regularPrice > work.currentPrice && <span className="text-sm font-bold text-slate-400 line-through">{formatPrice(regularPrice)}</span>}
      {discountRate > 0 && <span className="text-sm font-black text-red-600">{discountRate}%OFF</span>}
    </div>
  );
}

function PriceInsightLowPrice({ work }: { work: HomePriceInsightWork }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold leading-5">
      <span className="text-amber-700">
        {work.currentPrice <= work.low90Price
          ? "過去最安値と同額または更新"
          : `過去最安値より¥${Math.max(0, work.currentPrice - work.low90Price).toLocaleString("ja-JP")}高い`}
      </span>
      <span className="text-emerald-700">90日最安 {formatPrice(work.low90Price)}</span>
    </div>
  );
}

function PriceInsightReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {reasons.map((reason) => <span key={reason} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700">{reason}</span>)}
    </div>
  );
}

function PriceInsightHistory({ work }: { work: HomePriceInsightWork }) {
  const insight = work;
  if (!insight || insight.priceHistory.length < 2) return null;
  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5 sm:px-3">
      <MiniPriceHistoryChart
        points={insight.priceHistory}
        windowStartAt={insight.priceWindowStartAt}
        windowEndAt={insight.priceWindowEndAt}
        lowPrice={insight.low90Price}
        currentPrice={insight.currentPrice}
        variant="main"
      />
    </div>
  );
}

function PriceInsightActions({ work }: { work: HomePriceInsightWork }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] font-bold leading-5 text-slate-500">TOPと同じ買い時スコア・価格履歴で表示</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={workDetailHref(work.id, "price-report")} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-4 text-sm font-black text-pink-700 transition hover:bg-pink-100">
          価格と理由を見る <ArrowRight size={16} />
        </Link>
        {work.affiliate_url && (
          <AffiliateLink
            href={work.affiliate_url}
            workId={work.id}
            placement="listing-card"
            sourcePage="price-report"
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-pink-600 px-4 text-sm font-black text-white transition hover:bg-pink-700"
          >
            FANZAで見る
          </AffiliateLink>
        )}
      </div>
    </div>
  );
}

export default function PriceInsightWorkCard({ work, index }: { work: HomePriceInsightWork; index: number }) {
  const insight = work;
  const discountRate = Math.max(0, Math.round(work.discount_rate ?? 0));
  const regularPrice = work.previousPrice ?? work.list_price ?? work.price;
  const label = buyTimingLabel(work.buyScore);
  const reasons = priceInsightReasons(work, discountRate);

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
      <div className="flex gap-4">
        <Link href={workDetailHref(work.id, "price-report")} className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-40 sm:w-36">
          <WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 112px, 144px" className="object-cover transition duration-300 group-hover:scale-105" />
          <span className="absolute left-2 top-2 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-black text-white">{index + 1}位</span>
        </Link>
        <div className="min-w-0 flex-1">
          <PriceInsightBadges work={work} label={label} />
          <h2 className="mt-3 line-clamp-2 break-all text-base font-black leading-6 sm:text-lg">
            <Link href={workDetailHref(work.id, "price-report")} className="hover:text-pink-600">{work.title}</Link>
          </h2>
          <PriceInsightCurrentPrice work={work} regularPrice={regularPrice} discountRate={discountRate} />
          <PriceInsightLowPrice work={work} />
          <PriceInsightReasons reasons={reasons} />
        </div>
      </div>
      <PriceInsightHistory work={insight} />
      <PriceInsightActions work={work} />
    </article>
  );
}
