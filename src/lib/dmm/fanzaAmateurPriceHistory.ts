import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JsonRecord = Record<string, unknown>;
type RawCatalogRow = {
  run_id: string;
  content_id: string;
  fetched_at: string;
  raw_item: JsonRecord;
};

export type FanzaAmateurPriceValue = { price: string | null; list_price: string | null };
type PriceValue = FanzaAmateurPriceValue;
type PriceValuesByWork = Map<string, Map<string, PriceValue>>;

export type FanzaAmateurPriceHistoryRow = {
  content_id: string;
  source_run_id: string;
  observed_at: string;
  price_type: string;
  price: string | null;
  list_price: string | null;
  price_data: unknown;
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
  const changed: FanzaAmateurPriceHistoryRow[] = [];
  const nextByWork = new Map<string, Map<string, PriceValue>>();
  for (const row of rows) {
    const previous = nextByWork.get(row.content_id) ?? new Map(previousByWork.get(row.content_id) ?? []);
    const priorValue = previous.get(row.price_type);
    if (!priorValue || priorValue.price !== row.price || priorValue.list_price !== row.list_price) changed.push(row);
    previous.set(row.price_type, { price: row.price, list_price: row.list_price });
    nextByWork.set(row.content_id, previous);
  }
  return { changed, nextByWork };
}

async function upsertHistoryRows(rows: FanzaAmateurPriceHistoryRow[]) {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const { error } = await supabaseAdmin
      .from("fanza_amateur_price_history")
      .upsert(rows.slice(index, index + UPSERT_BATCH_SIZE), {
        onConflict: "source_run_id,content_id,price_type",
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
  const previousByWork = new Map<string, Map<string, PriceValue>>();
  const requiredKeys = new Set<string>();
  for (const row of sourceRows) {
    for (const price of extractFanzaAmateurPriceHistoryRows(row.content_id, row.run_id, row.raw_item, row.fetched_at)) {
      requiredKeys.add(`${row.content_id}\u0000${price.price_type}`);
    }
  }

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
      for (const priorRow of priorRows) {
        const key = `${priorRow.content_id}\u0000${priorRow.price_type}`;
        if (!requiredKeys.has(key) || seenKeys.has(key)) continue;
        seenKeys.add(key);
        const workValues = previousByWork.get(priorRow.content_id) ?? new Map<string, PriceValue>();
        workValues.set(priorRow.price_type, { price: priorRow.price, list_price: priorRow.list_price });
        previousByWork.set(priorRow.content_id, workValues);
      }
      if (priorRows.length < BACKFILL_BATCH_SIZE) break;
    }
  }

  const orderedRows = [...sourceRows].sort((a, b) => a.fetched_at.localeCompare(b.fetched_at)
    || a.run_id.localeCompare(b.run_id));
  const changedRows: FanzaAmateurPriceHistoryRow[] = [];
  for (const row of orderedRows) {
    const extracted = extractFanzaAmateurPriceHistoryRows(row.content_id, row.run_id, row.raw_item, row.fetched_at);
    const selected = selectChangedFanzaAmateurPriceHistoryRowsByWork(extracted, previousByWork);
    changedRows.push(...selected.changed);
    for (const [contentId, values] of selected.nextByWork) previousByWork.set(contentId, values);
  }
  await upsertHistoryRows(changedRows);

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
