import { createClient } from "@supabase/supabase-js";
import type { DmmItem } from "@/types/dmm";
import { updateTopRankingWorks } from "./updateTopRankingWorks";
import { saveDmmItem } from "./save";
import { failJob, JOBS } from "@/lib/jobs";

const RANKING_LIMIT = 1000;
const API_PAGE_SIZE = 100;
const DB_BATCH_SIZE = 500;
const SAVE_BATCH_SIZE = 10;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchRanking(
  apiId: string,
  affiliateId: string,
  offset: number
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

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `DMMランキングAPI取得失敗: offset=${offset} status=${response.status}`
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

async function updateRankingValues(
  rankingItems: Array<DmmItem & { rank: number }>
): Promise<void> {
  for (let i = 0; i < rankingItems.length; i += DB_BATCH_SIZE) {
    const rows = rankingItems.slice(i, i + DB_BATCH_SIZE).map((item) => ({
      product_id: item.content_id,
      ranking: item.rank,
    }));

    const { error } = await supabase
      .from("works")
      .upsert(rows, { onConflict: "product_id" });

    if (error) throw error;
  }
}

async function resetStaleRankings(currentProductIds: Set<string>): Promise<void> {
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

  for (let i = 0; i < staleIds.length; i += DB_BATCH_SIZE) {
    const { error } = await supabase
      .from("works")
      .update({ ranking: 9999 })
      .in("id", staleIds.slice(i, i + DB_BATCH_SIZE));

    if (error) throw error;
  }
}

export async function updateRanking() {
  try {
    const apiId = process.env.DMM_API_ID?.trim();
    const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();

    if (!apiId || !affiliateId) {
      throw new Error("DMM_API_ID または DMM_AFFILIATE_ID が未設定です");
    }

    const allItems: DmmItem[] = [];

    for (let offset = 1; offset <= 901; offset += API_PAGE_SIZE) {
      const items = await fetchRanking(apiId, affiliateId, offset);
      if (items.length !== API_PAGE_SIZE) {
        throw new Error(
          `DMMランキングAPIの取得件数が不足しています: offset=${offset} count=${items.length}`
        );
      }
      allItems.push(...items);
    }

    const uniqueItems = Array.from(
      new Map(allItems.map((item) => [item.content_id, item])).values()
    );

    if (uniqueItems.length !== RANKING_LIMIT) {
      throw new Error(
        `DMMランキング上位${RANKING_LIMIT}件を一意に取得できませんでした: ${uniqueItems.length}件`
      );
    }

    const rankingTargets = uniqueItems.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
    const productIds = rankingTargets.map((item) => item.content_id);
    const existingProductIds = new Set<string>();

    for (let i = 0; i < productIds.length; i += DB_BATCH_SIZE) {
      const { data, error } = await supabase
        .from("works")
        .select("product_id")
        .in("product_id", productIds.slice(i, i + DB_BATCH_SIZE));

      if (error) throw error;
      for (const work of data ?? []) existingProductIds.add(work.product_id);
    }

    const missingItems = rankingTargets.filter(
      (item) => !existingProductIds.has(item.content_id)
    );
    console.log(`[ranking] 未登録作品 ${missingItems.length}件をOLDで登録します`);

    for (let i = 0; i < missingItems.length; i += SAVE_BATCH_SIZE) {
      await Promise.all(
        missingItems.slice(i, i + SAVE_BATCH_SIZE).map(saveMissingItem)
      );
    }

    // 現在の上位1000件を先に確定し、成功後に圏外作品だけを解除する。
    await updateRankingValues(rankingTargets);
    await resetStaleRankings(new Set(productIds));

    // DMM APIだけでは補完できない価格・動画・詳細を上位1000件すべて確認する。
    await updateTopRankingWorks(rankingTargets);

    console.log(`[ranking] 上位${RANKING_LIMIT}件の更新が完了しました`);
    return rankingTargets;
  } catch (error) {
    await failJob(
      JOBS.RANKING,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}
