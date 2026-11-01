import "server-only";

import { unstable_cache } from "next/cache";
import { buildFanzaAmateurAffiliateUrl, getFanzaAmateurAffiliateId as getAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurAffiliate";
import { FANZA_AMATEUR_FLOOR, FANZA_AMATEUR_PAGE_SIZE } from "@/lib/dmm/fanzaAmateurCatalogConstants";
import {
  buildFanzaAmateurBrowseCriteria,
  hasActiveCampaign,
  isAllFanzaAmateurEntityWorksBrowse,
  matchesFanzaAmateurAdvancedFilters,
  matchesFanzaAmateurRankedFilters,
  sortFanzaAmateurCampaignItems,
  type FanzaAmateurBrowseCriteria,
  type FanzaAmateurBrowseRuleInput,
  type RankedFanzaAmateurItem,
} from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
import { requiresFullFanzaAmateurBrowseScan, sortStandardFanzaAmateurBrowseItems } from "@/lib/dmm/fanzaAmateurBrowseProjection";
import { mergeStoredCatalogMedia } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";
import { indexFanzaAmateurPriceHistory, projectFanzaAmateurPriceChart } from "@/lib/dmm/fanzaAmateurPriceChartProjection";
import {
  asText,
  isRecord,
  normalizeFanzaAmateurCatalogItem as normalizeCatalogItem,
  type FanzaAmateurCatalogItem,
} from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type { FanzaAmateurCatalogItem };
export { getAmateurAffiliateId as getFanzaAmateurAffiliateId };
export { FANZA_AMATEUR_FLOOR, FANZA_AMATEUR_PAGE_SIZE } from "@/lib/dmm/fanzaAmateurCatalogConstants";

export type FanzaAmateurSort = "date" | "review" | "price" | "-price";
export {
  getFanzaAmateurCatalogWork,
  getFanzaAmateurRelatedWorks,
  getFanzaAmateurSamplePlayerUrl,
} from "@/lib/dmm/fanzaAmateurCatalogDetails";
export type { FanzaAmateurPriceHistoryEntry } from "@/lib/dmm/fanzaAmateurCatalogDetails";
export {
  getCanonicalFanzaAmateurActressName,
  getFanzaAmateurActressIndex,
  getFanzaAmateurActressWorks,
} from "@/lib/dmm/fanzaAmateurCatalogActresses";
export type {
  FanzaAmateurActressSort,
  FanzaAmateurActressSummary,
} from "@/lib/dmm/fanzaAmateurCatalogActresses";

export type FanzaAmateurHomeCard = {
  item: FanzaAmateurCatalogItem;
  rank?: number;
  priceHistory: Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null; isCurrent?: boolean }>;
  priceWindowStartAt: string;
  priceWindowEndAt: string;
  lowestObservedPrice: number | null;
};

type CatalogPageRow = {
  raw_item: unknown;
  fetched_at: string;
  total_count: number | string;
};

export async function addConfirmedPerformersToAmateurItems(items: FanzaAmateurCatalogItem[]) {
  const contentIds = [...new Set(items.map(({ content_id }) => content_id).filter(Boolean))];
  if (!contentIds.length) return items;

  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_performer_matches")
    .select("content_id,performer_name")
    .eq("verification_status", "confirmed")
    .in("content_id", contentIds);
  if (error) throw new Error(`確認済み出演者を読み込めませんでした: ${error.message}`);

  const namesByContentId = new Map<string, string[]>();
  for (const row of data ?? []) {
    const name = asText(row.performer_name);
    if (!name) continue;
    const names = namesByContentId.get(row.content_id) ?? [];
    if (!names.includes(name)) names.push(name);
    namesByContentId.set(row.content_id, names);
  }

  return items.map((item) => ({ ...item, confirmedPerformers: namesByContentId.get(item.content_id) ?? [] }));
}

