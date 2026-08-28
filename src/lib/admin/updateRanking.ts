import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  beginJob,
  failJob,
  finishJob,
  JOBS,
  updateJobProgress,
} from "@/lib/jobs";
import { updateRanking as updatePopularityRankings } from "@/lib/playwright/updateRanking";
import { updateLongHitRanking } from "@/lib/playwright/updateLongHitRanking";
import { getRealtimeRanking } from "@/lib/playwright/getRealtimeRanking";
import { saveDmmItem } from "./save";
import { updateEntityRankings, type RankedDmmItem } from "./updateEntityRankings";
import {
  selectRankingPlaywrightTargets,
  type RankingWorkSnapshot,
} from "./rankingPlaywrightTargets";
import { updateTopRankingWorks } from "./updateTopRankingWorks";
import { RANKING_UPDATE_CONFIG } from "@/config/update";

const RANKING_LIMIT = RANKING_UPDATE_CONFIG.targetCount;
const API_PAGE_SIZE = RANKING_UPDATE_CONFIG.apiPageSize;
const API_PAGE_COUNT = Math.ceil(RANKING_LIMIT / API_PAGE_SIZE);
const API_MAX_PAGE_COUNT = Math.ceil(API_PAGE_COUNT * 1.5);
const FANZA_PAGE_COUNT = Math.ceil(
  RANKING_LIMIT / RANKING_UPDATE_CONFIG.fanzaItemsPerPage,
);
const DB_BATCH_SIZE = 500;
const SAVE_BATCH_SIZE = 10;
const JOB_TOTAL = 100;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

type RankingPhase =
  | "ranking_api"
  | "ranking_register"
  | "ranking_save"
  | "ranking_price_scan"
  | "ranking_playwright"
  | "ranking_popularity"
  | "ranking_long_hit"
  | "ranking_entities"
  | "ranking_finalize";

async function reportProgress(
  processedCount: number,
  phase: RankingPhase,
  current?: number,
  total?: number,
  productId?: string,
) {
  await updateJobProgress(JOBS.RANKING, {
    processedCount: Math.min(Math.max(processedCount, 0), JOB_TOTAL),
    totalCount: JOB_TOTAL,
    detail: { phase, current, total, productId },
  });
}

async function fetchRankingPage(
  apiId: string,
  affiliateId: string,
  offset: number,
): Promise<DmmItem[]> {
  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${encodeURIComponent(apiId)}` +
    `&affiliate_id=${encodeURIComponent(affiliateId)}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    `&hits=${API_PAGE_SIZE}` +
    `&offset=${offset}` +
    "&sort=rank" +
    "&output=json";

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(
      `DMMランキングAPI取得失敗: offset=${offset} status=${response.status}`,
    );
  }

  const payload: unknown = await response.json();
  const items =
    typeof payload === "object" && payload !== null &&
    "result" in payload &&
    typeof payload.result === "object" && payload.result !== null &&
    "items" in payload.result
      ? payload.result.items
      : null;

  if (!Array.isArray(items)) {
    throw new Error(`DMMランキングAPIの応答形式が不正です: offset=${offset}`);
  }
  return items as DmmItem[];
}

async function workExists(productId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("works")
    .select("product_id")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function saveMissingItem(item: DmmItem): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const saved = await saveDmmItem(item, undefined, "OLD");
    if (saved || (await workExists(item.content_id))) return;
    if (attempt < 2) {
      console.warn(`[ranking] 登録を再試行します: ${item.content_id}`);
    }
  }
  throw new Error(`ランキング作品の初回登録に失敗しました: ${item.content_id}`);
}

async function updateRankingValues(rankingItems: RankedDmmItem[]) {
  for (let index = 0; index < rankingItems.length; index += DB_BATCH_SIZE) {
    const batch = rankingItems.slice(index, index + DB_BATCH_SIZE);
    const rows = batch.map((item) => ({
      product_id: item.content_id,
      ranking: item.rank,
    }));
    const { error } = await supabase
      .from("works")
      .upsert(rows, { onConflict: "product_id" });
    if (error) throw error;

    const saved = index + batch.length;
    await reportProgress(
      20 + Math.round((saved / rankingItems.length) * 5),
      "ranking_save",
      saved,
      rankingItems.length,
      batch.at(-1)?.content_id,
    );
  }
}

async function resetStaleRankings(currentProductIds: Set<string>) {
  const staleIds: number[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("id,product_id")
      .lt("ranking", 9999)
      .range(from, from + pageSize - 1);
    if (error) throw error;

    for (const work of data ?? []) {
      if (!currentProductIds.has(work.product_id)) staleIds.push(work.id);
    }
    if (!data || data.length < pageSize) break;
  }

  for (let index = 0; index < staleIds.length; index += DB_BATCH_SIZE) {
    const { error } = await supabase
      .from("works")
      .update({ ranking: 9999 })
      .in("id", staleIds.slice(index, index + DB_BATCH_SIZE));
    if (error) throw error;
  }
}

async function loadRankingWorkSnapshots(
  productIds: string[],
): Promise<Map<string, RankingWorkSnapshot>> {
  const snapshots = new Map<string, RankingWorkSnapshot>();

  for (let index = 0; index < productIds.length; index += DB_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id,price,list_price,sale_price,url,playwright_status,updated_at",
      )
      .in("product_id", productIds.slice(index, index + DB_BATCH_SIZE));

    if (error) throw error;
    for (const work of data ?? []) snapshots.set(work.product_id, work);
  }

  return snapshots;
}

