import Link from "next/link";
import type { Work } from "@/types/work";
import { workDetailHref } from "@/lib/affiliateTracking";
import WorkImage from "@/components/home/WorkImage";
import SaleCountdown from "@/components/home/SaleCountdown";
import MiniPriceHistoryChart from "@/components/home/MiniPriceHistoryChart";
import AffiliateLink from "@/app/components/AffiliateLink";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";

const priceOf = (work: Work) => work.sale_price > 0 ? work.sale_price : work.price;
const releaseDateOf = (work: Work) => {
  const value = work.release_date ?? work.product_release_date;
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : value;
};
const discountRateOf = (work: Work) => work.discount_rate > 0
  ? Math.round(work.discount_rate)
  : work.price > 0 && work.sale_price > 0 && work.sale_price < work.price
    ? Math.round((1 - work.sale_price / work.price) * 100)
    : 0;
const splitValues = (value: string | null) => value?.split(" / ").map((item) => item.trim()).filter(Boolean) ?? [];
const tagsOf = (work: Work) => {
  const actresses = splitValues(work.actress);
  const genres = splitValues(work.genre);
  return actresses.length === 1
    ? [{ label: actresses[0], href: `/actress/${encodeURIComponent(actresses[0])}` }, ...genres.slice(0, 3).map((genre) => ({ label: genre, href: `/genre/${encodeURIComponent(genre)}` }))]
    : genres.slice(0, 4).map((genre) => ({ label: genre, href: `/genre/${encodeURIComponent(genre)}` }));
};

export default function FanzaStyleWorkCard({ work, sourcePage = "direct", insight, rank, compact = false, showChart = true, dark = false }: { work: Work; sourcePage?: "home" | "ranking" | "sale" | "search" | "new" | "direct"; insight?: HomePriceInsightWork; rank?: number; compact?: boolean; showChart?: boolean; dark?: boolean }) {
  const price = priceOf(work);
  const isSale = work.sale_price > 0 && work.price > work.sale_price;
  const discountRate = discountRateOf(work);
  return (
    <article className={`group flex h-full min-w-0 flex-col rounded-2xl border p-2.5 shadow-sm transition hover:-translate-y-1 ${dark ? "border-zinc-800 bg-zinc-900 hover:border-pink-500" : "border-slate-200 bg-white hover:border-pink-200 hover:shadow-lg"} ${compact ? "sm:p-2" : "sm:p-3"}`}>
      <div className="min-w-0">
        <div className={`relative -mx-2.5 -mt-2.5 aspect-[4/3] overflow-hidden rounded-t-2xl sm:-mx-3 sm:-mt-3 ${dark ? "bg-zinc-950" : "bg-slate-100"}`}>
          <Link href={workDetailHref(work.id, sourcePage)} className="absolute inset-0">
            <WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 45vw, (max-width: 1280px) 22vw, 240px" className="object-cover transition duration-300 group-hover:scale-105" />
          </Link>
          <FavoriteButton workId={work.id} iconOnly className={`absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none shadow-sm transition ${dark ? "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-pink-400" : "bg-white/90 text-slate-700 hover:bg-white hover:text-pink-600"}`} />
          {rank != null && <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-black text-slate-900 shadow-sm">{rank}位</span>}
          {isSale && discountRate > 0 && <span className="absolute bottom-2 left-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-black text-white shadow-sm">{discountRate}%OFF</span>}
        </div>
        <h3 className={`mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5 ${dark ? "text-white" : "text-slate-900"}`}>{work.title}</h3>
        {releaseDateOf(work) && <p className={`mt-1 text-[11px] font-bold ${dark ? "text-zinc-500" : "text-slate-500"}`}>発売日：{releaseDateOf(work)}</p>}
        <div className="mt-1 flex min-h-11 max-h-11 min-w-0 content-start flex-wrap gap-1 overflow-hidden">
          {tagsOf(work).map((tag) => <Link key={tag.href} href={tag.href} className={`max-w-full truncate rounded-md px-1.5 py-1 text-[10px] font-bold transition ${dark ? "bg-zinc-800 text-zinc-400 hover:bg-pink-950 hover:text-pink-300" : "bg-slate-100 text-slate-600 hover:bg-pink-100 hover:text-pink-700"}`}>{tag.label}</Link>)}
        </div>
      </div>
      <div className={`mt-3 flex min-h-[56px] items-end justify-between gap-2 border-t pt-2 ${dark ? "border-zinc-800" : "border-slate-100"}`}>
        <div className="min-w-0">
          {isSale && <p className="text-[10px] font-bold text-slate-400 line-through">¥{work.price.toLocaleString("ja-JP")}</p>}
          <p className={`text-base font-black ${isSale ? "text-pink-500" : dark ? "text-white" : "text-slate-900"}`}>{price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}</p>
        </div>
        {work.sale_end_at && <SaleCountdown saleEndAt={work.sale_end_at} />}
      </div>
      <div className={`mt-2 flex min-h-5 items-center justify-between text-[11px] font-bold ${dark ? "text-zinc-500" : "text-slate-500"}`}><span className="text-amber-500">★ {work.review_average > 0 ? work.review_average.toFixed(1) : "-"}</span><span>({work.review_count ?? 0})</span></div>
      {showChart && insight && <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"><MiniPriceHistoryChart points={insight.priceHistory} windowStartAt={insight.priceWindowStartAt} windowEndAt={insight.priceWindowEndAt} lowPrice={insight.low90Price} currentPrice={insight.currentPrice} variant="compact" /></div>}
      <div className="mt-auto flex flex-col gap-1.5 pt-2"><>{work.affiliate_url ? <AffiliateLink href={work.affiliate_url} workId={work.id} placement="listing-card" sourcePage={sourcePage} className="flex min-h-9 w-full items-center justify-center rounded-lg bg-pink-600 px-2 text-[11px] font-black text-white hover:bg-pink-700">FANZAで見る</AffiliateLink> : <span className={`flex min-h-9 w-full items-center justify-center rounded-lg px-2 text-[11px] font-black ${dark ? "bg-zinc-800 text-zinc-500" : "bg-slate-100 text-slate-400"}`}>FANZAで見る</span>}</><Link href={workDetailHref(work.id, sourcePage)} className={`flex min-h-8 w-full items-center justify-center rounded-lg border px-2 text-[10px] font-black ${dark ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-pink-200 text-pink-700 hover:bg-pink-50"}`}>詳細を見る</Link></div>
    </article>
  );
}
