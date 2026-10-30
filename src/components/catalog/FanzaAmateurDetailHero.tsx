"use client";

import Link from "next/link";
import { useState } from "react";
import FanzaAmateurAffiliateLink from "@/components/catalog/FanzaAmateurAffiliateLink";
import AmateurFavoriteButton from "@/components/favorites/AmateurFavoriteButton";
import FanzaAmateurPriceAlertButton from "@/components/catalog/FanzaAmateurPriceAlertButton";
import type { FanzaAmateurCatalogItem, FanzaAmateurPriceHistoryEntry } from "@/lib/dmm/fanzaAmateurCatalog";
import { buildFanzaAmateurDetailEntityProjection, buildFanzaAmateurDetailPriceProjection } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";
import { FanzaAmateurDetailMediaGallery } from "@/components/catalog/FanzaAmateurDetailMediaGallery";
import { FanzaAmateurDetailPricing } from "@/components/catalog/FanzaAmateurDetailPricing";

type Props = {
  item: FanzaAmateurCatalogItem;
  fetchedAt: string;
  volume: string | null;
  officialSampleEmbedUrl: string | null;
  sampleMovieMp4Url: string | null;
  sampleImages: string[];
  priceHistory: FanzaAmateurPriceHistoryEntry[];
};

export default function FanzaAmateurDetailHero({ item, fetchedAt, volume, officialSampleEmbedUrl, sampleMovieMp4Url, sampleImages, priceHistory }: Props) {
  const { coverUrl, performers, makers, seriesList, genres } = buildFanzaAmateurDetailEntityProjection(item);
  const [selectedPriceType, setSelectedPriceType] = useState("");
  const currentPrice = item.currentPrice;
  const { priceTypes, activePriceType, listPrice, discount, activeHistory, chartHistory, chartData, lowestPrice } = buildFanzaAmateurDetailPriceProjection({
    priceHistory,
    currentPrice,
    listPrice: item.prices?.list_price,
    deliveries: item.prices.deliveries?.delivery,
    selectedPriceType,
    fetchedAt,
  });
  return (
    <section className="grid gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-8">
      <FanzaAmateurDetailMediaGallery
        title={item.title}
        coverUrl={coverUrl}
        officialSampleEmbedUrl={officialSampleEmbedUrl}
        sampleMovieMp4Url={sampleMovieMp4Url}
        sampleImages={sampleImages}
        discount={discount}
      />

      <div className="min-w-0">
        <h1 className="mt-2 text-xl font-black leading-[1.375] text-slate-950 sm:text-2xl">{item.title}</h1>
        <FanzaAmateurDetailPricing
          item={item}
          volume={volume}
          fetchedAt={fetchedAt}
          currentPrice={currentPrice}
          listPrice={listPrice}
          discount={discount}
          activePriceType={activePriceType}
          priceTypes={priceTypes}
          activeHistory={activeHistory}
          chartHistory={chartHistory}
          chartData={chartData}
          lowestPrice={lowestPrice}
          onPriceTypeSelect={setSelectedPriceType}
        />
        <div className="flex min-w-0 flex-wrap gap-2">
          {performers.map((performer) => <Link key={`performer-${performer}`} href={`/amateur/actress/${encodeURIComponent(performer)}`} aria-label={`${performer}の素人出演作品一覧`} className="max-w-full break-words rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700 hover:bg-pink-200 hover:underline">♀ {performer}</Link>)}
          {makers.map((maker) => <Link key={`maker-${maker}`} href={`/amateur/search?maker=${encodeURIComponent(maker)}`} className="max-w-full break-words rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">🏢 {maker}</Link>)}
          {genres.map((genre) => <Link key={`genre-${genre}`} href={`/amateur/search?genre=${encodeURIComponent(genre)}`} className="max-w-full break-words rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">🏷 {genre}</Link>)}
        </div>
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1"><FanzaAmateurAffiliateLink href={item.affiliateURL} contentId={item.content_id} sourcePage="amateur_detail" price={currentPrice} /></div>
          <AmateurFavoriteButton contentId={item.content_id} iconOnly className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-2xl leading-none text-slate-600 transition hover:border-pink-200 hover:bg-pink-50" />
        </div>
        <FanzaAmateurPriceAlertButton contentId={item.content_id} workTitle={item.title} makers={[...new Set(item.iteminfo?.maker?.map((maker) => maker.name.trim()).filter(Boolean) ?? [])]} />
        {seriesList.length > 0 && <div className="mt-5 flex min-w-0 flex-wrap gap-2 border-t border-slate-200 pt-4">
          {seriesList.map((series) => <Link key={`series-${series}`} href={`/amateur/search?q=${encodeURIComponent(series)}`} className="max-w-full break-words rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">▣ {series}</Link>)}
        </div>}
      </div>
    </section>
  );
}

