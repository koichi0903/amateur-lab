export type JsonRecord = Record<string, unknown>;

export type FanzaAmateurPriceValue = { price: string | null; list_price: string | null };

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

type PriceValuesByWork = Map<string, Map<string, FanzaAmateurPriceValue>>;

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

function priceValuesFromRows(rows: FanzaAmateurPriceHistoryRow[]): Map<string, FanzaAmateurPriceValue> {
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
  const changed: FanzaAmateurPriceHistoryRow[] = [];
  const nextByWork = new Map<string, Map<string, FanzaAmateurPriceValue>>();
  for (const row of rows) {
    const previous = nextByWork.get(row.content_id) ?? new Map(previousByWork.get(row.content_id) ?? []);
    const priorValue = previous.get(row.price_type);
    if (!priorValue || priorValue.price !== row.price || priorValue.list_price !== row.list_price) changed.push(row);
    previous.set(row.price_type, { price: row.price, list_price: row.list_price });
    nextByWork.set(row.content_id, previous);
  }
  return { changed, nextByWork };
}
