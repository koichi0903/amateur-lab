import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";
import { priceNumber } from "./fanzaAmateurCatalogNormalize";

export type FanzaAmateurBrowseSort = "rank" | "date_desc" | "date_asc" | "review" | "discount" | "price" | "ending";

export type FanzaAmateurBrowseRuleInput = {
  query?: string;
  performer?: string;
  genre?: string;
  genres?: string[];
  maker?: string;
  sort?: FanzaAmateurBrowseSort;
  campaignOnly?: boolean;
  maxPrice?: number;
  minRating?: number;
  minPrice?: number;
  releaseFrom?: string;
  releaseTo?: string;
};

export type FanzaAmateurBrowseCriteria = {
  query: string | undefined;
  performer: string | undefined;
  genre: string | undefined;
  genres: string[];
  maker: string | undefined;
  sort: FanzaAmateurBrowseSort;
  campaignOnly: boolean;
  maxPrice: number | undefined;
  minRating: number | undefined;
  minPrice: number | undefined;
  releaseFrom: string | undefined;
  releaseTo: string | undefined;
  safeQuery: string | undefined;
  safePerformer: string | undefined;
  selectedGenres: string[];
  performerContentIdSet: Set<string> | null;
};

export type RankedFanzaAmateurItem = {
  item: FanzaAmateurCatalogItem;
  rank: number | null;
};

export function buildFanzaAmateurBrowseCriteria(
  input: FanzaAmateurBrowseRuleInput,
  performerContentIds: string[] | null,
): FanzaAmateurBrowseCriteria {
  const safeQuery = input.query?.trim().slice(0, 100);
  const safePerformer = input.performer?.trim().slice(0, 100);
  const selectedGenres = [...new Set([...(input.genres ?? []), ...(input.genre ? [input.genre] : [])]
    .map((value) => value.trim().slice(0, 100))
    .filter(Boolean))].slice(0, 30);

  return {
    query: input.query,
    performer: input.performer,
    genre: input.genre,
    genres: input.genres ?? [],
    maker: input.maker,
    sort: input.sort ?? "date_desc",
    campaignOnly: input.campaignOnly ?? false,
    maxPrice: input.maxPrice,
    minRating: input.minRating,
    minPrice: input.minPrice,
    releaseFrom: input.releaseFrom,
    releaseTo: input.releaseTo,
    safeQuery,
    safePerformer,
    selectedGenres,
    performerContentIdSet: performerContentIds ? new Set(performerContentIds) : null,
  };
}

function parseJst(value: string) {
  if (!value) return Number.NaN;
  const normalized = value.replace(" ", "T");
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : normalized + "+09:00");
}

export function hasActiveCampaign(item: FanzaAmateurCatalogItem, now: number) {
  return item.campaigns.some((campaign) => {
    const begins = parseJst(campaign.dateBegin);
    const ends = parseJst(campaign.dateEnd);
    return (!Number.isFinite(begins) || begins <= now) && (!Number.isFinite(ends) || ends >= now);
  });
}

export function getFanzaAmateurCampaignEnd(item: FanzaAmateurCatalogItem) {
  const ends = item.campaigns.map(({ dateEnd }) => parseJst(dateEnd)).filter(Number.isFinite);
  return ends.length ? Math.min(...ends) : Number.POSITIVE_INFINITY;
}

export function getFanzaAmateurCampaignDiscountRate(item: FanzaAmateurCatalogItem) {
  const current = item.currentPrice;
  const regular = priceNumber(item.prices?.list_price);
  return current != null && regular != null && regular > current ? (regular - current) / regular : 0;
}

export function matchesFanzaAmateurAdvancedFilters(
  item: FanzaAmateurCatalogItem,
  criteria: FanzaAmateurBrowseCriteria,
) {
  const releaseDate = item.date ?? "";
  if (criteria.releaseFrom && releaseDate && releaseDate.slice(0, 10) < criteria.releaseFrom) return false;
  if (criteria.releaseTo && releaseDate && releaseDate.slice(0, 10) > criteria.releaseTo) return false;
  if (criteria.selectedGenres.some((selected) => !item.iteminfo?.genre?.some((entry) => entry.name === selected))) return false;
  if (criteria.minPrice != null && (item.currentPrice == null || item.currentPrice < criteria.minPrice)) return false;
  return true;
}

export function matchesFanzaAmateurRankedFilters(
  item: FanzaAmateurCatalogItem,
  criteria: FanzaAmateurBrowseCriteria,
  now: number,
) {
  return matchesRankedIdentityFilters(item, criteria)
    && matchesRankedOfferFilters(item, criteria, now)
    && matchesFanzaAmateurAdvancedFilters(item, criteria);
}

function matchesRankedIdentityFilters(item: FanzaAmateurCatalogItem, criteria: FanzaAmateurBrowseCriteria) {
  if (criteria.performerContentIdSet && !criteria.performerContentIdSet.has(item.content_id)) return false;
  if (criteria.safeQuery && !(`${item.title} ${item.content_id} ${item.product_id ?? ""}`).toLocaleLowerCase("ja").includes(criteria.safeQuery.toLocaleLowerCase("ja"))) return false;
  if (criteria.genre && !item.iteminfo?.genre?.some((entry) => entry.name === criteria.genre)) return false;
  if (criteria.maker && !item.iteminfo?.maker?.some((entry) => entry.name === criteria.maker)) return false;
  return true;
}

function matchesRankedOfferFilters(item: FanzaAmateurCatalogItem, criteria: FanzaAmateurBrowseCriteria, now: number) {
  if (criteria.campaignOnly && !hasActiveCampaign(item, now)) return false;
  if (criteria.maxPrice != null && (item.currentPrice == null || item.currentPrice > criteria.maxPrice)) return false;
  if (criteria.minRating != null && (item.reviewAverage == null || item.reviewAverage < criteria.minRating)) return false;
  return true;
}

export function isAllFanzaAmateurEntityWorksBrowse(criteria: FanzaAmateurBrowseCriteria) {
  return !criteria.campaignOnly
    && criteria.sort === "rank"
    && !criteria.safeQuery
    && !criteria.safePerformer
    && criteria.genres.length === 0
    && criteria.maxPrice == null
    && criteria.minRating == null
    && criteria.minPrice == null
    && !criteria.releaseFrom
    && !criteria.releaseTo
    && Boolean((criteria.genre && !criteria.maker) || (!criteria.genre && criteria.maker));
}

export function sortFanzaAmateurCampaignItems(
  items: RankedFanzaAmateurItem[],
  sort: FanzaAmateurBrowseSort,
) {
  if (sort === "rank") items.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    return (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0)
      || a.item.content_id.localeCompare(b.item.content_id);
  });
  else if (sort === "discount") items.sort((a, b) => getFanzaAmateurCampaignDiscountRate(b.item) - getFanzaAmateurCampaignDiscountRate(a.item) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  else if (sort === "price") items.sort((a, b) => (a.item.currentPrice ?? Number.POSITIVE_INFINITY) - (b.item.currentPrice ?? Number.POSITIVE_INFINITY) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  else if (sort === "review") items.sort((a, b) => (b.item.reviewAverage ?? -1) - (a.item.reviewAverage ?? -1) || (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  else if (sort === "ending") items.sort((a, b) => getFanzaAmateurCampaignEnd(a.item) - getFanzaAmateurCampaignEnd(b.item) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}
