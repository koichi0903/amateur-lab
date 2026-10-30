import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getRequiredFanzaAmateurPriceHistoryKeys,
  reconstructChangedFanzaAmateurPriceHistoryRows,
  rememberNewestFanzaAmateurPriceHistoryValues,
  selectDailyFanzaAmateurPriceHistoryRows,
  type FanzaAmateurPriceHistoryBackfillSourceRow,
  type FanzaAmateurPriceHistoryValuesByWork,
} from "./fanzaAmateurPriceHistoryBackfill";
import {
  type FanzaAmateurPriceHistoryRow,
} from "./fanzaAmateurPriceHistoryRows";

export {
  expandFanzaAmateurPriceSnapshotRows,
  extractFanzaAmateurPriceHistoryRows,
  getFanzaAmateurPriceValues,
  selectChangedFanzaAmateurPriceHistoryRows,
  selectChangedFanzaAmateurPriceHistoryRowsByWork,
} from "./fanzaAmateurPriceHistoryRows";
export type {
  FanzaAmateurPriceHistoryRow,
  FanzaAmateurPriceSnapshotRow,
  FanzaAmateurPriceValue,
} from "./fanzaAmateurPriceHistoryRows";

const BACKFILL_BATCH_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;

async function upsertHistoryRows(rows: FanzaAmateurPriceHistoryRow[]) {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const { error } = await supabaseAdmin
      .from("fanza_amateur_price_history")
      .upsert(rows.slice(index, index + UPSERT_BATCH_SIZE), {
        onConflict: "content_id,observed_date_jst,price_type",
      });
    if (error) throw new Error(`素人作品の価格履歴を保存できませんでした: ${error.message}`);
  }
}

export async function getFanzaAmateurPriceHistoryBackfillStatus() {
  const [raw, history] = await Promise.all([
    supabaseAdmin.from("fanza_amateur_api_catalog_items").select("run_id", { count: "exact", head: true }),
    supabaseAdmin.from("fanza_amateur_price_history").select("content_id", { count: "exact", head: true }),
  ]);
  if (raw.error) throw new Error(`保存済みAPI履歴件数を読めませんでした: ${raw.error.message}`);
  if (history.error) throw new Error(`価格履歴件数を読めませんでした: ${history.error.message}`);
  return { sourceItemCount: raw.count ?? 0, priceChangeCount: history.count ?? 0 };
}

export async function backfillFanzaAmateurPriceHistory(offset: number) {
  const safeOffset = Math.max(0, Math.floor(offset));
  const { data, count, error } = await supabaseAdmin
    .from("fanza_amateur_api_catalog_items")
    .select("run_id,content_id,fetched_at,raw_item", { count: "exact" })
    .order("fetched_at", { ascending: true })
    .order("run_id", { ascending: true })
    .order("source_offset", { ascending: true })
    .range(safeOffset, safeOffset + BACKFILL_BATCH_SIZE - 1);
  if (error) throw new Error(`保存済みAPI履歴を読めませんでした: ${error.message}`);

  const sourceRows = (data ?? []) as FanzaAmateurPriceHistoryBackfillSourceRow[];
  const previousByWork: FanzaAmateurPriceHistoryValuesByWork = new Map();
  const requiredKeys = getRequiredFanzaAmateurPriceHistoryKeys(sourceRows);

  if (sourceRows.length > 0) {
    const contentIds = [...new Set(sourceRows.map((row) => row.content_id))];
    const before = sourceRows.reduce((minimum, row) => row.fetched_at < minimum ? row.fetched_at : minimum, sourceRows[0].fetched_at);
    const seenKeys = new Set<string>();
    for (let historyOffset = 0; seenKeys.size < requiredKeys.size; historyOffset += BACKFILL_BATCH_SIZE) {
      const prior = await supabaseAdmin
        .from("fanza_amateur_price_history")
        .select("content_id,price_type,price,list_price")
        .in("content_id", contentIds)
        .lt("observed_at", before)
        .order("observed_at", { ascending: false })
        .range(historyOffset, historyOffset + BACKFILL_BATCH_SIZE - 1);
      if (prior.error) throw new Error(`直前の価格履歴を読めませんでした: ${prior.error.message}`);
      const priorRows = (prior.data ?? []) as Pick<FanzaAmateurPriceHistoryRow, "content_id" | "price_type" | "price" | "list_price">[];
      if (priorRows.length === 0) break;
      rememberNewestFanzaAmateurPriceHistoryValues(priorRows, requiredKeys, seenKeys, previousByWork);
      if (priorRows.length < BACKFILL_BATCH_SIZE) break;
    }
  }

  const changedRows = reconstructChangedFanzaAmateurPriceHistoryRows(sourceRows, previousByWork);
  const dailyChangedRows = selectDailyFanzaAmateurPriceHistoryRows(changedRows);
  await upsertHistoryRows(dailyChangedRows);

  const nextOffset = safeOffset + sourceRows.length;
  const sourceItemCount = count ?? nextOffset;
  return {
    nextOffset,
    processedItemCount: nextOffset,
    sourceItemCount,
    insertedChangeCount: changedRows.length,
    done: sourceRows.length < BACKFILL_BATCH_SIZE || nextOffset >= sourceItemCount,
  };
}
