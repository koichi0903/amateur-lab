import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getRequiredFanzaAmateurPriceHistoryKeys,
  reconstructChangedFanzaAmateurPriceHistoryRows,
  rememberNewestFanzaAmateurPriceHistoryValues,
  selectDailyFanzaAmateurPriceHistoryRows,
} from "./fanzaAmateurPriceHistoryBackfill";
import type { FanzaAmateurPriceHistoryValuesByWork } from "./fanzaAmateurPriceHistoryBackfill";
import { selectChangedFanzaAmateurPriceHistoryRowsByWork as projectChangedPriceRowsByWork } from "./fanzaAmateurPriceHistoryRows";

type JsonRecord = Record<string, unknown>;
type RawCatalogRow = {
  run_id: string;
  content_id: string;
  fetched_at: string;
  raw_item: JsonRecord;
};

export type FanzaAmateurPriceValue = { price: string | null; list_price: string | null };
type PriceValue = FanzaAmateurPriceValue;
type PriceValuesByWork = FanzaAmateurPriceHistoryValuesByWork;

export type FanzaAmateurPriceHistoryRow = {
  content_id: string;
  source_run_id: string;
  observed_at: string;
  price_type: string;
  price: string | null;
  list_price: string | null;
  price_data: unknown;
};

export type FanzaAmateurPriceSnapshotRow = {
  source_run_id: string;
  content_id: string;
  observed_at: string;
  prices: unknown;
};

const BACKFILL_BATCH_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function priceText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export function extractFanzaAmateurPriceHistoryRows(
  contentId: string,
  runId: string,
  rawItem: JsonRecord,
  observedAt: string,
): FanzaAmateurPriceHistoryRow[] {
  const prices = isRecord(rawItem.prices) ? rawItem.prices : {};
  const rows: FanzaAmateurPriceHistoryRow[] = [{
    content_id: contentId,
    source_run_id: runId,
    observed_at: observedAt,
    price_type: "summary",
    price: priceText(prices.price),
    list_price: priceText(prices.list_price),
    price_data: prices,
  }];

  const deliveries = isRecord(prices.deliveries) ? prices.deliveries.delivery : null;
  const deliveryRows = Array.isArray(deliveries) ? deliveries : deliveries ? [deliveries] : [];
  const typeOccurrences = new Map<string, number>();
  for (const [index, delivery] of deliveryRows.entries()) {
    if (!isRecord(delivery)) continue;
    const type = priceText(delivery.type)?.trim() || `unknown_${index + 1}`;
    const occurrence = (typeOccurrences.get(type) ?? 0) + 1;
    typeOccurrences.set(type, occurrence);
    rows.push({
      content_id: contentId,
      source_run_id: runId,
      observed_at: observedAt,
      price_type: occurrence === 1 ? type : `${type}#${occurrence}`,
      price: priceText(delivery.price),
      list_price: priceText(delivery.list_price),
      price_data: delivery,
    });
  }
  return rows;
}

function priceValuesFromRows(rows: FanzaAmateurPriceHistoryRow[]): Map<string, PriceValue> {
  return new Map(rows.map((row) => [row.price_type, {
    price: row.price,
    list_price: row.list_price,
  }]));
}

export function getFanzaAmateurPriceValues(rawItem: JsonRecord): Map<string, FanzaAmateurPriceValue> {
  return priceValuesFromRows(extractFanzaAmateurPriceHistoryRows("", "", rawItem, ""));
}

export function expandFanzaAmateurPriceSnapshotRows(
  snapshot: FanzaAmateurPriceSnapshotRow,
): FanzaAmateurPriceHistoryRow[] {
  return extractFanzaAmateurPriceHistoryRows(
    snapshot.content_id,
    snapshot.source_run_id,
    { prices: isRecord(snapshot.prices) ? snapshot.prices : {} },
    snapshot.observed_at,
  );
}

export function selectChangedFanzaAmateurPriceHistoryRows(
  rows: FanzaAmateurPriceHistoryRow[],
  previous: Map<string, FanzaAmateurPriceValue> | undefined,
) {
  const current = priceValuesFromRows(rows);
  return rows.filter((row) => {
    const before = previous?.get(row.price_type);
    const after = current.get(row.price_type);
    return !before || !after || before.price !== after.price || before.list_price !== after.list_price;
  });
}

export function selectChangedFanzaAmateurPriceHistoryRowsByWork(
  rows: FanzaAmateurPriceHistoryRow[],
  previousByWork: PriceValuesByWork,
) {
  return projectChangedPriceRowsByWork(rows, previousByWork);
}

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

  const sourceRows = (data ?? []) as RawCatalogRow[];
  const previousByWork: PriceValuesByWork = new Map();
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
