"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MiniPriceHistoryChart from "@/components/home/MiniPriceHistoryChart";
import SaleCountdown from "@/components/home/SaleCountdown";
import AmateurFavoriteButton from "@/components/favorites/AmateurFavoriteButton";
import { trackFanzaAmateurAffiliateClick } from "@/lib/trackFanzaAmateurAffiliateClick";
import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurCatalog";

type Card = FanzaAmateurHomeCard;
type Item = Card["item"];
type Campaign = Item["campaigns"][number];

export function FanzaAmateurTopCardImage({
  item,
  primaryImageUrl,
  sampleImageUrl,
  showRank,
  rank,
  discountRate,
}: {
  item: Item;
  primaryImageUrl: string | null | undefined;
  sampleImageUrl: string | null | undefined;
  showRank: boolean;
  rank: number | null | undefined;
  discountRate: number;
}) {
  const [useSampleImage, setUseSampleImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const cardImageUrl = useSampleImage && sampleImageUrl ? sampleImageUrl : primaryImageUrl;

  return (
    <div className="relative -mx-2.5 -mt-2.5 aspect-square overflow-hidden rounded-t-2xl bg-slate-100 sm:-mx-3 sm:-mt-3">
      <Link
        href={`/amateur/${encodeURIComponent(item.content_id)}`}
        className="absolute inset-0"
        aria-label={`${item.title}の作品情報`}
      >
        {cardImageUrl && !imageFailed ? (
          <Image
            src={cardImageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1280px) 22vw, 240px"
            className="object-cover transition duration-300"
            unoptimized
            onLoad={(event) => {
              const image = event.currentTarget;
              if (
                !useSampleImage &&
                sampleImageUrl &&
                (image.naturalWidth < 160 || image.naturalHeight < 160)
              ) {
                setUseSampleImage(true);
              }
            }}
            onError={() => {
              if (!useSampleImage && sampleImageUrl) setUseSampleImage(true);
              else setImageFailed(true);
            }}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs font-black tracking-widest text-slate-400">
            NO IMAGE
          </span>
        )}
      </Link>
      {showRank && rank != null && (
        <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-black text-slate-900 shadow-sm">
          {rank}位
        </span>
      )}
      {discountRate > 0 && (
        <span className="absolute bottom-2 left-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-black text-white shadow-sm">
          {discountRate}%OFF
        </span>
      )}
      <AmateurFavoriteButton
        contentId={item.content_id}
        iconOnly
        className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-xl leading-none text-pink-600 shadow-sm transition hover:bg-white"
      />
    </div>
  );
}

export function FanzaAmateurTopCardMetadata({
  item,
  releaseDate,
}: {
  item: Item;
  releaseDate: string;
}) {
  const performers = item.confirmedPerformers ?? [];
  const genres = item.iteminfo?.genre?.map((genre) => genre.name).filter(Boolean) ?? [];

  return (
    <>
      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-900">
        {item.title}
      </h3>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-500">
        発売日：{releaseDate || "未取得"}
      </p>
      <div className="mt-1 flex min-h-11 max-h-11 min-w-0 content-start flex-wrap gap-1 overflow-hidden">
        {performers.map((performer) => (
          <Link
            key={`performer:${performer}`}
            href={`/amateur/actress/${encodeURIComponent(performer)}`}
            aria-label={`${performer}の素人出演作品一覧`}
            className="max-w-full truncate rounded-md bg-pink-100 px-1.5 py-1 text-[10px] font-bold text-pink-700 hover:bg-pink-200 hover:underline"
          >
            {performer}
          </Link>
        ))}
        {genres.map((genre) => (
          <Link
            key={genre}
            href={`/amateur/search?genre=${encodeURIComponent(genre)}`}
            className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-pink-100 hover:text-pink-700"
          >
            {genre}
          </Link>
        ))}
      </div>
    </>
  );
}

export function FanzaAmateurTopCardPrice({
  listPrice,
  currentPrice,
  discountRate,
  activeCampaign,
}: {
  listPrice: number | null;
  currentPrice: number | null | undefined;
  discountRate: number;
  activeCampaign: Campaign | null | undefined;
}) {
  return (
    <div className="mt-3 flex min-h-[56px] items-end justify-between gap-2 border-t border-slate-100 pt-2">
      <div className="min-w-0">
        {discountRate > 0 && listPrice != null && (
          <p className="text-[10px] font-bold text-slate-400 line-through">
            ¥{listPrice.toLocaleString("ja-JP")}
          </p>
        )}
        <p className={`text-base font-black ${discountRate > 0 ? "text-pink-500" : "text-slate-900"}`}>
          {currentPrice != null ? `¥${currentPrice.toLocaleString("ja-JP")}` : "価格未取得"}
        </p>
      </div>
      {activeCampaign && <SaleCountdown saleEndAt={activeCampaign.dateEnd} />}
    </div>
  );
}

export function FanzaAmateurTopCardSignals({
  card,
  currentPrice,
  showChart,
}: {
  card: Card;
  currentPrice: number | null | undefined;
  showChart: boolean;
}) {
  const { item } = card;

  return (
    <>
      <div className="mt-2 flex min-h-5 items-center justify-between text-[11px] font-bold text-slate-500">
        <span className="text-amber-500">
          ★ {item.reviewAverage != null && item.reviewAverage > 0 ? item.reviewAverage.toFixed(1) : "-"}
        </span>
        <span>({item.review?.count ?? 0})</span>
      </div>
      {showChart && currentPrice != null && card.priceHistory.length > 0 && (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
          <MiniPriceHistoryChart
            points={card.priceHistory}
            windowStartAt={card.priceWindowStartAt}
            windowEndAt={card.priceWindowEndAt}
            lowPrice={card.lowestObservedPrice ?? currentPrice}
            currentPrice={currentPrice}
            variant="compact"
          />
        </div>
      )}
    </>
  );
}

export function FanzaAmateurTopCardActions({
  item,
  sourcePage,
}: {
  item: Item;
  sourcePage: "amateur" | "amateur_detail";
}) {
  return (
    <div className="mt-auto flex flex-col gap-1.5 pt-2">
      <a
        href={item.affiliateURL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex min-h-9 w-full items-center justify-center rounded-lg bg-pink-600 px-2 text-[11px] font-black text-white hover:bg-pink-700"
        onClick={() =>
          trackFanzaAmateurAffiliateClick({
            contentId: item.content_id,
            sourcePage,
            placement: "listing-card",
          })
        }
      >
        FANZAで見る
      </a>
      <Link
        href={`/amateur/${encodeURIComponent(item.content_id)}`}
        className="flex min-h-8 w-full items-center justify-center rounded-lg border border-pink-200 px-2 text-[10px] font-black text-pink-700 hover:bg-pink-50"
      >
        詳細を見る
      </Link>
    </div>
  );
}
