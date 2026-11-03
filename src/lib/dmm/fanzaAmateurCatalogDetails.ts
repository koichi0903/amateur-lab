import "server-only";

import { unstable_cache } from "next/cache";
import { buildFanzaAmateurAffiliateUrl } from "@/lib/dmm/fanzaAmateurAffiliate";
import { hasActiveCampaign } from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
import { mergeCatalogDetailPriceHistory, mergeStoredCatalogMedia } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";
import { buildFanzaAmateurSamplePlayerUrl } from "@/lib/dmm/fanzaAmateurSamplePlayer";
import { asText, normalizeFanzaAmateurCatalogItem as normalizeCatalogItem, type FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { buildFanzaAmateurRelatedWorkQueryArgs } from "@/lib/dmm/fanzaAmateurRelatedWorkQuery";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { expandFanzaAmateurPriceSnapshotRows, type FanzaAmateurPriceHistoryRow, type FanzaAmateurPriceSnapshotRow } from "@/lib/dmm/fanzaAmateurPriceHistory";

function normalizeAmateurCatalogItem(value: unknown): FanzaAmateurCatalogItem | null {
  return normalizeCatalogItem(value, buildFanzaAmateurAffiliateUrl);
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

export function getFanzaAmateurSamplePlayerUrl(item: FanzaAmateurCatalogItem) {
  return buildFanzaAmateurSamplePlayerUrl(item.sampleMovieURL, item.content_id);
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

  const item = normalizeAmateurCatalogItem(data.raw_item);
  if (!item) return null;

  const itemWithSavedMedia = mergeStoredCatalogMedia(item, data.image_url, data.sample_image_url);

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
  const snapshots = (weeklySnapshots.data ?? []) as FanzaAmateurPriceSnapshotRow[];
  const priceHistory = mergeCatalogDetailPriceHistory(history, snapshots, expandFanzaAmateurPriceSnapshotRows);

  return {
    item: itemWithSavedMedia,
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

/**
 * Select related amateur works from the saved API catalog. Since amateur works
 * do not have actress metadata, relation is based on series, genre, and maker.
 */
async function loadFanzaAmateurRelatedWorks(item: FanzaAmateurCatalogItem, limit = 12) {
  const queryArgs = buildFanzaAmateurRelatedWorkQueryArgs(item);
  const { genres, makers, series } = queryArgs;
  if (!queryArgs.p_series_names.length && !queryArgs.p_genre_names.length && !queryArgs.p_maker_names.length) return [];

  const { data, error } = await supabaseAdmin.rpc("get_fanza_amateur_related_work_candidates", {
    p_series_names: queryArgs.p_series_names,
    p_genre_names: queryArgs.p_genre_names,
    p_maker_names: queryArgs.p_maker_names,
    p_per_entity_limit: 24,
  });
  if (error) throw new Error(`素人作品の関連候補を読み込めませんでした: ${error.message}`);

  const candidates = new Map<string, FanzaAmateurCatalogItem>();
  const names = (values: Array<{ name: string }> | undefined) =>
    [...new Set((values ?? []).map(({ name }) => asText(name)).filter(Boolean))];
  for (const row of data ?? []) {
    const candidate = normalizeAmateurCatalogItem(row.raw_item);
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
      + (hasActiveCampaign(candidate, now) ? 6 : 0);
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
