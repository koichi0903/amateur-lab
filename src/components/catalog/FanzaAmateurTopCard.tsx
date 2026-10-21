"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MiniPriceHistoryChart from "@/components/home/MiniPriceHistoryChart";
import SaleCountdown from "@/components/home/SaleCountdown";
import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurCatalog";
import AmateurFavoriteButton from "@/components/favorites/AmateurFavoriteButton";
import { trackFanzaAmateurAffiliateClick } from "@/lib/trackFanzaAmateurAffiliateClick";

const numberFromPrice = (value: string | undefined) => {
  const digits = value?.match(/[0-9]+/)?.[0];
  return digits ? Number(digits) : null;
};

function campaignIsActive(dateBegin: string, dateEnd: string) {
  const now = Date.now();
  const parseJst = (value: string) => {
    if (!value) return Number.NaN;
    const normalized = value.replace(" ", "T");
    return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}+09:00`);
  };
  const start = parseJst(dateBegin);
  const end = parseJst(dateEnd);
  return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
}

export default function FanzaAmateurTopCard({ card, showChart = true, showRank = true, sourcePage = "amateur" }: { card: FanzaAmateurHomeCard; showChart?: boolean; showRank?: boolean; sourcePage?: "amateur" | "amateur_detail" }) {
  const { item } = card;
  const [useSampleImage, setUseSampleImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const primaryImageUrl = item.imageURL?.large || item.imageURL?.small || item.imageURL?.list || item.imageUrl;
  const rawSampleImageUrl = item.sampleImageURL?.sample_l?.image?.[0] || item.sampleImageURL?.sample_s?.image?.[0];
  const sampleImageUrl = (() => {
    if (!rawSampleImageUrl) return null;
    try {
      const url = new URL(rawSampleImageUrl);
      return url.protocol === "https:" && url.hostname === "pics.dmm.co.jp" && url.pathname.startsWith("/digital/amateur/")
        ? url.href
        : null;
    } catch {
      return null;
    }
  })();
  const cardImageUrl = useSampleImage && sampleImageUrl ? sampleImageUrl : primaryImageUrl;
  const listPrice = numberFromPrice(item.prices?.list_price);
  const currentPrice = item.currentPrice;
  const discountRate = listPrice && currentPrice && listPrice > currentPrice
    ? Math.round((1 - currentPrice / listPrice) * 100)
    : 0;
  const activeCampaign = item.campaigns.find((campaign) => campaignIsActive(campaign.dateBegin, campaign.dateEnd));
  const genres = item.iteminfo?.genre?.map((genre) => genre.name).filter(Boolean) ?? [];
  const releaseDate = (() => { const value = item.date?.slice(0, 10); const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : value ?? ""; })();

  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
      <div className="min-w-0">
        <div className="relative -mx-2.5 -mt-2.5 aspect-square overflow-hidden rounded-t-2xl bg-slate-100 sm:-mx-3 sm:-mt-3">
          <Link href={`/amateur/${encodeURIComponent(item.content_id)}`} className="absolute inset-0" aria-label={`${item.title}の作品情報`}>
            {cardImageUrl && !imageFailed ? <Image src={cardImageUrl} alt={item.title} fill sizes="(max-width: 640px) 45vw, (max-width: 1280px) 22vw, 240px" className="object-cover transition duration-300" unoptimized onLoad={(event) => {
              const image = event.currentTarget;
              if (!useSampleImage && sampleImageUrl && (image.naturalWidth < 160 || image.naturalHeight < 160)) setUseSampleImage(true);
            }} onError={() => {
              if (!useSampleImage && sampleImageUrl) setUseSampleImage(true);
              else setImageFailed(true);
            }} /> : <span className="flex h-full items-center justify-center text-xs font-black tracking-widest text-slate-400">NO IMAGE</span>}
          </Link>
          {showRank && card.rank != null && <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-black text-slate-900 shadow-sm">{card.rank}位</span>}
          {discountRate > 0 && <span className="absolute bottom-2 left-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-black text-white shadow-sm">{discountRate}%OFF</span>}
          <AmateurFavoriteButton contentId={item.content_id} iconOnly className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-xl leading-none text-pink-600 shadow-sm transition hover:bg-white" />
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-900">{item.title}</h3>
        <p className="mt-1 truncate text-[11px] font-bold text-slate-500">発売日：{releaseDate || "未取得"}</p>
        <div className="mt-1 flex min-h-11 max-h-11 min-w-0 content-start flex-wrap gap-1 overflow-hidden">
          {genres.map((genre) => <Link key={genre} href={`/amateur/search?genre=${encodeURIComponent(genre)}`} className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-pink-100 hover:text-pink-700">{genre}</Link>)}
        </div>
      </div>
      <div className="mt-3 flex min-h-[56px] items-end justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="min-w-0">
          {discountRate > 0 && listPrice != null && <p className="text-[10px] font-bold text-slate-400 line-through">¥{listPrice.toLocaleString("ja-JP")}</p>}
          <p className={`text-base font-black ${discountRate > 0 ? "text-pink-500" : "text-slate-900"}`}>{currentPrice != null ? `¥${currentPrice.toLocaleString("ja-JP")}` : "価格未取得"}</p>
        </div>
        {activeCampaign && <SaleCountdown saleEndAt={activeCampaign.dateEnd} />}
      </div>
      <div className="mt-2 flex min-h-5 items-center justify-between text-[11px] font-bold text-slate-500"><span className="text-amber-500">★ {item.reviewAverage != null && item.reviewAverage > 0 ? item.reviewAverage.toFixed(1) : "-"}</span><span>({item.review?.count ?? 0})</span></div>
      {showChart && currentPrice != null && card.priceHistory.length > 0 && <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"><MiniPriceHistoryChart points={card.priceHistory} windowStartAt={card.priceWindowStartAt} windowEndAt={card.priceWindowEndAt} lowPrice={card.lowestObservedPrice ?? currentPrice} currentPrice={currentPrice} variant="compact" /></div>}
      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <a href={item.affiliateURL} target="_blank" rel="noopener noreferrer sponsored" className="flex min-h-9 w-full items-center justify-center rounded-lg bg-pink-600 px-2 text-[11px] font-black text-white hover:bg-pink-700" onClick={() => trackFanzaAmateurAffiliateClick({ contentId: item.content_id, sourcePage, placement: "listing-card" })}>FANZAで見る</a>
        <Link href={`/amateur/${encodeURIComponent(item.content_id)}`} className="flex min-h-8 w-full items-center justify-center rounded-lg border border-pink-200 px-2 text-[10px] font-black text-pink-700 hover:bg-pink-50">詳細を見る</Link>
      </div>
    </article>
  );
}

