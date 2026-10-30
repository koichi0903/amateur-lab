import { formatDmmActresses } from "../dmm/actresses.ts";
import type { DmmItem } from "../../types/dmm.ts";

export type CurrentDmmWork = {
  id: number;
  review_count: number | null;
  review_average: number | null;
  maker: string | null;
  series: string | null;
  url: string | null;
  release_date: string | null;
  actress?: string | null;
};

export type DmmItemUpdateFacts = {
  previousReviewCount: number;
  currentReviewCount: number;
  isReviewGrowth: boolean;
  nextMaker: string;
  nextSeries: string;
  nextUrl: string;
  nextReleaseDate: string | null;
  nextReviewAverage: number;
  apiCurrentPrice: number;
  apiListPrice: number;
  apiSalePrice: number;
  apiDiscountRate: number;
  nextActress: string | null;
  sampleImages: string[];
};

function createDmmReviewFacts(item: DmmItem, currentWork?: CurrentDmmWork) {
  const previousReviewCount = currentWork?.review_count ?? 0;
  const currentReviewCount = Number(item.review?.count) || 0;
  return {
    previousReviewCount,
    currentReviewCount,
    isReviewGrowth: currentReviewCount > previousReviewCount,
    nextReviewAverage: Number(item.review?.average) || 0,
  };
}

function createDmmPriceFacts(item: DmmItem) {
  const apiCurrentPrice = Number(item.prices?.price) || 0;
  const apiListPrice = Number(item.prices?.list_price) || apiCurrentPrice;
  const apiSalePrice = apiCurrentPrice > 0 && apiListPrice > apiCurrentPrice
    ? apiCurrentPrice
    : 0;
  return {
    apiCurrentPrice,
    apiListPrice,
    apiSalePrice,
    apiDiscountRate: apiSalePrice > 0 && apiListPrice > 0
      ? Math.round((1 - apiSalePrice / apiListPrice) * 100)
      : 0,
  };
}

function createDmmCatalogFacts(item: DmmItem) {
  return {
    ...createDmmCatalogEntityFacts(item),
    ...createDmmCatalogLinkFacts(item),
    ...createDmmCatalogMediaFacts(item),
  };
}

function createDmmCatalogEntityFacts(item: DmmItem) {
  return {
    nextMaker: item.iteminfo?.maker?.[0]?.name || "",
    nextSeries: item.iteminfo?.series?.[0]?.name || "",
  };
}

function createDmmCatalogLinkFacts(item: DmmItem) {
  return {
    nextUrl: item.URL || item.affiliateURL || "",
    nextReleaseDate: item.date || null,
  };
}

function createDmmCatalogMediaFacts(item: DmmItem) {
  return {
    nextActress: formatDmmActresses(item),
    sampleImages: item.sampleImageURL?.sample_l?.image ?? [],
  };
}

export function createDmmItemUpdateFacts(item: DmmItem, currentWork?: CurrentDmmWork): DmmItemUpdateFacts {
  return {
    ...createDmmReviewFacts(item, currentWork),
    ...createDmmPriceFacts(item),
    ...createDmmCatalogFacts(item),
  };
}

export function areDmmSampleImagesDifferent(
  existing: Array<{ image_url: string }> | null,
  incoming: string[],
) {
  if (!incoming.length) return false;
  if ((existing?.length ?? 0) !== incoming.length) return true;
  return (existing ?? []).some((row, index) => row.image_url !== incoming[index]);
}

export function hasDmmWorkMetadataChanges(currentWork: CurrentDmmWork | undefined, facts: DmmItemUpdateFacts) {
  return hasDmmReviewMetadataChanges(currentWork, facts) || hasDmmCatalogMetadataChanges(currentWork, facts);
}

function hasDmmReviewMetadataChanges(currentWork: CurrentDmmWork | undefined, facts: DmmItemUpdateFacts) {
  return (currentWork?.review_count ?? 0) !== facts.currentReviewCount ||
    (currentWork?.review_average ?? 0) !== facts.nextReviewAverage;
}

function hasDmmCatalogMetadataChanges(currentWork: CurrentDmmWork | undefined, facts: DmmItemUpdateFacts) {
  return (currentWork?.maker ?? "") !== facts.nextMaker ||
    (currentWork?.series ?? "") !== facts.nextSeries ||
    (currentWork?.url ?? "") !== facts.nextUrl ||
    currentWork?.release_date !== facts.nextReleaseDate;
}

export function hasDmmActressChange(currentWork: CurrentDmmWork | undefined, nextActress: string | null) {
  return nextActress != null && currentWork?.actress !== nextActress;
}

export function createDmmWorkUpdatePayload(
  facts: DmmItemUpdateFacts,
  updatePrices: boolean,
  updatedAt: string,
) {
  return {
    release_date: facts.nextReleaseDate,
    maker: facts.nextMaker,
    series: facts.nextSeries,
    url: facts.nextUrl || null,
    review_count: facts.currentReviewCount,
    review_average: facts.nextReviewAverage,
    ...(updatePrices && facts.apiCurrentPrice > 0
      ? {
          price: facts.apiListPrice,
          list_price: facts.apiListPrice,
          sale_price: facts.apiSalePrice,
          discount_rate: facts.apiDiscountRate,
        }
      : {}),
    ...(facts.nextActress != null ? { actress: facts.nextActress } : {}),
    last_updated: updatedAt,
  };
}
