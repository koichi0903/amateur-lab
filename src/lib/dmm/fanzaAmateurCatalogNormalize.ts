import type { DmmItem } from "@/types/dmm";

export type FanzaAmateurCatalogItem = DmmItem & {
  product_id?: string;
  confirmedPerformers?: string[];
  affiliateURL: string;
  imageUrl: string | null;
  currentPrice: number | null;
  reviewAverage: number | null;
  campaigns: Array<{ title: string; dateBegin: string; dateEnd: string }>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function priceNumber(value: unknown): number | null {
  const digits = asText(value).match(/[0-9]+/)?.[0];
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

type CatalogSourceFields = {
  image: Record<string, unknown> | null;
  sampleMovie: Record<string, unknown> | null;
  prices: Record<string, unknown> | null;
  review: Record<string, unknown> | null;
  itemInfo: Record<string, unknown>;
  campaign: unknown[];
  affiliateURL: string;
};

function catalogSourceFields(
  value: Record<string, unknown>,
  canonicalUrl: string,
  buildAffiliateUrl: (canonicalUrl: string) => string,
): CatalogSourceFields {
  const image = isRecord(value.imageURL) ? value.imageURL : null;
  const sampleMovie = isRecord(value.sampleMovieURL) ? value.sampleMovieURL : null;
  const prices = isRecord(value.prices) ? value.prices : null;
  const review = isRecord(value.review) ? value.review : null;
  const itemInfo = isRecord(value.iteminfo) ? value.iteminfo : {};
  const rawCampaign = Array.isArray(value.campaign) ? value.campaign : value.campaign ? [value.campaign] : [];
  const affiliateURL = asText(value.affiliateURL) || buildAffiliateUrl(canonicalUrl);
  return { image, sampleMovie, prices, review, itemInfo, campaign: rawCampaign, affiliateURL };
}

export function normalizeFanzaAmateurCatalogItem(
  value: unknown,
  buildAffiliateUrl: (canonicalUrl: string) => string,
): FanzaAmateurCatalogItem | null {
  if (!isRecord(value)) return null;
  const contentId = asText(value.content_id);
  const title = asText(value.title);
  const canonicalUrl = asText(value.URL);
  if (!contentId || !title || !canonicalUrl) return null;

  const source = catalogSourceFields(value, canonicalUrl, buildAffiliateUrl);

  return {
    ...(value as unknown as DmmItem),
    content_id: contentId,
    title,
    product_id: asText(value.product_id),
    URL: canonicalUrl,
    affiliateURL: source.affiliateURL,
    sampleMovieURL: approvedSampleMovieUrls(source.sampleMovie),
    date: asText(value.date),
    prices: {
      price: asText(source.prices?.price),
      list_price: asText(source.prices?.list_price),
      deliveries: normalizeDeliveries(source.prices),
    },
    iteminfo: normalizeItemInfo(source.itemInfo),
    // DMM's list thumbnail can be only 90px wide; prefer the small variant
    // when the API does not provide a large cover.
    imageUrl: catalogImageUrl(source.image),
    currentPrice: priceNumber(source.prices?.price) ?? priceNumber(source.prices?.list_price),
    reviewAverage: normalizedReviewAverage(source.review),
    campaigns: normalizeCampaigns(source.campaign),
  };
}

function approvedSampleMovieUrls(sampleMovie: Record<string, unknown> | null): DmmItem["sampleMovieURL"] | undefined {
  if (!sampleMovie) return undefined;
  return Object.fromEntries(
    ["size_476_306", "size_560_360", "size_644_414", "size_720_480"].flatMap((key) => {
      const rawUrl = asText(sampleMovie[key]);
      if (!rawUrl) return [];
      try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:" || url.hostname !== "www.dmm.co.jp" || !url.pathname.startsWith("/litevideo/")) return [];
        return [[key, url.href]];
      } catch {
        return [];
      }
    }),
  ) as DmmItem["sampleMovieURL"];
}

function normalizeDeliveries(prices: Record<string, unknown> | null): NonNullable<DmmItem["prices"]["deliveries"]> | undefined {
  const rawDeliveries = isRecord(prices?.deliveries) ? prices.deliveries.delivery : null;
  const deliveryRows = Array.isArray(rawDeliveries) ? rawDeliveries : rawDeliveries ? [rawDeliveries] : [];
  const delivery = deliveryRows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const type = asText(row.type);
    return type ? [{ type, price: asText(row.price), list_price: asText(row.list_price) }] : [];
  });
  return delivery.length ? { delivery } : undefined;
}

function normalizeItemInfo(rawItemInfo: Record<string, unknown>): NonNullable<DmmItem["iteminfo"]> {
  return {
    actress: Array.isArray(rawItemInfo.actress) ? rawItemInfo.actress as NonNullable<DmmItem["iteminfo"]>["actress"] : [],
    genre: Array.isArray(rawItemInfo.genre) ? rawItemInfo.genre as NonNullable<DmmItem["iteminfo"]>["genre"] : [],
    maker: Array.isArray(rawItemInfo.maker) ? rawItemInfo.maker as NonNullable<DmmItem["iteminfo"]>["maker"] : [],
    series: Array.isArray(rawItemInfo.series) ? rawItemInfo.series as NonNullable<DmmItem["iteminfo"]>["series"] : [],
  };
}

function catalogImageUrl(image: Record<string, unknown> | null) {
  return asText(image?.large) || asText(image?.small) || asText(image?.list) || null;
}

function normalizedReviewAverage(review: Record<string, unknown> | null) {
  return Number.isFinite(Number(review?.average)) ? Number(review?.average) : null;
}

function normalizeCampaigns(rawCampaign: unknown[]): FanzaAmateurCatalogItem["campaigns"] {
  return rawCampaign.flatMap((campaign) => {
    if (!isRecord(campaign)) return [];
    return [{ title: asText(campaign.title), dateBegin: asText(campaign.date_begin), dateEnd: asText(campaign.date_end) }];
  });
}
