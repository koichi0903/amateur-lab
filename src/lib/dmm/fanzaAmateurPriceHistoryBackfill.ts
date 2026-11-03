import {
  extractFanzaAmateurPriceHistoryRows,
  selectChangedFanzaAmateurPriceHistoryRowsByWork,
  type FanzaAmateurPriceHistoryRow,
  type FanzaAmateurPriceValue,
} from "./fanzaAmateurPriceHistoryRows";

export type FanzaAmateurPriceHistoryBackfillSourceRow = {
  run_id: string;
  content_id: string;
  fetched_at: string;
  raw_item: Record<string, unknown>;
};

export type FanzaAmateurPriceHistoryPriorValueRow = Pick<
  FanzaAmateurPriceHistoryRow,
  "content_id" | "price_type" | "price" | "list_price"
>;

export type FanzaAmateurPriceHistoryValuesByWork = Map<
  string,
  Map<string, FanzaAmateurPriceValue>
>;

function getPriceHistoryKey(contentId: string, priceType: string) {
  return `${contentId}\u0000${priceType}`;
}

export function getRequiredFanzaAmateurPriceHistoryKeys(
  sourceRows: FanzaAmateurPriceHistoryBackfillSourceRow[],
) {
  const requiredKeys = new Set<string>();
  for (const row of sourceRows) {
    const prices = extractFanzaAmateurPriceHistoryRows(row.content_id, row.run_id, row.raw_item, row.fetched_at);
    for (const price of prices) requiredKeys.add(getPriceHistoryKey(row.content_id, price.price_type));
  }
  return requiredKeys;
}

export function rememberNewestFanzaAmateurPriceHistoryValues(
  priorRows: FanzaAmateurPriceHistoryPriorValueRow[],
  requiredKeys: Set<string>,
  seenKeys: Set<string>,
  previousByWork: FanzaAmateurPriceHistoryValuesByWork,
) {
  for (const priorRow of priorRows) {
    const key = getPriceHistoryKey(priorRow.content_id, priorRow.price_type);
    if (!requiredKeys.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    const workValues = previousByWork.get(priorRow.content_id) ?? new Map<string, FanzaAmateurPriceValue>();
    workValues.set(priorRow.price_type, { price: priorRow.price, list_price: priorRow.list_price });
    previousByWork.set(priorRow.content_id, workValues);
  }
}

export function reconstructChangedFanzaAmateurPriceHistoryRows(
  sourceRows: FanzaAmateurPriceHistoryBackfillSourceRow[],
  previousByWork: FanzaAmateurPriceHistoryValuesByWork,
) {
  const orderedRows = [...sourceRows].sort((a, b) => a.fetched_at.localeCompare(b.fetched_at)
    || a.run_id.localeCompare(b.run_id));
  const changedRows: FanzaAmateurPriceHistoryRow[] = [];
  for (const row of orderedRows) {
    const extracted = extractFanzaAmateurPriceHistoryRows(row.content_id, row.run_id, row.raw_item, row.fetched_at);
    const selected = selectChangedFanzaAmateurPriceHistoryRowsByWork(extracted, previousByWork);
    changedRows.push(...selected.changed);
    for (const [contentId, values] of selected.nextByWork) previousByWork.set(contentId, values);
  }
  return changedRows;
}

export function selectDailyFanzaAmateurPriceHistoryRows(
  changedRows: FanzaAmateurPriceHistoryRow[],
) {
  const dailyRows = new Map<string, FanzaAmateurPriceHistoryRow>();
  for (const row of changedRows) {
    const observedAtMs = Date.parse(row.observed_at);
    if (!Number.isFinite(observedAtMs)) throw new Error("価格履歴の取得日時が不正です。");
    const observedDateJst = new Date(observedAtMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyRows.set(`${row.content_id}\u0000${observedDateJst}\u0000${row.price_type}`, row);
  }
  return [...dailyRows.values()];
}
