import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getLongHitRanking } from "./getLongHitRanking";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type LongHitRankingProgress = (
  processed: number,
  total: number,
  productId: string,
) => Promise<void>;

export async function updateLongHitRanking(onProgress?: LongHitRankingProgress) {
  const changedProductIds = new Set<string>();
  const longHit = await getLongHitRanking();

if (longHit.length === 0) {
  throw new Error("ロングヒットランキングの取得結果が0件です");
}

console.log(
  `LongHit取得件数: ${longHit.length}件`
);
const longHitMap = new Map(
  longHit.map((item: { productId: string; ranking: number }) => [
    item.productId,
    item.ranking,
  ])
);
const targetProductIds = [...longHitMap.keys()];

const allWorks: { id: number; product_id: string; long_hit_rank: number | null }[] = [];

for (let i = 0; i < targetProductIds.length; i += 1000) {
  const chunk = targetProductIds.slice(i, i + 1000);

  const { data, error } = await supabase
    .from("works")
    .select("id, product_id, long_hit_rank")
    .in("product_id", chunk);

  if (error) {
    throw error;
  }

  if (data) {
    allWorks.push(...data);
  }
}

for (let from = 0; ; from += 1000) {
  const { data: resetRows, error: resetRowsError } = await supabase
    .from("works")
    .select("product_id,long_hit_rank")
    .not("long_hit_rank", "is", null)
    .range(from, from + 999);
  if (resetRowsError) throw resetRowsError;
  for (const work of resetRows ?? []) {
    const expectedRank = longHitMap.get(work.product_id) ?? null;
    if (work.long_hit_rank !== expectedRank) {
      changedProductIds.add(work.product_id);
    }
  }
  if (!resetRows || resetRows.length < 1000) break;
}

const { error: resetError } = await supabase
  .from("works")
  .update({ long_hit_rank: null })
  .not("long_hit_rank", "is", null);

if (resetError) {
  throw resetError;
}

for (let index = 0; index < allWorks.length; index += 1) {
  const work = allWorks[index];

  const nextRank = longHitMap.get(work.product_id) ?? null;
  if (work.long_hit_rank !== nextRank) changedProductIds.add(work.product_id);
  const { error } = await supabase
  .from("works")
  .update({
    long_hit_rank: nextRank,
  })
  .eq("id", work.id);

if (error) {
  throw error;
}

const processed = index + 1;
if (processed % 10 === 0 || processed === allWorks.length) {
  await onProgress?.(processed, allWorks.length, work.product_id);
}
}

console.log("LongHit ranking update completed.");

console.log(`DB登録済み作品: ${allWorks.length}件`);
return [...changedProductIds];
}