async function loadAmateurSummaryPriceHistory(contentIds: string[], observedSince: string) {
  if (contentIds.length === 0) return [] as Array<{ content_id: string; observed_at: string; price: unknown }>;
  const [changedPrices, weeklySnapshots] = await Promise.all([
    supabaseAdmin.from("fanza_amateur_price_history")
      .select("content_id,observed_at,price")
      .eq("price_type", "summary")
      .in("content_id", contentIds)
      .gte("observed_at", observedSince)
      .order("observed_at", { ascending: false })
      .limit(1_000),
    supabaseAdmin.from("fanza_amateur_price_weekly_snapshots")
      .select("content_id,observed_at,prices")
      .in("content_id", contentIds)
      .gte("observed_at", observedSince)
      .order("observed_at", { ascending: false })
      .limit(1_000),
  ]);
  if (changedPrices.error) throw new Error(`素人作品の価格履歴を読み込めませんでした: ${changedPrices.error.message}`);
  if (weeklySnapshots.error) throw new Error(`素人作品の週次価格履歴を読み込めませんでした: ${weeklySnapshots.error.message}`);

  const records = new Map<string, { content_id: string; observed_at: string; price: unknown }>();
  for (const row of weeklySnapshots.data ?? []) {
    const prices = isRecord(row.prices) ? row.prices : {};
    records.set(`${row.content_id}\u0000${row.observed_at}`, {
      content_id: row.content_id,
      observed_at: row.observed_at,
      price: prices.price,
    });
  }
  for (const row of changedPrices.data ?? []) records.set(`${row.content_id}\u0000${row.observed_at}`, row);
  return [...records.values()];
}

export function normalizeFanzaAmateurCatalogItem(value: unknown): FanzaAmateurCatalogItem | null {
  return normalizeCatalogItem(value, buildFanzaAmateurAffiliateUrl);
}

async function loadFanzaAmateurCatalogPage({ page, sort }: { page: number; sort: FanzaAmateurSort }) {
  const safePage = Math.max(1, Math.trunc(page));
  const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_works_page", {
    p_page: safePage,
    p_sort: sort,
  });
  if (error) throw new Error(`素人作品一覧を読めませんでした: ${error.message}`);

  const rows = (data ?? []) as CatalogPageRow[];
  const items = rows.map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null);
  const totalCount = Number(rows[0]?.total_count ?? 0);

  return {
    items,
    page: safePage,
    totalCount,
    totalPages: Math.ceil(totalCount / FANZA_AMATEUR_PAGE_SIZE),
    fetchedAt: rows.reduce<string | null>((latest, row) => !latest || row.fetched_at > latest ? row.fetched_at : latest, null),
  };
}

const getCachedFanzaAmateurCatalogPage = unstable_cache(
  loadFanzaAmateurCatalogPage,
  ["fanza-amateur-catalog-page-v1"],
  { revalidate: 86_400, tags: ["fanza-amateur-catalog"] },
);

export async function getFanzaAmateurCatalogPage({ page, sort }: { page: number; sort: FanzaAmateurSort }) {
  return getCachedFanzaAmateurCatalogPage({ page, sort });
}

const RANKED_CATALOG_SCAN_SIZE = 5_000;
const RANKED_CATALOG_PAGE_SIZE = 100;
const AMATEUR_API_ROOT = "https://api.dmm.com/affiliate/v3/ItemList";

function uniqueAmateurItemsByContentId(items: FanzaAmateurCatalogItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.content_id)) return false;
    seen.add(item.content_id);
    return true;
  });
}

