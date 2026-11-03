import type { FanzaAmateurBrowseCriteria, FanzaAmateurBrowseSort } from "./fanzaAmateurCatalogBrowseRules";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";

type FanzaAmateurBrowsePaginationParams = {
  query?: string;
  performer?: string;
  genre?: string;
  genres?: string[];
  maker?: string;
  releaseFrom?: string;
  releaseTo?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort: FanzaAmateurBrowseSort;
  page: number;
};

export function buildFanzaAmateurBrowsePageHref(action: string, filters: FanzaAmateurBrowsePaginationParams) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.performer) params.set("performer", filters.performer);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.genres?.length) params.set("genres", filters.genres.join(","));
  if (filters.maker) params.set("maker", filters.maker);
  if (filters.releaseFrom) params.set("releaseFrom", filters.releaseFrom);
  if (filters.releaseTo) params.set("releaseTo", filters.releaseTo);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  return `${action}?${params.toString()}`;
}

export function requiresFullFanzaAmateurBrowseScan(criteria: Pick<FanzaAmateurBrowseCriteria, "minPrice" | "sort">) {
  return criteria.minPrice != null || criteria.sort === "price";
}

export function sortStandardFanzaAmateurBrowseItems(items: FanzaAmateurCatalogItem[], sort: FanzaAmateurBrowseSort) {
  if (sort === "price") {
    items.sort((a, b) => (a.currentPrice ?? Number.POSITIVE_INFINITY) - (b.currentPrice ?? Number.POSITIVE_INFINITY) || a.content_id.localeCompare(b.content_id));
  } else if (sort === "date_asc") {
    items.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.content_id.localeCompare(b.content_id));
  } else if (sort === "review") {
    items.sort((a, b) => (b.reviewAverage ?? -1) - (a.reviewAverage ?? -1) || (b.review?.count ?? 0) - (a.review?.count ?? 0));
  } else {
    items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.content_id.localeCompare(b.content_id));
  }
  return items;
}
