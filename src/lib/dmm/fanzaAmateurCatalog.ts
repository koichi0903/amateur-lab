import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFanzaAmateurAffiliateUrl, getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurAffiliate";
import { getDmmFanzaAmateurRankedCatalogWithCampaigns } from "@/lib/dmm/fanzaAmateurRankedCatalog";
import { FANZA_AMATEUR_PAGE_SIZE } from "@/lib/dmm/fanzaAmateurCatalogConstants";
import {
  getCachedFanzaAmateurPerformerContentIds,
  loadRankedFanzaAmateurBrowseSelection,
  loadStandardFanzaAmateurBrowseSelection,
  type FanzaAmateurBrowseFilter,
  type FanzaAmateurSort,
} from "@/lib/dmm/fanzaAmateurBrowseSelection";
import {
  expandFanzaAmateurPriceSnapshotRows,
  type FanzaAmateurPriceSnapshotRow,
} from "@/lib/dmm/fanzaAmateurPriceHistory";
import { loadAmateurDetailPriceHistory, loadAmateurSummaryPriceHistory } from "@/lib/dmm/fanzaAmateurCatalogPriceReads";
import { buildFanzaAmateurRelatedWorkFilters, rankFanzaAmateurRelatedWorks } from "@/lib/dmm/fanzaAmateurRelatedWorks";
import {
  asText,
  type FanzaAmateurCatalogItem,
  normalizeFanzaAmateurCatalogItem as normalizeCatalogItem,
  priceNumber,
} from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import {
  applyStoredMediaToHomeEntries,
  buildAmateurHomePriceHistoryIndex,
  buildFanzaAmateurHomeEntries,
  withAmateurHomePriceChart,
  type FanzaAmateurHomeCard,
} from "@/lib/dmm/fanzaAmateurHomeProjection";

