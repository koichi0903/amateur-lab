import "server-only";

import { unstable_cache } from "next/cache";
import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { expandFanzaAmateurPriceSnapshotRows, type FanzaAmateurPriceHistoryRow, type FanzaAmateurPriceSnapshotRow } from "@/lib/dmm/fanzaAmateurPriceHistory";

export const FANZA_AMATEUR_FLOOR = "videoc";
export const FANZA_AMATEUR_PAGE_SIZE = 24;
export type FanzaAmateurSort = "date" | "review" | "price" | "-price";

export type FanzaAmateurCatalogItem = DmmItem & {
  product_id?: string;
  confirmedPerformers?: string[];
  affiliateURL: string;
  imageUrl: string | null;
  currentPrice: number | null;
  reviewAverage: number | null;
  campaigns: Array<{ title: string; dateBegin: string; dateEnd: string }>;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function priceNumber(value: unknown): number | null {
  const digits = asText(value).match(/[0-9]+/)?.[0];
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

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

async function loadAmateurDetailPriceHistory(contentId: string, observedSince: string) {
  const pageSize = 1_000;
  const rows: FanzaAmateurPriceHistoryRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabaseAdmin
      .from("fanza_amateur_price_history")
      .select("source_run_id,content_id,observed_at,price_type,price,list_price,price_data")
      .eq("content_id", contentId)
      .gte("observed_at", observedSince)
      .order("observed_at", { ascending: false })
      .order("price_type", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(`素人作品の価格履歴を読み込めませんでした: ${result.error.message}`);
    const page = (result.data ?? []) as FanzaAmateurPriceHistoryRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function getFanzaAmateurAffiliateId() {
  const configured = process.env.DMM_AMATEUR_AFFILIATE_ID?.trim();
  if (configured?.endsWith("-991")) return configured;

  const defaultId = process.env.DMM_AFFILIATE_ID?.trim();
  const derived = defaultId?.replace(/-\d{3}$/, "-991");
  if (derived?.endsWith("-991")) return derived;

  throw new Error("素人作品用のDMMアフィリエイトID 991を確認できません。");
}

function buildAffiliateUrl(canonicalUrl: string) {
  const target = new URL(canonicalUrl);
  if (target.hostname !== "video.dmm.co.jp" || !target.pathname.startsWith("/amateur/content/")) {
    throw new Error("保存された素人作品URLが想定外です。");
  }

  const affiliate = new URL("https://al.fanza.co.jp/");
  affiliate.searchParams.set("lurl", target.href);
  affiliate.searchParams.set("af_id", getFanzaAmateurAffiliateId());
  return affiliate.href;
}

export function normalizeFanzaAmateurCatalogItem(value: unknown): FanzaAmateurCatalogItem | null {
  if (!isRecord(value)) return null;
  const contentId = asText(value.content_id);
  const title = asText(value.title);
  const canonicalUrl = asText(value.URL);
  if (!contentId || !title || !canonicalUrl) return null;

  const image = isRecord(value.imageURL) ? value.imageURL : null;
  const sampleMovie = isRecord(value.sampleMovieURL) ? value.sampleMovieURL : null;
  const prices = isRecord(value.prices) ? value.prices : null;
  const review = isRecord(value.review) ? value.review : null;
  const rawItemInfo = isRecord(value.iteminfo) ? value.iteminfo : {};
  const rawCampaign = Array.isArray(value.campaign) ? value.campaign : value.campaign ? [value.campaign] : [];
  const sampleMovieURL = sampleMovie
    ? Object.fromEntries(
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
      ) as DmmItem["sampleMovieURL"]
    : undefined;
  const affiliateURL = asText(value.affiliateURL) || buildAffiliateUrl(canonicalUrl);

  return {
    ...(value as unknown as DmmItem),
    content_id: contentId,
    title,
    URL: canonicalUrl,
    affiliateURL,
    sampleMovieURL,
    date: asText(value.date),
    prices: {
      price: asText(prices?.price),
      list_price: asText(prices?.list_price),
      deliveries: (() => {
        const rawDeliveries = isRecord(prices?.deliveries) ? prices.deliveries.delivery : null;
        const deliveryRows = Array.isArray(rawDeliveries) ? rawDeliveries : rawDeliveries ? [rawDeliveries] : [];
        const delivery = deliveryRows.flatMap((row) => {
          if (!isRecord(row)) return [];
          const type = asText(row.type);
          return type ? [{ type, price: asText(row.price), list_price: asText(row.list_price) }] : [];
        });
        return delivery.length ? { delivery } : undefined;
      })(),
    },
    iteminfo: {
      actress: Array.isArray(rawItemInfo.actress) ? rawItemInfo.actress as NonNullable<DmmItem["iteminfo"]>["actress"] : [],
      genre: Array.isArray(rawItemInfo.genre) ? rawItemInfo.genre as NonNullable<DmmItem["iteminfo"]>["genre"] : [],
      maker: Array.isArray(rawItemInfo.maker) ? rawItemInfo.maker as NonNullable<DmmItem["iteminfo"]>["maker"] : [],
      series: Array.isArray(rawItemInfo.series) ? rawItemInfo.series as NonNullable<DmmItem["iteminfo"]>["series"] : [],
    },
    // DMM's list thumbnail can be only 90px wide; prefer the small variant
    // when the API does not provide a large cover.
    imageUrl: asText(image?.large) || asText(image?.small) || asText(image?.list) || null,
    currentPrice: priceNumber(prices?.price) ?? priceNumber(prices?.list_price),
    reviewAverage: Number.isFinite(Number(review?.average)) ? Number(review?.average) : null,
    campaigns: rawCampaign.flatMap((campaign) => {
      if (!isRecord(campaign)) return [];
      return [{ title: asText(campaign.title), dateBegin: asText(campaign.date_begin), dateEnd: asText(campaign.date_end) }];
    }),
  };
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

  const item = normalizeFanzaAmateurCatalogItem(data.raw_item);
  if (!item) return null;

    const savedImages = isRecord(data.image_url) ? data.image_url : {};
    item.imageURL = {
      ...(item.imageURL ?? {}),
      large: asText(savedImages.large) || item.imageURL?.large,
      small: asText(savedImages.small) || item.imageURL?.small,
      list: asText(savedImages.list) || item.imageURL?.list,
    };
    const savedSamples = isRecord(data.sample_image_url) ? data.sample_image_url : {};
    const savedLargeSamples = isRecord(savedSamples.sample_l) ? savedSamples.sample_l : {};
    const savedSmallSamples = isRecord(savedSamples.sample_s) ? savedSamples.sample_s : {};
    const savedLargeSampleImages = Array.isArray(savedLargeSamples.image) ? savedLargeSamples.image.filter((url): url is string => typeof url === "string") : [];
    const savedSmallSampleImages = Array.isArray(savedSmallSamples.image) ? savedSmallSamples.image.filter((url): url is string => typeof url === "string") : [];
    if (savedLargeSampleImages.length || savedSmallSampleImages.length) {
      item.sampleImageURL = {
        ...(item.sampleImageURL ?? {}),
        sample_l: savedLargeSampleImages.length ? { image: savedLargeSampleImages } : item.sampleImageURL?.sample_l,
        sample_s: savedSmallSampleImages.length ? { image: savedSmallSampleImages } : item.sampleImageURL?.sample_s,
      };
    }

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
  const historyByTimestampAndType = new Map<string, FanzaAmateurPriceHistoryRow>();
  for (const row of weeklySnapshots.data ?? []) {
    const expanded = expandFanzaAmateurPriceSnapshotRows(row as FanzaAmateurPriceSnapshotRow);
    for (const entry of expanded) historyByTimestampAndType.set(`${entry.observed_at}\u0000${entry.price_type}`, entry);
  }
  for (const row of history) {
    const entry = row;
    historyByTimestampAndType.set(`${entry.observed_at}\u0000${entry.price_type}`, entry);
  }
  const priceHistory = [...historyByTimestampAndType.values()]
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.price_type.localeCompare(b.price_type));

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

function campaignIsActive(item: FanzaAmateurCatalogItem, now = Date.now()) {
  const parseJst = (value: string) => {
    if (!value) return Number.NaN;
    const normalized = value.replace(" ", "T");
    return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}+09:00`);
  };

  return item.campaigns.some(({ dateBegin, dateEnd }) => {
    const start = parseJst(dateBegin);
    const end = parseJst(dateEnd);
    return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
  });
}

/**
 * Select related amateur works from the saved API catalog. Since amateur works
 * do not have actress metadata, relation is based on series, genre, and maker.
 */
async function loadFanzaAmateurRelatedWorks(item: FanzaAmateurCatalogItem, limit = 12) {
  const names = (values: Array<{ name: string }> | undefined) =>
    [...new Set((values ?? []).map(({ name }) => asText(name)).filter(Boolean))];
  const genres = names(item.iteminfo?.genre);
  const makers = names(item.iteminfo?.maker);
  const series = names(item.iteminfo?.series);
  const filters = [
    ...series.slice(0, 3).map((value) => ({ kind: "series" as const, value })),
    ...genres.slice(0, 6).map((value) => ({ kind: "genre" as const, value })),
    ...makers.slice(0, 3).map((value) => ({ kind: "maker" as const, value })),
  ];
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

  const candidates = new Map<string, FanzaAmateurCatalogItem>();
  for (const candidate of queryResults.flat()) {
    if (candidate && candidate.content_id !== item.content_id) candidates.set(candidate.content_id, candidate);
  }

  const currentGenres = new Set(genres);
  const currentMakers = new Set(makers);
  const currentSeries = new Set(series);
  const now = Date.now();
  const relevance = (candidate: FanzaAmateurCatalogItem) => {
    const candidateGenres = names(candidate.iteminfo?.genre);
    const candidateMakers = names(candidate.iteminfo?.maker);
    const candidateSeries = names(candidate.iteminfo?.series);
    const genreMatches = candidateGenres.filter((name) => currentGenres.has(name)).length;
    const hasMakerMatch = candidateMakers.some((name) => currentMakers.has(name));
    const hasSeriesMatch = candidateSeries.some((name) => currentSeries.has(name));
    const reviewCount = candidate.review?.count ?? 0;
    const reviewBonus = reviewCount > 0 && candidate.reviewAverage != null
      ? Math.max(0, Math.min(5, candidate.reviewAverage)) * 2
      : 0;

    return (hasSeriesMatch ? 45 : 0)
      + Math.min(50, genreMatches * 25)
      + (hasMakerMatch ? 15 : 0)
      + reviewBonus
      + (campaignIsActive(candidate, now) ? 6 : 0);
  };
  const releaseTime = (candidate: FanzaAmateurCatalogItem) => Date.parse(candidate.date || "") || 0;

  return [...candidates.values()]
    .sort((a, b) => relevance(b) - relevance(a)
      || releaseTime(b) - releaseTime(a)
      || (b.review?.count ?? 0) - (a.review?.count ?? 0)
      || a.content_id.localeCompare(b.content_id))
    .slice(0, Math.max(0, limit));
}

const getCachedFanzaAmateurRelatedWorks = unstable_cache(
  loadFanzaAmateurRelatedWorks,
  ["fanza-amateur-related-works-v1"],
  { revalidate: 300, tags: ["fanza-amateur-catalog"] },
);

export async function getFanzaAmateurRelatedWorks(item: FanzaAmateurCatalogItem, limit = 12) {
  return getCachedFanzaAmateurRelatedWorks(item, limit);
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

function hasActiveCampaign(item: FanzaAmateurCatalogItem, now: number) {
  return item.campaigns.some((campaign) => {
    const parseJst = (value: string) => {
      if (!value) return Number.NaN;
      const normalized = value.replace(" ", "T");
      return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}+09:00`);
    };
    const begins = parseJst(campaign.dateBegin);
    const ends = parseJst(campaign.dateEnd);
    return (!Number.isFinite(begins) || begins <= now) && (!Number.isFinite(ends) || ends >= now);
  });
}