export async function updateRanking() {
  await beginJob(JOBS.RANKING, JOB_TOTAL);

  try {
    const apiId = process.env.DMM_API_ID?.trim();
    const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();
    if (!apiId || !affiliateId) {
      throw new Error("DMM_API_ID または DMM_AFFILIATE_ID が未設定です");
    }

    await reportProgress(0, "ranking_api", 0, RANKING_LIMIT);
    const uniqueItemsById = new Map<string, DmmItem>();
    let page = 0;
    for (
      let offset = 1;
      page < API_MAX_PAGE_COUNT && uniqueItemsById.size < RANKING_LIMIT;
      offset += API_PAGE_SIZE
    ) {
      const items = await fetchRankingPage(apiId, affiliateId, offset);
      if (items.length === 0) break;

      for (const item of items) {
        if (item.content_id && !uniqueItemsById.has(item.content_id)) {
          uniqueItemsById.set(item.content_id, item);
        }
      }

      page += 1;
      await reportProgress(
        Math.min(10, Math.round((uniqueItemsById.size / RANKING_LIMIT) * 10)),
        "ranking_api",
        Math.min(uniqueItemsById.size, RANKING_LIMIT),
        RANKING_LIMIT,
      );

      if (items.length < API_PAGE_SIZE) break;
    }

    const uniqueItems = Array.from(uniqueItemsById.values()).slice(0, RANKING_LIMIT);
    if (uniqueItems.length < RANKING_LIMIT) {
      throw new Error(
        `DMMランキング上位${RANKING_LIMIT}件を一意に取得できませんでした: ${uniqueItems.length}件（${page}ページ取得）`,
      );
    }

    const rankingTargets: RankedDmmItem[] = uniqueItems.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
    const productIds = rankingTargets.map((item) => item.content_id);
    const existingProductIds = new Set<string>();
    for (let index = 0; index < productIds.length; index += DB_BATCH_SIZE) {
      const { data, error } = await supabase
        .from("works")
        .select("product_id")
        .in("product_id", productIds.slice(index, index + DB_BATCH_SIZE));
      if (error) throw error;
      for (const work of data ?? []) existingProductIds.add(work.product_id);
    }

    const missingItems = rankingTargets.filter(
      (item) => !existingProductIds.has(item.content_id),
    );
    await reportProgress(10, "ranking_register", 0, missingItems.length);
    for (let index = 0; index < missingItems.length; index += SAVE_BATCH_SIZE) {
      const batch = missingItems.slice(index, index + SAVE_BATCH_SIZE);
      await Promise.all(batch.map(saveMissingItem));
      const saved = index + batch.length;
      await reportProgress(
        10 + Math.round((saved / Math.max(missingItems.length, 1)) * 10),
        "ranking_register",
        saved,
        missingItems.length,
        batch.at(-1)?.content_id,
      );
    }
    if (missingItems.length === 0) {
      await reportProgress(20, "ranking_register", 0, 0);
    }

    await reportProgress(20, "ranking_save", 0, RANKING_LIMIT);
    await updateRankingValues(rankingTargets);
    await resetStaleRankings(new Set(productIds));

    await reportProgress(25, "ranking_price_scan", 0, FANZA_PAGE_COUNT);
    const realtimeListings = await getRealtimeRanking();
    if (realtimeListings.length === 0) {
      throw new Error("FANZA人気順一覧の価格取得結果が0件です");
    }

    const listingByProductId = new Map(
      realtimeListings.map((listing) => [listing.productId, listing]),
    );
    const worksByProductId = await loadRankingWorkSnapshots(productIds);
    const newlyRegisteredIds = new Set(
      missingItems.map((item) => item.content_id),
    );
    const playwrightTargets = selectRankingPlaywrightTargets(
      rankingTargets,
      worksByProductId,
      listingByProductId,
    ).map((target) => ({
      ...target,
      captureSampleMovie: newlyRegisteredIds.has(target.item.content_id),
    }));
    const skippedCount = rankingTargets.length - playwrightTargets.length;

    console.log(
      `[ranking] FANZA一覧${realtimeListings.length}件、詳細更新${playwrightTargets.length}件、SKIP${skippedCount}件`,
    );

    await reportProgress(
      30,
      "ranking_playwright",
      0,
      playwrightTargets.length,
    );
    await updateTopRankingWorks(playwrightTargets, async (processed, total, productId) => {
      await reportProgress(
        30 + Math.round((processed / Math.max(total, 1)) * 40),
        "ranking_playwright",
        processed,
        total,
        productId,
      );
    });

    await reportProgress(70, "ranking_popularity", 0, 0);
    await updatePopularityRankings(
      async (processed, total, productId) => {
        await reportProgress(
          70 + Math.round((processed / Math.max(total, 1)) * 12),
          "ranking_popularity",
          processed,
          total,
          productId,
        );
      },
      realtimeListings,
    );

    await reportProgress(82, "ranking_long_hit", 0, 0);
    await updateLongHitRanking(async (processed, total, productId) => {
      await reportProgress(
        82 + Math.round((processed / Math.max(total, 1)) * 6),
        "ranking_long_hit",
        processed,
        total,
        productId,
      );
    });

    await reportProgress(88, "ranking_entities", 0, 7);
    const entityCounts = await updateEntityRankings(
      rankingTargets,
      async (processed, total) => {
        await reportProgress(
          88 + Math.round((processed / Math.max(total, 1)) * 10),
          "ranking_entities",
          processed,
          total,
        );
      },
    );

    await reportProgress(100, "ranking_finalize", 1, 1);
    await finishJob(JOBS.RANKING);
    console.log(`[ranking] 上位${RANKING_LIMIT}件のランキング更新が完了しました`);

    return {
      success: true,
      count: rankingTargets.length,
      missingRegistered: missingItems.length,
      playwrightUpdated: playwrightTargets.length,
      playwrightSkipped: skippedCount,
      entityCounts,
    };
  } catch (error) {
    await failJob(JOBS.RANKING, errorMessage(error));
    throw error;
  }
}
