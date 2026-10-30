export type CurrentPricePlan = {
  display_name: string;
  period: string | null;
  normal_price: number | null;
};

export type PriceHistoryPeriodRow = {
  display_name: string;
  period: string | null;
  normal_price: number | null;
  changed_at: string;
};

type SnapshotPriceIndex = ReadonlyMap<string, readonly number[]>;

export function normalizePricePlanName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

function snapshotKey(displayName: string, changedAt: string) {
  return `${normalizePricePlanName(displayName)}\u0000${changedAt.slice(0, 16)}`;
}

export function groupCurrentPricePlans(rows: readonly CurrentPricePlan[]) {
  const byName = new Map<string, CurrentPricePlan[]>();
  for (const row of rows) {
    const name = normalizePricePlanName(row.display_name);
    const plans = byName.get(name) ?? [];
    plans.push(row);
    byName.set(name, plans);
  }
  return byName;
}

export function buildSnapshotPriceIndex(rows: readonly PriceHistoryPeriodRow[]) {
  const index = new Map<string, number[]>();
  for (const row of rows) {
    if (row.normal_price == null) continue;
    const key = snapshotKey(row.display_name, row.changed_at);
    const prices = index.get(key) ?? [];
    if (!prices.includes(row.normal_price)) prices.push(row.normal_price);
    index.set(key, prices);
  }
  for (const prices of index.values()) prices.sort((a, b) => a - b);
  return index;
}

export function resolvePriceHistoryPeriod(
  row: PriceHistoryPeriodRow,
  currentPlansByName: ReadonlyMap<string, readonly CurrentPricePlan[]>,
  snapshotPrices: SnapshotPriceIndex,
) {
  const candidates = (currentPlansByName.get(normalizePricePlanName(row.display_name)) ?? [])
    .filter((plan) => plan.period != null);
  if (candidates.length === 1) return candidates[0].period;
  if (candidates.length < 2 || row.normal_price == null) return null;

  const exactPriceMatches = candidates.filter((plan) => plan.normal_price === row.normal_price);
  if (exactPriceMatches.length === 1) return exactPriceMatches[0].period;

  const prices = snapshotPrices.get(snapshotKey(row.display_name, row.changed_at)) ?? [];
  const sortedCandidates = [...candidates].sort(
    (a, b) => (a.normal_price ?? Number.MAX_SAFE_INTEGER) - (b.normal_price ?? Number.MAX_SAFE_INTEGER),
  );
  const index = prices.indexOf(row.normal_price);
  return prices.length === sortedCandidates.length && index >= 0
    ? sortedCandidates[index].period
    : null;
}