const getDmmFanzaAmateurRankedCatalogPage = unstable_cache(async (offset: number) => {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: getAmateurAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(RANKED_CATALOG_PAGE_SIZE),
    offset: String(offset),
    sort: "rank",
    output: "json",
  });
  const response = await fetch(`${AMATEUR_API_ROOT}?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as { result?: { status?: number | string; items?: unknown } };
  if (!response.ok || String(payload.result?.status ?? "200") !== "200" || !Array.isArray(payload.result?.items)) {
    throw new Error(`DMM APIの素人ランキング取得に失敗しました（HTTP ${response.status}）。`);
  }
  return payload.result.items
    .map((rawItem) => normalizeFanzaAmateurCatalogItem(rawItem))
    .filter((item): item is FanzaAmateurCatalogItem => item !== null);
}, ["fanza-amateur-ranked-catalog-page-v4"], { revalidate: 86_400, tags: ["fanza-amateur-home", "fanza-amateur-catalog"] });

/** DMM popularity order, bounded for the manual X-posting queue. */
export async function getDmmFanzaAmateurPopularWorks(limit = 500) {
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const items: FanzaAmateurCatalogItem[] = [];
  const seenContentIds = new Set<string>();
  for (let offset = 1; offset <= boundedLimit; offset += RANKED_CATALOG_PAGE_SIZE) {
    const pageItems = await getDmmFanzaAmateurRankedCatalogPage(offset);
    for (const item of pageItems) {
      if (seenContentIds.has(item.content_id)) continue;
      seenContentIds.add(item.content_id);
      items.push(item);
      if (items.length >= boundedLimit) return items;
    }
    if (pageItems.length < RANKED_CATALOG_PAGE_SIZE) break;
  }
  return items;
}

const getDmmFanzaAmateurRankedCatalog = async () => {
  const items: FanzaAmateurCatalogItem[] = [];
  const seenContentIds = new Set<string>();
  for (let offset = 1; offset <= RANKED_CATALOG_SCAN_SIZE; offset += RANKED_CATALOG_PAGE_SIZE) {
    const pageItems = await getDmmFanzaAmateurRankedCatalogPage(offset);
    for (const item of pageItems) {
      if (seenContentIds.has(item.content_id)) continue;
      seenContentIds.add(item.content_id);
      items.push(item);
    }
    if (pageItems.length < RANKED_CATALOG_PAGE_SIZE) break;
  }
  return items;
};

const getDmmFanzaAmateurRankedCampaigns = async (targetCount: number, now: number) => {
  const campaigns: FanzaAmateurCatalogItem[] = [];
  const seenContentIds = new Set<string>();

  for (let offset = 1; offset <= RANKED_CATALOG_SCAN_SIZE; offset += RANKED_CATALOG_PAGE_SIZE) {
    const pageItems = await getDmmFanzaAmateurRankedCatalogPage(offset);
    for (const item of pageItems) {
      if (seenContentIds.has(item.content_id)) continue;
      seenContentIds.add(item.content_id);
      if (hasActiveCampaign(item, now)) campaigns.push(item);
      if (campaigns.length >= targetCount) return campaigns;
    }
    if (pageItems.length < RANKED_CATALOG_PAGE_SIZE) break;
  }

  return campaigns;
};

async function loadFanzaAmateurHomeSections() {
  const now = Date.now();
  const [rankedCatalogPage, rankedCampaigns, latest, catalogCount] = await Promise.all([
    getDmmFanzaAmateurRankedCatalogPage(1),
    getDmmFanzaAmateurRankedCampaigns(12, now),
    getFanzaAmateurCatalogPage({ page: 1, sort: "date" }),
    supabaseAdmin.from("fanza_amateur_works").select("content_id", { count: "exact", head: true }),
  ]);
  if (catalogCount.error) throw new Error(`素人作品数を読めませんでした: ${catalogCount.error.message}`);

  const rankedCatalog = uniqueAmateurItemsByContentId(rankedCatalogPage);
  const popular = rankedCatalog.slice(0, 12).map((item, index) => ({ item, rank: index + 1 }));
  const campaign = rankedCampaigns.map((item) => ({ item }));
  const latestCards = latest.items.slice(0, 12).map((item) => ({ item }));
  const allCards = [...popular, ...campaign, ...latestCards];
  const contentIds = [...new Set(allCards.map(({ item }) => item.content_id))];
  const confirmedPerformers = await addConfirmedPerformersToAmateurItems(allCards.map(({ item }) => item));
  const performersByContentId = new Map(confirmedPerformers.map((item) => [item.content_id, item.confirmedPerformers ?? []]));
  for (const { item } of allCards) item.confirmedPerformers = performersByContentId.get(item.content_id) ?? [];
  const windowEndAt = new Date(now).toISOString();
  const windowStartAt = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const storedMedia = contentIds.length
    ? await supabaseAdmin.from("fanza_amateur_works")
        .select("content_id,image_url,sample_image_url")
        .in("content_id", contentIds)
    : { data: [], error: null };
  if (storedMedia.error) throw new Error(`素人作品の画像情報を読み込めませんでした: ${storedMedia.error.message}`);

  const mediaByContentId = new Map((storedMedia.data ?? []).map((row) => [row.content_id, row]));
  for (const { item } of allCards) {
    const saved = mediaByContentId.get(item.content_id);
    if (!saved) continue;
    const mergedMedia = mergeStoredCatalogMedia(item, saved.image_url, saved.sample_image_url);
    item.imageURL = mergedMedia.imageURL;
    item.sampleImageURL = mergedMedia.sampleImageURL;
  }

  const histories = await loadAmateurSummaryPriceHistory(contentIds, windowStartAt);

  const historyByContentId = indexFanzaAmateurPriceHistory(histories);

  return {
    popular: popular.map(({ item, rank }) => projectFanzaAmateurPriceChart(item, historyByContentId, windowStartAt, windowEndAt, rank)),
    campaign: campaign.map(({ item }) => projectFanzaAmateurPriceChart(item, historyByContentId, windowStartAt, windowEndAt)),
    latest: latestCards.map(({ item }) => projectFanzaAmateurPriceChart(item, historyByContentId, windowStartAt, windowEndAt)),
    totalCount: catalogCount.count ?? 0,
  };
}

const getCachedFanzaAmateurHomeSections = unstable_cache(
  loadFanzaAmateurHomeSections,
  ["fanza-amateur-home-sections-v2-weekly-price-snapshots"],
  { revalidate: 10_800, tags: ["fanza-amateur-home", "fanza-amateur-catalog"] },
);

export async function getFanzaAmateurHomeSections() {
  return getCachedFanzaAmateurHomeSections();
}

export type FanzaAmateurBrowseFilter = FanzaAmateurBrowseRuleInput & { page?: number };
export type { FanzaAmateurBrowseSort } from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";

async function loadFanzaAmateurEntityContentIds(kind: "genre" | "maker", name: string) {
  const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_entity_content_ids", {
    p_kind: kind,
    p_name: name,
  });
  if (error) throw new Error("素人作品の分類別一覧を読み込めませんでした: " + error.message);
  return Array.isArray(data) ? data.filter((contentId): contentId is string => typeof contentId === "string") : [];
}

const getCachedFanzaAmateurEntityContentIds = unstable_cache(
  loadFanzaAmateurEntityContentIds,
  ["fanza-amateur-entity-content-ids-v3"],
  { revalidate: 86_400, tags: ["fanza-amateur-taxonomy", "fanza-amateur-catalog"] },
);

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

const getCachedFanzaAmateurPerformerContentIds = unstable_cache(loadFanzaAmateurPerformerContentIds, ["fanza-amateur-performer-content-ids-v1"], { revalidate: 3600 });

type CatalogBrowseSelection = {
  items: FanzaAmateurCatalogItem[];
  totalCount: number;
  rankByContentId: Map<string, number>;
};

async function loadUnrankedActiveCampaignItems(rankedIds: ReadonlySet<string>) {
  const activeCampaignIds = new Set<string>();
  const pageSize = 1_000;
  const nowIso = new Date().toISOString();

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_campaigns")
      .select("content_id")
      .or("and(starts_at.is.null,ends_at.gte." + nowIso + "),and(starts_at.lte." + nowIso + ",ends_at.is.null),and(starts_at.lte." + nowIso + ",ends_at.gte." + nowIso + ")")
      .order("content_id", { ascending: true })
      .order("campaign_index", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("順位未取得の素人セール作品を読み込めませんでした: " + error.message);

    for (const row of data ?? []) activeCampaignIds.add(row.content_id);
    if (!data || data.length < pageSize) break;
  }

  const unrankedIds = [...activeCampaignIds].filter((contentId) => !rankedIds.has(contentId));
  const archivedItems = new Map<string, FanzaAmateurCatalogItem>();
  for (let offset = 0; offset < unrankedIds.length; offset += 300) {
    const contentIds = unrankedIds.slice(offset, offset + 300);
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .in("content_id", contentIds);
    if (error) throw new Error("順位未取得の素人セール作品を読み込めませんでした: " + error.message);

    for (const row of data ?? []) {
      const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
      if (item) archivedItems.set(item.content_id, item);
    }
  }
  return archivedItems;
}

function buildRankedBrowseSelection(
  items: RankedFanzaAmateurItem[],
  safePage: number,
): CatalogBrowseSelection {
  const start = (safePage - 1) * FANZA_AMATEUR_PAGE_SIZE;
  const pageItems = items.slice(start, start + FANZA_AMATEUR_PAGE_SIZE);
  const rankByContentId = new Map<string, number>();
  const selectedItems = pageItems.map(({ item, rank }) => {
    if (rank != null) rankByContentId.set(item.content_id, rank);
    return item;
  });
  return { items: selectedItems, totalCount: items.length, rankByContentId };
}

async function loadRankedEntityBrowseSelection(
  criteria: FanzaAmateurBrowseCriteria,
  rankedItems: RankedFanzaAmateurItem[],
  safePage: number,
): Promise<CatalogBrowseSelection> {
  const entityIds = [...new Set(await getCachedFanzaAmateurEntityContentIds(
    criteria.genre ? "genre" : "maker",
    criteria.genre ?? criteria.maker ?? "",
  ))];
  const entityIdSet = new Set(entityIds);
  const rankedEntityItems = rankedItems.filter(({ item }) => entityIdSet.has(item.content_id));
  const rankedEntityIds = new Set(rankedEntityItems.map(({ item }) => item.content_id));
  const unrankedIds = entityIds.filter((contentId) => !rankedEntityIds.has(contentId));
  const totalCount = entityIds.length;
  const start = (safePage - 1) * FANZA_AMATEUR_PAGE_SIZE;
  const rankByContentId = new Map<string, number>();
  const items = rankedEntityItems.slice(start, start + FANZA_AMATEUR_PAGE_SIZE).map(({ item, rank }) => {
    if (rank != null) rankByContentId.set(item.content_id, rank);
    return item;
  });
  const unrankedStart = Math.max(0, start - rankedEntityItems.length);
  const unrankedSlots = FANZA_AMATEUR_PAGE_SIZE - items.length;
  const pageIds = unrankedIds.slice(unrankedStart, unrankedStart + unrankedSlots);

  if (pageIds.length) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .in("content_id", pageIds);
    if (error) throw new Error("順位未取得の素人作品を読み込めませんでした: " + error.message);

    const itemsById = new Map<string, FanzaAmateurCatalogItem>();
    for (const row of data ?? []) {
      const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
      if (item) itemsById.set(item.content_id, item);
    }
    items.push(...pageIds.map((contentId) => itemsById.get(contentId))
      .filter((item): item is FanzaAmateurCatalogItem => item !== undefined));
  }

  return { items, totalCount, rankByContentId };
}

async function loadRankedBrowseSelection(
  criteria: FanzaAmateurBrowseCriteria,
  safePage: number,
): Promise<CatalogBrowseSelection> {
  const rankedCatalog = await getDmmFanzaAmateurRankedCatalog();
  const rankedItems = rankedCatalog
    .map((item, index) => ({ item, rank: index + 1 }))
    .filter(({ item }) => matchesFanzaAmateurRankedFilters(item, criteria, Date.now()));
  if (isAllFanzaAmateurEntityWorksBrowse(criteria)) {
    return loadRankedEntityBrowseSelection(criteria, rankedItems, safePage);
  }

  const rankedIds = new Set(rankedCatalog.map((item) => item.content_id));
  const catalogItems = criteria.campaignOnly
    ? [
        ...rankedCatalog.map((item, index) => ({ item, rank: index + 1 })),
        ...[...(await loadUnrankedActiveCampaignItems(rankedIds)).values()]
          .map((item) => ({ item, rank: null })),
      ]
    : rankedItems;
  const matchedItems = criteria.campaignOnly
    ? catalogItems.filter(({ item }) => matchesFanzaAmateurRankedFilters(item, criteria, Date.now()))
    : rankedItems;
  const orderedItems = [...matchedItems];
  if (criteria.campaignOnly) sortFanzaAmateurCampaignItems(orderedItems, criteria.sort);
  return buildRankedBrowseSelection(orderedItems, safePage);
}

function buildStandardFanzaAmateurBrowseRequest(
  criteria: FanzaAmateurBrowseCriteria,
  performerContentIds: string[] | null,
) {
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
    request = request.or("title.ilike.%" + escaped + "%,product_id.ilike.%" + escaped + "%");
  }
  if (performerContentIds) request = request.in("content_id", performerContentIds.length ? performerContentIds : ["__no_confirmed_performer_match__"]);
  for (const selectedGenre of selectedGenres) request = request.contains("iteminfo", { genre: [{ name: selectedGenre }] });
  if (maker) request = request.contains("iteminfo", { maker: [{ name: maker.slice(0, 100) }] });
  if (releaseFrom) request = request.gte("api_date", releaseFrom);
  if (releaseTo) request = request.lte("api_date", releaseTo);
  if (campaignOnly) request = request.not("campaign", "is", null);
  return request;
}

async function loadStandardBrowseSelection(
  criteria: FanzaAmateurBrowseCriteria,
  performerContentIds: string[] | null,
  safePage: number,
): Promise<CatalogBrowseSelection> {
  const request = buildStandardFanzaAmateurBrowseRequest(criteria, performerContentIds);
  let items: FanzaAmateurCatalogItem[];
  let totalCount: number;

  if (requiresFullFanzaAmateurBrowseScan(criteria)) {
    const allItems: FanzaAmateurCatalogItem[] = [];
    const batchSize = 1_000;
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await request.range(from, from + batchSize - 1);
      if (error) throw new Error("素人作品を検索できませんでした: " + error.message);
      allItems.push(...(data ?? [])
        .map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item))
        .filter((item): item is FanzaAmateurCatalogItem => item !== null)
        .filter((item) => matchesFanzaAmateurAdvancedFilters(item, criteria)));
      if (!data || data.length < batchSize) break;
    }
    sortStandardFanzaAmateurBrowseItems(allItems, criteria.sort);
    totalCount = allItems.length;
    items = allItems.slice((safePage - 1) * FANZA_AMATEUR_PAGE_SIZE, safePage * FANZA_AMATEUR_PAGE_SIZE);
  } else {
    const { data, count, error } = await request.range(
      (safePage - 1) * FANZA_AMATEUR_PAGE_SIZE,
      safePage * FANZA_AMATEUR_PAGE_SIZE - 1,
    );
    if (error) throw new Error("素人作品を検索できませんでした: " + error.message);
    items = (data ?? [])
      .map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item))
      .filter((item): item is FanzaAmateurCatalogItem => item !== null)
      .filter((item) => matchesFanzaAmateurAdvancedFilters(item, criteria));
    totalCount = count ?? 0;
  }

  return { items, totalCount, rankByContentId: new Map() };
}

async function loadFanzaAmateurBrowseSelection(
  filters: FanzaAmateurBrowseFilter,
  safePage: number,
): Promise<CatalogBrowseSelection> {
  const inputCriteria = buildFanzaAmateurBrowseCriteria(filters, null);
  const performerContentIds = inputCriteria.safePerformer
    ? await getCachedFanzaAmateurPerformerContentIds(inputCriteria.safePerformer)
    : null;
  const criteria = buildFanzaAmateurBrowseCriteria(filters, performerContentIds);
  return criteria.sort === "rank" || criteria.campaignOnly
    ? loadRankedBrowseSelection(criteria, safePage)
    : loadStandardBrowseSelection(criteria, performerContentIds, safePage);
}

async function loadFanzaAmateurBrowsePage(filters: FanzaAmateurBrowseFilter) {
  const safePage = Math.max(1, Math.trunc(filters.page ?? 1));
  const selection = await loadFanzaAmateurBrowseSelection(filters, safePage);
  const now = Date.now();
  const priceWindowEndAt = new Date(now).toISOString();
  const priceWindowStartAt = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const contentIds = selection.items.map((item) => item.content_id);
  const historyResult = await loadAmateurSummaryPriceHistory(contentIds, priceWindowStartAt);
  const historyByContentId = indexFanzaAmateurPriceHistory(historyResult);

  const enrichedItems = await addConfirmedPerformersToAmateurItems(selection.items);
  const cards: FanzaAmateurHomeCard[] = enrichedItems.map((item) =>
    projectFanzaAmateurPriceChart(item, historyByContentId, priceWindowStartAt, priceWindowEndAt, selection.rankByContentId.get(item.content_id)));
  return {
    items: selection.items,
    cards,
    page: safePage,
    totalCount: selection.totalCount,
    totalPages: Math.ceil(selection.totalCount / FANZA_AMATEUR_PAGE_SIZE),
  };
}
const getCachedFanzaAmateurBrowsePage = unstable_cache(
  loadFanzaAmateurBrowsePage,
  ["fanza-amateur-browse-page-v2-weekly-price-snapshots"],
  { revalidate: 86_400, tags: ["fanza-amateur-catalog", "fanza-amateur-taxonomy"] },
);

const getCachedFanzaAmateurSalePage = unstable_cache(
  loadFanzaAmateurBrowsePage,
  ["fanza-amateur-sale-page-v2-weekly-price-snapshots"],
  { revalidate: 300, tags: ["fanza-amateur-catalog"] },
);

const getCachedFanzaAmateurFilteredBrowsePage = unstable_cache(
  loadFanzaAmateurBrowsePage,
  ["fanza-amateur-filtered-browse-page-v2-weekly-price-snapshots"],
  { revalidate: 300, tags: ["fanza-amateur-catalog", "fanza-amateur-taxonomy"] },
);

export async function getFanzaAmateurBrowsePage(filters: FanzaAmateurBrowseFilter) {
  if (filters.campaignOnly) return getCachedFanzaAmateurSalePage(filters);
  const hasNarrowFilters = Boolean(
    filters.query?.trim()
    || filters.performer?.trim()
    || filters.maxPrice != null
    || filters.minRating != null
    || filters.minPrice != null
    || filters.releaseFrom
    || filters.releaseTo,
  );
  return hasNarrowFilters
    ? getCachedFanzaAmateurFilteredBrowsePage(filters)
    : getCachedFanzaAmateurBrowsePage(filters);
}

async function loadFanzaAmateurTaxonomyRows(kind: "genre" | "maker") {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_taxonomy")
    .select("name,work_count,image_url,image_candidates")
    .eq("kind", kind)
    .order("work_count", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(`素人作品の${kind === "genre" ? "ジャンル" : "メーカー"}を読み込めませんでした: ${error.message}`);
  return data ?? [];
}

const getCachedFanzaAmateurTaxonomyRows = unstable_cache(
  loadFanzaAmateurTaxonomyRows,
  ["fanza-amateur-taxonomy-rows-v1"],
  { revalidate: 86_400, tags: ["fanza-amateur-taxonomy", "fanza-amateur-catalog"] },
);

export async function getFanzaAmateurGenreNames() {
  const data = await getCachedFanzaAmateurTaxonomyRows("genre");
  return data.map(({ name }) => name);
}

export async function getFanzaAmateurTaxonomy(kind: "genre" | "maker") {
  const data = await getCachedFanzaAmateurTaxonomyRows(kind);
  const usedImageUrls = new Set<string>();
  return (data ?? []).map(({ name, work_count, image_url, image_candidates }) => {
    const candidates = Array.isArray(image_candidates) ? image_candidates : [];
    const distinctCandidate = candidates
      .map((candidate) => isRecord(candidate) ? asText(candidate.imageUrl) : "")
      .find((candidate) => candidate && !usedImageUrls.has(candidate));
    const imageUrl = distinctCandidate || (image_url && !usedImageUrls.has(image_url) ? image_url : null);
    if (imageUrl) usedImageUrls.add(imageUrl);
    return { name, count: work_count, imageUrl };
  });
}