import { buildFanzaAmateurBrowseCriteria, hasActiveCampaign } from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
import { mergeCatalogDetailPriceHistory, mergeStoredCatalogMedia } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";
export { FANZA_AMATEUR_FLOOR, FANZA_AMATEUR_PAGE_SIZE } from "@/lib/dmm/fanzaAmateurCatalogConstants";
export { getDmmFanzaAmateurPopularWorks } from "@/lib/dmm/fanzaAmateurRankedCatalog";
export type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
export type { FanzaAmateurBrowseSort } from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
export type { FanzaAmateurBrowseFilter, FanzaAmateurSort } from "@/lib/dmm/fanzaAmateurBrowseSelection";
export { buildFanzaAmateurAffiliateUrl, getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurAffiliate";
export {
  getCanonicalFanzaAmateurActressName,
  getFanzaAmateurActressIndex,
  getFanzaAmateurActressWorks,
} from "@/lib/dmm/fanzaAmateurActressCatalog";
export type {
  FanzaAmateurActressSort,
  FanzaAmateurActressSummary,
} from "@/lib/dmm/fanzaAmateurActressCatalog";

export type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurHomeProjection";
export { getFanzaAmateurGenreNames, getFanzaAmateurTaxonomy } from "@/lib/dmm/fanzaAmateurTaxonomy";

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

export function normalizeFanzaAmateurCatalogItem(value: unknown): FanzaAmateurCatalogItem | null {
  return normalizeCatalogItem(value, buildFanzaAmateurAffiliateUrl);
}

export function getFanzaAmateurSamplePlayerUrl(item: FanzaAmateurCatalogItem) {
  const sampleUrl = item.sampleMovieURL?.size_476_306
    || item.sampleMovieURL?.size_560_360
    || item.sampleMovieURL?.size_644_414
    || item.sampleMovieURL?.size_720_480;
  if (!sampleUrl) return null;

  try {
    const url = new URL(sampleUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.dmm.co.jp" || !url.pathname.startsWith("/litevideo/")) return null;
    const cid = url.pathname.match(/(?:^|\/)cid=([^/]+)/)?.[1] ?? item.content_id;
    const player = new URL(`https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${encodeURIComponent(cid)}/mtype=AhRVShI_/service=litevideo/mode=part/width=260/height=167/`);
    player.pathname += `affi_id=${encodeURIComponent(getFanzaAmateurAffiliateId())}/`;
    return player.href;
  } catch {
    return null;
  }
}

export type FanzaAmateurPriceHistoryEntry = {
  observed_at: string;
  price_type: string;
  price: string | null;
  list_price: string | null;
};

async function loadFanzaAmateurCatalogWork(contentId: string) {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_works")
    .select("raw_item,fetched_at,image_url,sample_image_url,mp4_url")
    .eq("content_id", contentId)
    .maybeSingle();
  if (error) throw new Error(`素人作品を読み込めませんでした: ${error.message}`);
  if (!data) return null;

  const normalizedItem = normalizeFanzaAmateurCatalogItem(data.raw_item);
  if (!normalizedItem) return null;
  const item = mergeStoredCatalogMedia(normalizedItem, data.image_url, data.sample_image_url);

  const historyCutoffDate = new Date();
  historyCutoffDate.setUTCFullYear(historyCutoffDate.getUTCFullYear() - 1);
  const historyCutoff = historyCutoffDate.toISOString();
  const [history, weeklySnapshots] = await Promise.all([
    loadAmateurDetailPriceHistory(contentId, historyCutoff),
    supabaseAdmin
      .from("fanza_amateur_price_weekly_snapshots")
      .select("source_run_id,content_id,observed_at,prices")
      .eq("content_id", contentId)
      .gte("observed_at", historyCutoff)
      .order("observed_at", { ascending: false })
      .limit(60),
  ]);
  if (weeklySnapshots.error) throw new Error(`素人作品の週次価格履歴を読み込めませんでした: ${weeklySnapshots.error.message}`);
  const priceHistory = mergeCatalogDetailPriceHistory(
    history,
    weeklySnapshots.data ?? [],
    (row) => expandFanzaAmateurPriceSnapshotRows(row as FanzaAmateurPriceSnapshotRow),
  );

  return {
    item,
    fetchedAt: data.fetched_at as string,
    mp4Url: asText(data.mp4_url) || null,
    priceHistory: priceHistory as FanzaAmateurPriceHistoryEntry[],
  };
}

const getCachedFanzaAmateurCatalogWork = unstable_cache(
  loadFanzaAmateurCatalogWork,
  ["fanza-amateur-work-detail-v3-current-price-chart"],
  { revalidate: 10_800, tags: ["fanza-amateur-catalog"] },
);

export async function getFanzaAmateurCatalogWork(contentId: string) {
  return getCachedFanzaAmateurCatalogWork(contentId);
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

async function loadFanzaAmateurHomeSections() {
  const now = Date.now();
  const [rankedCatalog, latest, catalogCount] = await Promise.all([
    getDmmFanzaAmateurRankedCatalogWithCampaigns(12, now),
    getFanzaAmateurCatalogPage({ page: 1, sort: "date" }),
    supabaseAdmin.from("fanza_amateur_works").select("content_id", { count: "exact", head: true }),
  ]);
  if (catalogCount.error) throw new Error(`素人作品数を読めませんでした: ${catalogCount.error.message}`);

  const { popular, campaign, latest: latestCards, all: allCards, contentIds } = buildFanzaAmateurHomeEntries(
    rankedCatalog,
    latest.items,
    (item) => hasActiveCampaign(item, now),
  );
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

  applyStoredMediaToHomeEntries(allCards, storedMedia.data ?? []);

  const histories = await loadAmateurSummaryPriceHistory(contentIds, windowStartAt);
  const historyByContentId = buildAmateurHomePriceHistoryIndex(histories);

  return {
    popular: popular.map((entry) => withAmateurHomePriceChart(entry, historyByContentId, windowStartAt, windowEndAt)),
    campaign: campaign.map((entry) => withAmateurHomePriceChart(entry, historyByContentId, windowStartAt, windowEndAt)),
    latest: latestCards.map((entry) => withAmateurHomePriceChart(entry, historyByContentId, windowStartAt, windowEndAt)),
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

async function loadFanzaAmateurBrowsePage({ page = 1, pageSize = FANZA_AMATEUR_PAGE_SIZE, query, performer, genre, genres = [], maker, sort = "date_desc", campaignOnly = false, maxPrice, minRating, minPrice, releaseFrom, releaseTo }: FanzaAmateurBrowseFilter) {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(48, Math.max(1, Math.trunc(pageSize)));
  const safePerformer = performer?.trim().slice(0, 100);
  const performerContentIds = safePerformer ? await getCachedFanzaAmateurPerformerContentIds(safePerformer) : null;
  const criteria = buildFanzaAmateurBrowseCriteria({
    query, performer, genre, genres, maker, sort, campaignOnly, maxPrice, minRating, minPrice, releaseFrom, releaseTo,
  }, performerContentIds);
  const selection = sort === "rank" || campaignOnly
    ? await loadRankedFanzaAmateurBrowseSelection(criteria, safePage, safePageSize)
    : await loadStandardFanzaAmateurBrowseSelection(criteria, performerContentIds, safePage, safePageSize);
  const { items, totalCount, rankByContentId } = selection;
  const now = Date.now();
  const priceWindowEndAt = new Date(now).toISOString();
  const priceWindowStartAt = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const contentIds = items.map((item) => item.content_id);
  const historyRows = await loadAmateurSummaryPriceHistory(contentIds, priceWindowStartAt);

  const historyByContentId = new Map<string, Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null }>>();
  for (const row of historyRows) {
    const price = priceNumber(row.price);
    if (price == null) continue;
    const history = historyByContentId.get(row.content_id) ?? [];
    history.push({ price, changedAt: row.observed_at, priceKind: null });
    historyByContentId.set(row.content_id, history);
  }

  const enrichedItems = await addConfirmedPerformersToAmateurItems(items);
  const cards: FanzaAmateurHomeCard[] = enrichedItems.map((item) => {
    const history = [...(historyByContentId.get(item.content_id) ?? [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const priceHistory = item.currentPrice == null ? history : [
      ...history,
      { price: item.currentPrice, changedAt: priceWindowEndAt, priceKind: null, isCurrent: true },
    ];
    return {
      item,
      rank: rankByContentId.get(item.content_id),
      priceHistory,
      priceWindowStartAt,
      priceWindowEndAt,
      lowestObservedPrice: priceHistory.length ? Math.min(...priceHistory.map((point) => point.price)) : null,
    };
  });
  return { items, cards, page: safePage, totalCount, totalPages: Math.ceil(totalCount / safePageSize) };
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

/**
 * Select related amateur works from the saved API catalog. Since amateur works
 * do not have actress metadata, relation is based on series, genre, and maker.
 */
async function loadFanzaAmateurRelatedWorks(item: FanzaAmateurCatalogItem, limit = 12) {
  const filters = buildFanzaAmateurRelatedWorkFilters(item);
  if (filters.length === 0) return [];

  const queryResults = await Promise.all(filters.map(async ({ kind, value }) => {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .contains("iteminfo", { [kind]: [{ name: value }] })
      .order("api_date", { ascending: false, nullsFirst: false })
      .order("content_id", { ascending: true })
      .limit(24);

    if (error) throw new Error(`素人作品の関連候補を読み込めませんでした: ${error.message}`);
    return (data ?? []).map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item));
  }));

  return rankFanzaAmateurRelatedWorks(item, queryResults.flat(), limit, Date.now());
}

const getCachedFanzaAmateurRelatedWorks = unstable_cache(
  loadFanzaAmateurRelatedWorks,
  ["fanza-amateur-related-works-v1"],
  { revalidate: 300, tags: ["fanza-amateur-catalog"] },
);

export async function getFanzaAmateurRelatedWorks(item: FanzaAmateurCatalogItem, limit = 12) {
  return getCachedFanzaAmateurRelatedWorks(item, limit);
}
