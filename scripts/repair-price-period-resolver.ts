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

export type PricePeriodRepairWork = {
  product_id: string;
  display_name: string;
  period: string | null;
};
export type PricePeriodRepairHistory = PriceHistoryPeriodRow & { product_id: string };

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

function groupRowsByProduct<T extends { product_id: string }>(rows: readonly T[]) {
  const byProduct = new Map<string, T[]>();
  for (const row of rows) {
    const productRows = byProduct.get(row.product_id) ?? [];
    productRows.push(row);
    byProduct.set(row.product_id, productRows);
  }
  return byProduct;
}

function findPeriodMismatchTargets(
  pricesByProduct: ReadonlyMap<string, readonly PricePeriodRepairWork[]>,
  historyByProduct: ReadonlyMap<string, readonly PricePeriodRepairHistory[]>,
) {
  return [...pricesByProduct.entries()]
    .filter(([productId, rows]) => {
      const historyRows = historyByProduct.get(productId) ?? [];
      if (historyRows.length === 0) return false;

      const historyPeriods = new Map<string, Set<string>>();
      for (const row of historyRows) {
        const periods = historyPeriods.get(row.display_name) ?? new Set<string>();
        periods.add(row.period ?? "");
        historyPeriods.set(row.display_name, periods);
      }

      return rows.some((row) => {
        const periods = historyPeriods.get(row.display_name);
        return Boolean(periods?.size && !periods.has(row.period ?? ""));
      });
    })
    .map(([productId]) => productId);
}

function findAmbiguousHistoryTargets(
  historyByProduct: ReadonlyMap<string, readonly PricePeriodRepairHistory[]>,
) {
  // Before period became part of the key, same-name plans could collapse into
  // one current row while same-minute history still retained different prices.
  return [...historyByProduct.entries()]
    .filter(([, rows]) => {
      const snapshots = new Map<string, Set<number>>();
      for (const row of rows) {
        if (row.period != null || row.normal_price == null) continue;
        const minute = row.changed_at.slice(0, 16);
        const key = `${row.display_name}\u0000${minute}`;
        const prices = snapshots.get(key) ?? new Set<number>();
        prices.add(row.normal_price);
        snapshots.set(key, prices);
      }
      return [...snapshots.values()].some((values) => values.size > 1);
    })
    .map(([productId]) => productId);
}

function findNullPeriodTargets(
  pricesByProduct: ReadonlyMap<string, readonly PricePeriodRepairWork[]>,
) {
  return [...pricesByProduct.entries()]
    .filter(([, rows]) => rows.some((row) => row.period == null))
    .map(([productId]) => productId);
}

export function selectPricePeriodRepairTargets({
  prices,
  history,
  repairAll,
  requestedProductId,
}: {
  prices: readonly PricePeriodRepairWork[];
  history: readonly PricePeriodRepairHistory[];
  repairAll: boolean;
  requestedProductId?: string;
}) {
  const pricesByProduct = groupRowsByProduct(prices);
  const historyByProduct = groupRowsByProduct(history);
  const ambiguousTargets = [
    ...new Set([
      ...findPeriodMismatchTargets(pricesByProduct, historyByProduct),
      ...findAmbiguousHistoryTargets(historyByProduct),
    ]),
  ];
  const nullPeriodTargets = findNullPeriodTargets(pricesByProduct);
  const detectedTargets = repairAll
    ? [...new Set([...ambiguousTargets, ...nullPeriodTargets])]
    : ambiguousTargets;

  return (requestedProductId ? [requestedProductId] : detectedTargets).sort();
}

export function limitPricePeriodRepairTargets(
  targets: readonly string[],
  configuredLimit?: string,
) {
  const limit = Number(configuredLimit ?? targets.length);
  const count = Number.isFinite(limit) && limit > 0 ? limit : targets.length;
  return targets.slice(0, count);
}
