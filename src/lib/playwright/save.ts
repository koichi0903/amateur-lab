import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { ParsedData } from "./parser";
import { generateAndSaveInsight } from "@/lib/insights/generateAndSave";
import { saveLowestPriceEvent } from "@/lib/insights/event";
import {
  deriveWorkPriceSummary,
  validatePriceData,
} from "./savePriceData";
import {
  buildWorkRecordUpdate,
  type ExistingWorkRecord,
} from "./saveWorkRecord";
import { syncWorkPrices } from "./syncWorkPrices";
import { buildLegacyPricePeriodPlan } from "./legacyPricePeriodPlan";

// saveWork は管理ジョブ専用。anon key では RLS により更新が0件になる場合がある。
async function repairLegacyPriceHistoryPeriods(
  productId: string,
  prices: ParsedData["prices"],
): Promise<boolean> {
  const { data: legacyRows, error } = await supabase
    .from("price_history")
    .select("id,display_name,normal_price,changed_at")
    .eq("product_id", productId)
    .is("period", null);
  if (error) throw error;
  if (!legacyRows?.length) return false;

  const { updates, unresolved } = buildLegacyPricePeriodPlan(legacyRows, prices);
  let changed = false;

  for (const [period, ids] of updates) {
    const { error: updateError } = await supabase
      .from("price_history")
      .update({ period })
      .in("id", ids);
    if (updateError) throw updateError;
    if (ids.length > 0) changed = true;
  }

  if (unresolved.length > 0) {
    const { error: deleteError } = await supabase
      .from("price_history")
      .delete()
      .in("id", unresolved);
    if (deleteError) throw deleteError;
    changed = true;
  }

  return changed;
}
export async function saveWork(
  productId: string,
  data: ParsedData,
  listPrice?: number | null
): Promise<boolean> {
  validatePriceData(productId, data.prices);
  const priceSummary = deriveWorkPriceSummary(data.prices, data.saleEndAt);

const { data: currentWork, error: currentError } =
  await supabase
    .from("works")
    .select(`
  price,
  list_price,
  sale_price,
  lowest_price,
  discount_rate,
  max_discount_rate,
  is_on_sale,
  sale_end_at,
  playwright_status,
  stage,
  is_bottom_price,
  is_lowest_price,
  actress
`)
    .eq("product_id", productId)
    .single();

if (currentError) {
  console.error(currentError);
}

const rowChange = buildWorkRecordUpdate(
  (currentWork ?? null) as ExistingWorkRecord | null,
  data,
  priceSummary,
  listPrice,
);
const { changed, workUpdate, currentDisplayPrice, lowestPrice, isNewLowestPrice } = rowChange;

let updated = null;
let error = null;

if (changed) {
  const result = await supabase
    .from("works")
    .update({
      ...workUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("product_id", productId)
    .select("id,title,list_price,price,sale_price,lowest_price,previous_realtime_rank,realtime_rank");

  updated = result.data;
  error = result.error;

  if (error) {
    console.error("UPDATE ERROR", error);
  }
} else {
  const { error: touchError } = await supabase
    .from("works")
    .update({ updated_at: new Date().toISOString() })
    .eq("product_id", productId);

  if (touchError) {
    console.error("UPDATE CHECKED_AT ERROR", touchError);
    throw touchError;
  }

  console.log(
    `[CHECKED] works変更なし ${productId}`
  );
}
  const priceDataChanged = await syncWorkPrices(productId, data.prices);

const legacyPriceHistoryChanged = await repairLegacyPriceHistoryPeriods(productId, data.prices);

if (updated && updated.length > 0) {
  await generateAndSaveInsight(updated[0]);

  if (isNewLowestPrice) {
    await saveLowestPriceEvent({
  workId: updated[0].id,
  currentPrice: currentDisplayPrice!,
  previousLowestPrice: currentWork?.lowest_price ?? null,
  lowestPrice: lowestPrice!,
});
  }
}

return Boolean(updated?.length) || priceDataChanged || legacyPriceHistoryChanged;
}
