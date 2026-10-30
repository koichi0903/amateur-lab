import type { Work } from "@/types/work";
import { parseDatabaseDate } from "@/lib/dateTime";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import {
  FanzaStyleWorkCardActions,
  FanzaStyleWorkCardArtwork,
  FanzaStyleWorkCardDetails,
  FanzaStyleWorkCardPrice,
} from "./FanzaStyleWorkCardParts";

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

export default function FanzaStyleWorkCard({ work, sourcePage = "direct", itemListName, insight, rank, compact = false, showChart = true, dark = false }: { work: Work; sourcePage?: AffiliateSource; itemListName?: string; insight?: HomePriceInsightWork; rank?: number; compact?: boolean; showChart?: boolean; dark?: boolean }) {
  const saleEndAt = parseDatabaseDate(work.sale_end_at)?.getTime();
  // Request-time expiry keeps server-rendered cards from advertising ended sales.
  // eslint-disable-next-line react-hooks/purity
  const saleNotExpired = !work.sale_end_at || (saleEndAt != null && saleEndAt > Date.now());
  const isSale = work.sale_price > 0 && work.price > work.sale_price && saleNotExpired;
  const price = isSale ? work.sale_price : work.price;
  const discountRate = discountRateOf(work);
  const selectionListName = itemListName ?? sourcePage;
  const releaseDate = releaseDateOf(work);
  const tags = tagsOf(work);
  return (
    <article className={`group flex h-full min-w-0 flex-col rounded-2xl border p-2.5 shadow-sm transition hover:-translate-y-1 ${dark ? "border-zinc-800 bg-zinc-900 hover:border-pink-500" : "border-slate-200 bg-white hover:border-pink-200 hover:shadow-lg"} ${compact ? "sm:p-2" : "sm:p-3"}`}>
      <div className="min-w-0">
        <FanzaStyleWorkCardArtwork work={work} sourcePage={sourcePage} selectionListName={selectionListName} rank={rank} isSale={isSale} discountRate={discountRate} dark={dark} />
        <FanzaStyleWorkCardDetails work={work} releaseDate={releaseDate} tags={tags} dark={dark} />
      </div>
      <FanzaStyleWorkCardPrice work={work} isSale={isSale} price={price} dark={dark} showChart={showChart} insight={insight} />
      <FanzaStyleWorkCardActions work={work} sourcePage={sourcePage} selectionListName={selectionListName} rank={rank} dark={dark} />
    </article>
  );
}
