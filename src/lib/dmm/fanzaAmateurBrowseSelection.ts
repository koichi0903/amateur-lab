import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFanzaAmateurAffiliateUrl } from "@/lib/dmm/fanzaAmateurAffiliate";
import { getDmmFanzaAmateurRankedCatalog } from "@/lib/dmm/fanzaAmateurRankedCatalog";
import {
  type FanzaAmateurCatalogItem,
  normalizeFanzaAmateurCatalogItem as normalizeCatalogItem,
} from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import {
  isAllFanzaAmateurEntityWorksBrowse,
  matchesFanzaAmateurAdvancedFilters,
  matchesFanzaAmateurRankedFilters,
  sortFanzaAmateurCampaignItems,
  type FanzaAmateurBrowseCriteria,
  type FanzaAmateurBrowseSort,
} from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
import { requiresFullFanzaAmateurBrowseScan, sortStandardFanzaAmateurBrowseItems } from "@/lib/dmm/fanzaAmateurBrowseProjection";

export type FanzaAmateurSort = "date" | "review" | "price" | "-price";

function normalizeFanzaAmateurCatalogItem(value: unknown): FanzaAmateurCatalogItem | null {
  return normalizeCatalogItem(value, buildFanzaAmateurAffiliateUrl);
}

export type FanzaAmateurBrowseFilter = {
  page?: number;
  pageSize?: number;
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

async function loadFanzaAmateurEntityContentIds(kind: "genre" | "maker", name: string) {
  const ids: string[] = [];
  const batchSize = 1_000;
  const itemInfoFilter = kind === "genre" ? { genre: [{ name }] } : { maker: [{ name }] };
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("content_id")
      .contains("iteminfo", itemInfoFilter)
      .order("api_date", { ascending: false, nullsFirst: false })
      .order("content_id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw new Error("素人作品の分類別一覧を読み込めませんでした: " + error.message);
    ids.push(...(data ?? []).map((row) => row.content_id));
    if (!data || data.length < batchSize) break;
  }
  return ids;
}

const getCachedFanzaAmateurEntityContentIds = unstable_cache(loadFanzaAmateurEntityContentIds, ["fanza-amateur-entity-content-ids-v1"], { revalidate: 3600 });

async function loadFanzaAmateurPerformerContentIds(name: string) {
  const ids: string[] = [];
  const batchSize = 1_000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_performer_matches")
      .select("content_id")
      .eq("verification_status", "confirmed")
      .eq("performer_name", name)
      .order("content_id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw new Error("素人作品の女優情報を検索できませんでした: " + error.message);
    ids.push(...(data ?? []).map((row) => row.content_id));
    if (!data || data.length < batchSize) break;
  }
  return [...new Set(ids)];
}

export const getCachedFanzaAmateurPerformerContentIds = unstable_cache(loadFanzaAmateurPerformerContentIds, ["fanza-amateur-performer-content-ids-v1"], { revalidate: 3600 });

export type FanzaAmateurBrowseSelection = {
  items: FanzaAmateurCatalogItem[];
  totalCount: number;
  rankByContentId: Map<string, number>;
};

async function loadArchivedFanzaAmateurCampaignItems(rankedIds: ReadonlySet<string>) {
  const archivedCampaignItems = new Map<string, FanzaAmateurCatalogItem>();
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .not("campaign", "is", null)
      .order("content_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`順位未取得の素人セール作品を読み込めませんでした: ${error.message}`);

    for (const row of data ?? []) {
      const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
      if (!item || rankedIds.has(item.content_id)) continue;
      archivedCampaignItems.set(item.content_id, item);
    }
    if (!data || data.length < pageSize) break;
  }
  return archivedCampaignItems;
}

export async function loadRankedFanzaAmateurBrowseSelection(
  criteria: FanzaAmateurBrowseCriteria,
  safePage: number,
  safePageSize: number,
): Promise<FanzaAmateurBrowseSelection> {
  const { sort, campaignOnly, genre, maker } = criteria;
  const rankByContentId = new Map<string, number>();
  const rankedCatalog = await getDmmFanzaAmateurRankedCatalog();
  const matchesFilters = (item: FanzaAmateurCatalogItem) => matchesFanzaAmateurRankedFilters(item, criteria, Date.now());
  const rankedItems = rankedCatalog
    .map((item, index) => ({ item, rank: index + 1 }))
    .filter(({ item }) => matchesFilters(item));
  const rankedIds = new Set(rankedCatalog.map((item) => item.content_id));
  const archivedCampaignItems = campaignOnly
    ? await loadArchivedFanzaAmateurCampaignItems(rankedIds)
    : new Map<string, FanzaAmateurCatalogItem>();
  const catalogItems = campaignOnly
    ? [
        ...rankedCatalog.map((item, index) => ({ item, rank: index + 1 })),
        ...[...archivedCampaignItems.values()].map((item) => ({ item, rank: null as number | null })),
      ]
    : rankedCatalog.map((item, index) => ({ item, rank: index + 1 }));
  const matchedItems = catalogItems.filter(({ item }) => matchesFilters(item));
  if (isAllFanzaAmateurEntityWorksBrowse(criteria)) {
    const entityIds = await getCachedFanzaAmateurEntityContentIds(genre ? "genre" : "maker", genre ?? maker ?? "");
    const entityIdSet = new Set(entityIds);
    const rankedEntityItems = rankedItems.filter(({ item }) => entityIdSet.has(item.content_id));
    const rankedEntityIds = new Set(rankedEntityItems.map(({ item }) => item.content_id));
    const unrankedIds = entityIds.filter((contentId) => !rankedEntityIds.has(contentId));
    const totalCount = entityIds.length;
    const start = (safePage - 1) * safePageSize;
    let items = rankedEntityItems.slice(start, start + safePageSize).map(({ item, rank }) => {
      rankByContentId.set(item.content_id, rank);
      return item;
    });
    const unrankedStart = Math.max(0, start - rankedEntityItems.length);
    const unrankedSlots = safePageSize - items.length;
    const pageIds = unrankedIds.slice(unrankedStart, unrankedStart + unrankedSlots);
    if (pageIds.length) {
      const { data, error } = await supabaseAdmin.from("fanza_amateur_works").select("raw_item").in("content_id", pageIds);
      if (error) throw new Error("順位未取得の素人作品を読み込めませんでした: " + error.message);
      const itemsById = new Map<string, FanzaAmateurCatalogItem>();
      for (const row of data ?? []) {
        const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
        if (item) itemsById.set(item.content_id, item);
      }
      items = [...items, ...pageIds.map((contentId) => itemsById.get(contentId)).filter((item): item is FanzaAmateurCatalogItem => item !== undefined)];
    }
    return { items, totalCount, rankByContentId };
  }

  const ordered = campaignOnly ? [...matchedItems] : [...rankedItems];
  if (campaignOnly) sortFanzaAmateurCampaignItems(ordered, sort);
  const totalCount = ordered.length;
  const pageItems = ordered.slice((safePage - 1) * safePageSize, safePage * safePageSize);
  const items = pageItems.map(({ item, rank }) => {
    if (rank != null) rankByContentId.set(item.content_id, rank);
    return item;
  });
  return { items, totalCount, rankByContentId };
}

export async function loadStandardFanzaAmateurBrowseSelection(
  criteria: FanzaAmateurBrowseCriteria,
  performerContentIds: string[] | null,
  safePage: number,
  safePageSize: number,
): Promise<FanzaAmateurBrowseSelection> {
  const request = buildStandardFanzaAmateurBrowseRequest(criteria, performerContentIds);
  const { items, totalCount } = await loadStandardFanzaAmateurBrowseItems(request, criteria, safePage, safePageSize);
  return { items, totalCount, rankByContentId: new Map() };
}

function buildStandardFanzaAmateurBrowseRequest(criteria: FanzaAmateurBrowseCriteria, performerContentIds: string[] | null) {
  const { sort, campaignOnly, maker, releaseFrom, releaseTo, safeQuery, selectedGenres } = criteria;
  let request = supabaseAdmin
    .from("fanza_amateur_works")
    .select("raw_item,fetched_at", { count: "exact" });
  if (sort === "date_asc") request = request.order("api_date", { ascending: true, nullsFirst: true });
  else if (sort === "review") request = request.order("raw_item->review->count", { ascending: false, nullsFirst: false }).order("raw_item->review->average", { ascending: false, nullsFirst: false });
  else request = request.order("api_date", { ascending: false, nullsFirst: false });
  request = request.order("content_id", { ascending: true });
  if (safeQuery) {
    const escaped = safeQuery.replace(/[\\%_]/g, "\\$&").replace(/[(),]/g, " ");
    request = request.or(`title.ilike.%${escaped}%,product_id.ilike.%${escaped}%`);
  }
  if (performerContentIds) request = request.in("content_id", performerContentIds.length ? performerContentIds : ["__no_confirmed_performer_match__"]);
  for (const selectedGenre of selectedGenres) request = request.contains("iteminfo", { genre: [{ name: selectedGenre }] });
  if (maker) request = request.contains("iteminfo", { maker: [{ name: maker.slice(0, 100) }] });
  if (releaseFrom) request = request.gte("api_date", releaseFrom);
  if (releaseTo) request = request.lte("api_date", releaseTo);
  if (campaignOnly) request = request.not("campaign", "is", null);

  return request;
}

async function loadStandardFanzaAmateurBrowseItems(
  request: ReturnType<typeof buildStandardFanzaAmateurBrowseRequest>,
  criteria: FanzaAmateurBrowseCriteria,
  safePage: number,
  safePageSize: number,
) {
  let items: FanzaAmateurCatalogItem[];
  let totalCount: number;
  if (requiresFullFanzaAmateurBrowseScan(criteria)) {
    const allItems: FanzaAmateurCatalogItem[] = [];
    const batchSize = 1_000;
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await request.range(from, from + batchSize - 1);
      if (error) throw new Error(`素人作品を検索できませんでした: ${error.message}`);
      const batch = (data ?? []).map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null).filter((item) => matchesFanzaAmateurAdvancedFilters(item, criteria));
      allItems.push(...batch);
      if (!data || data.length < batchSize) break;
    }
    sortStandardFanzaAmateurBrowseItems(allItems, criteria.sort);
    totalCount = allItems.length;
    items = allItems.slice((safePage - 1) * safePageSize, safePage * safePageSize);
  } else {
    const { data, count, error } = await request.range((safePage - 1) * safePageSize, safePage * safePageSize - 1);
    if (error) throw new Error(`素人作品を検索できませんでした: ${error.message}`);
    const rows = (data ?? []) as Array<{ raw_item: unknown; fetched_at: string }>;
    items = rows.map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null).filter((item) => matchesFanzaAmateurAdvancedFilters(item, criteria));
    totalCount = count ?? 0;
  }
  return { items, totalCount };
}
