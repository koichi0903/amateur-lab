"use client";

import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurCatalog";
import {
  FanzaAmateurTopCardActions,
  FanzaAmateurTopCardImage,
  FanzaAmateurTopCardMetadata,
  FanzaAmateurTopCardPrice,
  FanzaAmateurTopCardSignals,
} from "./FanzaAmateurTopCardParts";

type Item = FanzaAmateurHomeCard["item"];

const numberFromPrice = (value: string | undefined) => {
  const digits = value?.match(/[0-9]+/)?.[0];
  return digits ? Number(digits) : null;
};

function getPrimaryImageUrl(item: Item) {
  return item.imageURL?.large || item.imageURL?.small || item.imageURL?.list || item.imageUrl;
}

function getRawSampleImageUrl(item: Item) {
  return item.sampleImageURL?.sample_l?.image?.[0] || item.sampleImageURL?.sample_s?.image?.[0];
}

function getDiscountRate(listPrice: number | null, currentPrice: number | null | undefined) {
  return listPrice && currentPrice && listPrice > currentPrice
    ? Math.round((1 - currentPrice / listPrice) * 100)
    : 0;
}

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

function getActiveCampaign(item: Item) {
  return item.campaigns.find((campaign) => campaignIsActive(campaign.dateBegin, campaign.dateEnd));
}

function safeSampleImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "pics.dmm.co.jp" && url.pathname.startsWith("/digital/amateur/")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function formatReleaseDate(value: string | null | undefined): string {
  const date = value?.slice(0, 10);
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : date ?? "";
}

export default function FanzaAmateurTopCard({ card, showChart = true, showRank = true, sourcePage = "amateur" }: { card: FanzaAmateurHomeCard; showChart?: boolean; showRank?: boolean; sourcePage?: "amateur" | "amateur_detail" }) {
  const { item } = card;
  const primaryImageUrl = getPrimaryImageUrl(item);
  const rawSampleImageUrl = getRawSampleImageUrl(item);
  const sampleImageUrl = safeSampleImageUrl(rawSampleImageUrl);
  const listPrice = numberFromPrice(item.prices?.list_price);
  const currentPrice = item.currentPrice;
  const discountRate = getDiscountRate(listPrice, currentPrice);
  const activeCampaign = getActiveCampaign(item);
  const releaseDate = formatReleaseDate(item.date);

  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
      <div className="min-w-0">
        <FanzaAmateurTopCardImage
          item={item}
          primaryImageUrl={primaryImageUrl}
          sampleImageUrl={sampleImageUrl}
          showRank={showRank}
          rank={card.rank}
          discountRate={discountRate}
        />
        <FanzaAmateurTopCardMetadata item={item} releaseDate={releaseDate} />
      </div>
      <FanzaAmateurTopCardPrice
        listPrice={listPrice}
        currentPrice={currentPrice}
        discountRate={discountRate}
        activeCampaign={activeCampaign}
      />
      <FanzaAmateurTopCardSignals card={card} currentPrice={currentPrice} showChart={showChart} />
      <FanzaAmateurTopCardActions item={item} sourcePage={sourcePage} />
    </article>
  );
}

