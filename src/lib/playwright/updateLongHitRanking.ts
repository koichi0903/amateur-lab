import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getLongHitRanking } from "./getLongHitRanking";
import {
  changedLongHitRankingProductIds,
  shouldReportLongHitRankingProgress,
  type LongHitRankingValueRow,
} from "./longHitRankingProjection";

type LongHitRankingProgress = (
  processed: number,
  total: number,
  productId: string,
) => Promise<void>;

type LongHitWorkRow = {
  id: number;
  product_id: string;
  long_hit_rank: number | null;
};

const QUERY_BATCH_SIZE = 1000;

async function fetchWorksByProductIds(productIds: string[]) {
  const works: LongHitWorkRow[] = [];

  for (let offset = 0; offset < productIds.length; offset += QUERY_BATCH_SIZE) {
    const productIdBatch = productIds.slice(offset, offset + QUERY_BATCH_SIZE);
    const { data, error } = await supabase
      .from("works")
      .select("id, product_id, long_hit_rank")
      .in("product_id", productIdBatch);

    if (error) throw error;
    if (data) works.push(...data);
  }

  return works;
}

async function fetchChangedRankProductIds(
  expectedRankByProduct: ReadonlyMap<string, number>,
) {
  const changedProductIds = new Set<string>();

  for (let offset = 0; ; offset += QUERY_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id,long_hit_rank")
      .not("long_hit_rank", "is", null)
      .range(offset, offset + QUERY_BATCH_SIZE - 1);

    if (error) throw error;

    for (const productId of changedLongHitRankingProductIds(
      (data ?? []) as LongHitRankingValueRow[],
      expectedRankByProduct,
    )) {
      changedProductIds.add(productId);
    }

    if (!data || data.length < QUERY_BATCH_SIZE) break;
  }

  return changedProductIds;
}

async function resetLongHitRanks() {
  const { error } = await supabase
    .from("works")
    .update({ long_hit_rank: null })
    .not("long_hit_rank", "is", null);

  if (error) throw error;
}

async function updateLongHitRanks(
  works: LongHitWorkRow[],
  expectedRankByProduct: ReadonlyMap<string, number>,
  onProgress?: LongHitRankingProgress,
) {
  for (let index = 0; index < works.length; index += 1) {
    const work = works[index];
    const nextRank = expectedRankByProduct.get(work.product_id) ?? null;
    const { error } = await supabase
      .from("works")
      .update({ long_hit_rank: nextRank })
      .eq("id", work.id);

    if (error) throw error;

    const processed = index + 1;
    if (shouldReportLongHitRankingProgress(processed, works.length)) {
      await onProgress?.(processed, works.length, work.product_id);
    }
  }
}

export async function updateLongHitRanking(onProgress?: LongHitRankingProgress) {
  const longHit = await getLongHitRanking();
  if (longHit.length === 0) {
    throw new Error("ロングヒットランキングの取得結果が0件です");
  }

  console.log(`LongHit取得件数: ${longHit.length}件`);

  const expectedRankByProduct = new Map(
    longHit.map((item: { productId: string; ranking: number }) => [
      item.productId,
      item.ranking,
    ]),
  );
  const works = await fetchWorksByProductIds([...expectedRankByProduct.keys()]);

  const changedProductIds = await fetchChangedRankProductIds(
    expectedRankByProduct,
  );
  for (const productId of changedLongHitRankingProductIds(
    works,
    expectedRankByProduct,
  )) {
    changedProductIds.add(productId);
  }

  await resetLongHitRanks();
  await updateLongHitRanks(works, expectedRankByProduct, onProgress);

  console.log("LongHit ranking update completed.");
  console.log(`DB登録済み作品: ${works.length}件`);
  return [...changedProductIds];
}
