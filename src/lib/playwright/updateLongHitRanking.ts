import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getLongHitRanking } from "./getLongHitRanking";
import { updateScore } from "../admin/updateScore";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateLongHitRanking() {
  const longHit = await getLongHitRanking();

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

const allWorks: { id: number; product_id: string }[] = [];

for (let i = 0; i < targetProductIds.length; i += 1000) {
  const chunk = targetProductIds.slice(i, i + 1000);

  const { data, error } = await supabase
    .from("works")
    .select("id, product_id")
    .in("product_id", chunk);

  if (error) {
    throw error;
  }

  if (data) {
    allWorks.push(...data);
  }
}

for (const work of allWorks) {

  const { error } = await supabase
  .from("works")
  .update({
    long_hit_rank: longHitMap.get(work.product_id) ?? null,
  })
  .eq("id", work.id);

if (error) {
  throw error;
}
}

console.log("LongHit ranking update completed.");

console.log(`DB登録済み作品: ${allWorks.length}件`);
}