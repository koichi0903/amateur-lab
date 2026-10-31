import type { PriceInfo } from "./parser";

export type LegacyPriceHistoryRow = {
  id: number;
  display_name: string;
  normal_price: number | null;
  changed_at: string;
};

export type LegacyPricePeriodPlan = {
  updates: Map<string, number[]>;
  unresolved: number[];
};

function normalizePriceName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

function buildCurrentPricesByName(prices: PriceInfo[]) {
  const byName = new Map<string, PriceInfo[]>();
  for (const price of prices) {
    const key = normalizePriceName(price.name);
    const candidates = byName.get(key) ?? [];
    candidates.push(price);
    byName.set(key, candidates);
  }
  return byName;
}

function snapshotKey(displayName: string, changedAt: string) {
  return `${normalizePriceName(displayName)}\u0000${changedAt.slice(0, 16)}`;
}

function buildSnapshotPrices(rows: LegacyPriceHistoryRow[]) {
  const bySnapshot = new Map<string, number[]>();
  for (const row of rows) {
    if (row.normal_price == null) continue;
    const key = snapshotKey(row.display_name, row.changed_at);
    const values = bySnapshot.get(key) ?? [];
    if (!values.includes(row.normal_price)) values.push(row.normal_price);
    values.sort((a, b) => a - b);
    bySnapshot.set(key, values);
  }
  return bySnapshot;
}

function resolvePeriod(
  row: LegacyPriceHistoryRow,
  currentByName: Map<string, PriceInfo[]>,
  snapshotPrices: Map<string, number[]>,
) {
  const name = normalizePriceName(row.display_name);
  const candidates = (currentByName.get(name) ?? []).filter(
    (price) => price.period,
  );
  if (candidates.length === 1) return candidates[0].period ?? null;
  if (candidates.length <= 1 || row.normal_price == null) return null;

  const exact = candidates.filter(
    (price) => price.normalPrice === row.normal_price,
  );
  if (exact.length === 1) return exact[0].period ?? null;

  const historicalPrices =
    snapshotPrices.get(snapshotKey(row.display_name, row.changed_at)) ?? [];
  const sortedCandidates = [...candidates].sort(
    (a, b) =>
      (a.normalPrice ?? Number.MAX_SAFE_INTEGER) -
      (b.normalPrice ?? Number.MAX_SAFE_INTEGER),
  );
  const index = historicalPrices.indexOf(row.normal_price);
  if (historicalPrices.length !== sortedCandidates.length || index < 0) {
    return null;
  }
  return sortedCandidates[index].period ?? null;
}

export function buildLegacyPricePeriodPlan(
  rows: LegacyPriceHistoryRow[],
  prices: PriceInfo[],
): LegacyPricePeriodPlan {
  const currentByName = buildCurrentPricesByName(prices);
  const snapshotPrices = buildSnapshotPrices(rows);
  const updates = new Map<string, number[]>();
  const unresolved: number[] = [];

  for (const row of rows) {
    const period = resolvePeriod(row, currentByName, snapshotPrices);
    if (!period) {
      unresolved.push(row.id);
      continue;
    }
    const ids = updates.get(period) ?? [];
    ids.push(row.id);
    updates.set(period, ids);
  }

  return { updates, unresolved };
}