const getDmmFanzaAmateurRankedCatalogPage = unstable_cache(async (offset: number) => {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: getFanzaAmateurAffiliateId(),
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
    const savedImages = isRecord(saved.image_url) ? saved.image_url : {};
    item.imageURL = {
      ...(item.imageURL ?? {}),
      large: asText(savedImages.large) || item.imageURL?.large,
      small: asText(savedImages.small) || item.imageURL?.small,
      list: asText(savedImages.list) || item.imageURL?.list,
    };
    const savedSamples = isRecord(saved.sample_image_url) ? saved.sample_image_url : {};
    const savedLargeSamples = isRecord(savedSamples.sample_l) ? savedSamples.sample_l : {};
    const savedSmallSamples = isRecord(savedSamples.sample_s) ? savedSamples.sample_s : {};
    const largeSampleImages = Array.isArray(savedLargeSamples.image) ? savedLargeSamples.image.filter((url): url is string => typeof url === "string") : [];
    const smallSampleImages = Array.isArray(savedSmallSamples.image) ? savedSmallSamples.image.filter((url): url is string => typeof url === "string") : [];
    if (largeSampleImages.length || smallSampleImages.length) {
      item.sampleImageURL = {
        ...(item.sampleImageURL ?? {}),
        sample_l: largeSampleImages.length ? { image: largeSampleImages } : item.sampleImageURL?.sample_l,
        sample_s: smallSampleImages.length ? { image: smallSampleImages } : item.sampleImageURL?.sample_s,
      };
    }
  }

  const histories = await loadAmateurSummaryPriceHistory(contentIds, windowStartAt);

  const historyByContentId = new Map<string, Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null }>>();
  for (const row of histories) {
    const price = priceNumber(row.price);
    if (price == null) continue;
    const history = historyByContentId.get(row.content_id) ?? [];
    history.push({ price, changedAt: row.observed_at, priceKind: null });
    historyByContentId.set(row.content_id, history);
  }

  const addChart = ({ item, rank }: { item: FanzaAmateurCatalogItem; rank?: number }): FanzaAmateurHomeCard => {
    const history = [...(historyByContentId.get(item.content_id) ?? [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    const currentPrice = item.currentPrice;
    const priceHistory = currentPrice == null ? history : [
      ...history,
      { price: currentPrice, changedAt: windowEndAt, priceKind: null, isCurrent: true },
    ];
    return {
      item,
      rank,
      priceHistory,
      priceWindowStartAt: windowStartAt,
      priceWindowEndAt: windowEndAt,
      lowestObservedPrice: priceHistory.length ? Math.min(...priceHistory.map((point) => point.price)) : null,
    };
  };

  return {
    popular: popular.map(addChart),
    campaign: campaign.map(addChart),
    latest: latestCards.map(addChart),
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

export type FanzaAmateurBrowseFilter = {
  page?: number;
  query?: string;
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

export type FanzaAmateurBrowseSort = "rank" | "date_desc" | "date_asc" | "review" | "discount" | "price" | "ending";

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

async function loadFanzaAmateurBrowsePage({ page = 1, query, genre, genres = [], maker, sort = "date_desc", campaignOnly = false, maxPrice, minRating, minPrice, releaseFrom, releaseTo }: FanzaAmateurBrowseFilter) {
  const safePage = Math.max(1, Math.trunc(page));
  let items: FanzaAmateurCatalogItem[];
  let totalCount: number;
  const rankByContentId = new Map<string, number>();
  const safeQuery = query?.trim().slice(0, 100);
  const selectedGenres = [...new Set([...genres, ...(genre ? [genre] : [])].map((value) => value.trim().slice(0, 100)).filter(Boolean))].slice(0, 30);
  const matchesAdvancedFilters = (item: FanzaAmateurCatalogItem) => {
    const releaseDate = item.date ?? "";
    if (releaseFrom && releaseDate && releaseDate.slice(0, 10) < releaseFrom) return false;
    if (releaseTo && releaseDate && releaseDate.slice(0, 10) > releaseTo) return false;
    if (selectedGenres.some((selected) => !item.iteminfo?.genre?.some((entry) => entry.name === selected))) return false;
    if (minPrice != null && (item.currentPrice == null || item.currentPrice < minPrice)) return false;
    return true;
  };
  if (sort === "rank" || campaignOnly) {
    const rankedCatalog = await getDmmFanzaAmateurRankedCatalog();
    const matchesFilters = (item: FanzaAmateurCatalogItem) => {
      if (safeQuery && !`${item.title} ${item.content_id} ${item.product_id ?? ""}`.toLocaleLowerCase("ja").includes(safeQuery.toLocaleLowerCase("ja"))) return false;
      if (genre && !item.iteminfo?.genre?.some((entry) => entry.name === genre)) return false;
      if (maker && !item.iteminfo?.maker?.some((entry) => entry.name === maker)) return false;
      if (campaignOnly && !hasActiveCampaign(item, Date.now())) return false;
      if (maxPrice != null && (item.currentPrice == null || item.currentPrice > maxPrice)) return false;
      if (minRating != null && (item.reviewAverage == null || item.reviewAverage < minRating)) return false;
      if (!matchesAdvancedFilters(item)) return false;
      return true;
    };
    const rankedItems = rankedCatalog
      .map((item, index) => ({ item, rank: index + 1 }))
      .filter(({ item }) => matchesFilters(item));
    const rankedIds = new Set(rankedCatalog.map((item) => item.content_id));
    const archivedCampaignItems = new Map<string, FanzaAmateurCatalogItem>();

    if (campaignOnly) {
      const pageSize = 1_000;
      const nowIso = new Date().toISOString();
      const activeCampaignIds = new Set<string>();
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabaseAdmin
          .from("fanza_amateur_campaigns")
          .select("content_id")
          .or(`and(starts_at.is.null,ends_at.gte.${nowIso}),and(starts_at.lte.${nowIso},ends_at.is.null),and(starts_at.lte.${nowIso},ends_at.gte.${nowIso})`)
          .order("content_id", { ascending: true })
          .order("campaign_index", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`順位未取得の素人セール作品を読み込めませんでした: ${error.message}`);

        for (const row of data ?? []) activeCampaignIds.add(row.content_id);
        if (!data || data.length < pageSize) break;
      }

      const unrankedCampaignIds = [...activeCampaignIds].filter((contentId) => !rankedIds.has(contentId));
      for (let offset = 0; offset < unrankedCampaignIds.length; offset += 300) {
        const contentIds = unrankedCampaignIds.slice(offset, offset + 300);
        const { data, error } = await supabaseAdmin
          .from("fanza_amateur_works")
          .select("raw_item")
          .in("content_id", contentIds);
        if (error) throw new Error(`順位未取得の素人セール作品を読み込めませんでした: ${error.message}`);
        for (const row of data ?? []) {
          const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
          if (item) archivedCampaignItems.set(item.content_id, item);
        }
      }
    }
    const catalogItems = campaignOnly
      ? [
          ...rankedCatalog.map((item, index) => ({ item, rank: index + 1 })),
          ...[...archivedCampaignItems.values()].map((item) => ({ item, rank: null as number | null })),
        ]
      : rankedCatalog.map((item, index) => ({ item, rank: index + 1 }));
    const matchedItems = catalogItems.filter(({ item }) => matchesFilters(item));
    const campaignEnd = (item: FanzaAmateurCatalogItem) => {
      const parseJst = (value: string) => {
        if (!value) return Number.NaN;
        const normalized = value.replace(" ", "T");
        return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}+09:00`);
      };
      const ends = item.campaigns.map(({ dateEnd }) => parseJst(dateEnd)).filter(Number.isFinite);
      return ends.length ? Math.min(...ends) : Number.POSITIVE_INFINITY;
    };
    const listPrice = (item: FanzaAmateurCatalogItem) => priceNumber(item.prices?.list_price);
    const discountRate = (item: FanzaAmateurCatalogItem) => {
      const current = item.currentPrice;
      const regular = listPrice(item);
      return current != null && regular != null && regular > current ? (regular - current) / regular : 0;
    };
    const allEntityWorks = !campaignOnly && sort === "rank" && !safeQuery && genres.length === 0 && maxPrice == null && minRating == null && minPrice == null && !releaseFrom && !releaseTo && Boolean((genre && !maker) || (!genre && maker));
    if (allEntityWorks) {
      const entityIds = [...new Set(await getCachedFanzaAmateurEntityContentIds(genre ? "genre" : "maker", genre ?? maker ?? ""))];
      const entityIdSet = new Set(entityIds);
      const rankedEntityItems = rankedItems.filter(({ item }) => entityIdSet.has(item.content_id));
      const rankedEntityIds = new Set(rankedEntityItems.map(({ item }) => item.content_id));
      const unrankedIds = entityIds.filter((contentId) => !rankedEntityIds.has(contentId));
      totalCount = entityIds.length;
      const start = (safePage - 1) * FANZA_AMATEUR_PAGE_SIZE;
      items = rankedEntityItems.slice(start, start + FANZA_AMATEUR_PAGE_SIZE).map(({ item, rank }) => {
        rankByContentId.set(item.content_id, rank);
        return item;
      });
      const unrankedStart = Math.max(0, start - rankedEntityItems.length);
      const unrankedSlots = FANZA_AMATEUR_PAGE_SIZE - items.length;
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
    } else {
      const ordered = campaignOnly ? [...matchedItems] : [...rankedItems];
      if (campaignOnly && sort === "rank") {
        ordered.sort((a, b) => {
          if (a.rank != null && b.rank != null) return a.rank - b.rank;
          if (a.rank != null) return -1;
          if (b.rank != null) return 1;
          return (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0)
            || a.item.content_id.localeCompare(b.item.content_id);
        });
      } else if (campaignOnly && sort === "discount") ordered.sort((a, b) => discountRate(b.item) - discountRate(a.item) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
      else if (campaignOnly && sort === "price") ordered.sort((a, b) => (a.item.currentPrice ?? Number.POSITIVE_INFINITY) - (b.item.currentPrice ?? Number.POSITIVE_INFINITY) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
      else if (campaignOnly && sort === "review") ordered.sort((a, b) => (b.item.reviewAverage ?? -1) - (a.item.reviewAverage ?? -1) || (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
      else if (campaignOnly && sort === "ending") ordered.sort((a, b) => campaignEnd(a.item) - campaignEnd(b.item) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
      totalCount = ordered.length;
      const pageItems = ordered.slice((safePage - 1) * FANZA_AMATEUR_PAGE_SIZE, safePage * FANZA_AMATEUR_PAGE_SIZE);
      items = pageItems.map(({ item, rank }) => {
        if (rank != null) rankByContentId.set(item.content_id, rank);
        return item;
      });
    }
  } else {
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
    for (const selectedGenre of selectedGenres) request = request.contains("iteminfo", { genre: [{ name: selectedGenre }] });
    if (maker) request = request.contains("iteminfo", { maker: [{ name: maker.slice(0, 100) }] });
    if (releaseFrom) request = request.gte("api_date", releaseFrom);
    if (releaseTo) request = request.lte("api_date", releaseTo);
    if (campaignOnly) request = request.not("campaign", "is", null);
    if (minPrice != null || sort === "price") {
      const allItems: FanzaAmateurCatalogItem[] = [];
      const batchSize = 1_000;
      for (let from = 0; ; from += batchSize) {
        const { data, error } = await request.range(from, from + batchSize - 1);
        if (error) throw new Error(`素人作品を検索できませんでした: ${error.message}`);
        const batch = (data ?? []).map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null).filter(matchesAdvancedFilters);
        allItems.push(...batch);
        if (!data || data.length < batchSize) break;
      }
      if (sort === "price") allItems.sort((a, b) => (a.currentPrice ?? Number.POSITIVE_INFINITY) - (b.currentPrice ?? Number.POSITIVE_INFINITY) || a.content_id.localeCompare(b.content_id));
      else if (sort === "date_asc") allItems.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.content_id.localeCompare(b.content_id));
      else if (sort === "review") allItems.sort((a, b) => (b.reviewAverage ?? -1) - (a.reviewAverage ?? -1) || (b.review?.count ?? 0) - (a.review?.count ?? 0));
      else allItems.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.content_id.localeCompare(b.content_id));
      totalCount = allItems.length;
      items = allItems.slice((safePage - 1) * FANZA_AMATEUR_PAGE_SIZE, safePage * FANZA_AMATEUR_PAGE_SIZE);
    } else {
      const { data, count, error } = await request.range((safePage - 1) * FANZA_AMATEUR_PAGE_SIZE, safePage * FANZA_AMATEUR_PAGE_SIZE - 1);
      if (error) throw new Error(`素人作品を検索できませんでした: ${error.message}`);
      const rows = (data ?? []) as Array<{ raw_item: unknown; fetched_at: string }>;
      items = rows.map((row) => normalizeFanzaAmateurCatalogItem(row.raw_item)).filter((item): item is FanzaAmateurCatalogItem => item !== null).filter(matchesAdvancedFilters);
      totalCount = count ?? 0;
    }
  }
  const now = Date.now();
  const priceWindowEndAt = new Date(now).toISOString();
  const priceWindowStartAt = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const contentIds = items.map((item) => item.content_id);
  const historyResult = await loadAmateurSummaryPriceHistory(contentIds, priceWindowStartAt);

  const historyByContentId = new Map<string, Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null }>>();
  for (const row of historyResult) {
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
  return { items, cards, page: safePage, totalCount, totalPages: Math.ceil(totalCount / FANZA_AMATEUR_PAGE_SIZE) };
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

