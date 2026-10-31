import type { FanzaAmateurBrowseSort } from "./fanzaAmateurCatalogBrowseRules";

export type FanzaAmateurBrowsePageMode = "search" | "sale" | "personal";
export type FanzaAmateurBrowsePageParams = {
  q?: string;
  performer?: string;
  genres?: string;
  genre?: string;
  maker?: string;
  page?: string;
  sort?: string;
  maxPrice?: string;
  minRating?: string;
  releaseFrom?: string;
  releaseTo?: string;
  minPrice?: string;
};

export type FanzaAmateurBrowsePageRequest = {
  page: number;
  query: string;
  performer: string;
  genre: string;
  genres: string[];
  maker: string;
  sort: FanzaAmateurBrowseSort;
  maxPrice: number | undefined;
  minRating: number | undefined;
  releaseFrom: string | undefined;
  releaseTo: string | undefined;
  minPrice: number | undefined;
  title: string;
  action: string;
  showCompactSearchHeader: boolean;
};

function safeText(value: string | undefined) {
  return (value ?? "").trim().slice(0, 100);
}

function safePage(value: string | undefined) {
  const requested = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(requested) && requested > 0 ? requested : 1;
}

function safeNumericParam(value: string | undefined) {
  return /^\d+$/.test(value ?? "") ? Math.min(Number(value), 1_000_000) : undefined;
}

function safeSaleMaxPrice(value: number | undefined) {
  return [300, 500, 1000].includes(value ?? -1) ? value : undefined;
}

function safeRating(value: string | undefined) {
  return ["3.5", "4", "4.5"].includes(value ?? "") ? Number(value) : undefined;
}

function safeReleaseDate(value: string | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value : undefined;
}

function safeSort(mode: FanzaAmateurBrowsePageMode, value: string | undefined): FanzaAmateurBrowseSort {
  const allowed: FanzaAmateurBrowseSort[] = mode === "sale"
    ? ["rank", "discount", "price", "review", "ending"]
    : ["rank", "date_desc", "date_asc", "price", "review"];
  if (allowed.includes(value as FanzaAmateurBrowseSort)) return value as FanzaAmateurBrowseSort;
  return mode === "sale" ? "rank" : "date_desc";
}

function browseTitle(mode: FanzaAmateurBrowsePageMode) {
  return {
    sale: "素人作品のセール",
    personal: "素人作品の好み発掘",
    search: "素人作品を詳細検索",
  }[mode];
}

function browseAction(mode: FanzaAmateurBrowsePageMode) {
  return {
    sale: "/amateur/sale",
    personal: "/amateur/personal-pick",
    search: "/amateur/search",
  }[mode];
}

function hasCompactSearchHeader(filters: Pick<FanzaAmateurBrowsePageRequest,
  "query" | "performer" | "genre" | "genres" | "maker" | "releaseFrom" | "releaseTo" | "minPrice" | "maxPrice" | "sort">) {
  return Boolean(filters.query || filters.performer || filters.genre || filters.genres.length || filters.maker
    || filters.releaseFrom || filters.releaseTo || filters.minPrice != null || filters.maxPrice != null || filters.sort === "rank");
}

export function parseFanzaAmateurBrowsePageRequest(mode: FanzaAmateurBrowsePageMode, params: FanzaAmateurBrowsePageParams): FanzaAmateurBrowsePageRequest {
  const genres = [...new Set((params.genres ?? "").split(",").map(safeText).filter(Boolean))].slice(0, 30);
  const maxPrice = safeNumericParam(params.maxPrice);
  const request = {
    page: safePage(params.page),
    query: safeText(params.q),
    performer: safeText(params.performer),
    genre: safeText(params.genre),
    genres,
    maker: safeText(params.maker),
    sort: safeSort(mode, params.sort),
    maxPrice: mode === "sale" ? safeSaleMaxPrice(maxPrice) : maxPrice,
    minRating: safeRating(params.minRating),
    releaseFrom: safeReleaseDate(params.releaseFrom),
    releaseTo: safeReleaseDate(params.releaseTo),
    minPrice: safeNumericParam(params.minPrice),
    title: browseTitle(mode),
    action: browseAction(mode),
    showCompactSearchHeader: false,
  };
  return { ...request, showCompactSearchHeader: mode === "search" && hasCompactSearchHeader(request) };
}
