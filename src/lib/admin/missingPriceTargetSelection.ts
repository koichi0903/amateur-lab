export type MissingPriceTarget = {
  id: number;
  product_id: string;
  price: number | null;
  list_price: number | null;
};

export type ExistingWorkPricePlan = {
  product_id: string;
  period: string | null;
};

export type MissingPriceTargetCriteria = {
  productsWithPricePlans: Set<string>;
  productsWithMissingPeriods: Set<string>;
};

export function recordExistingWorkPricePlans(
  rows: ExistingWorkPricePlan[],
  criteria: MissingPriceTargetCriteria,
) {
  for (const row of rows) {
    criteria.productsWithPricePlans.add(row.product_id);
    if (!row.period) criteria.productsWithMissingPeriods.add(row.product_id);
  }
}

function needsPriceHistory(
  work: MissingPriceTarget,
  criteria: MissingPriceTargetCriteria,
) {
  return work.price == null
    || work.price <= 0
    || work.list_price == null
    || work.list_price <= 0
    || !criteria.productsWithPricePlans.has(work.product_id)
    || criteria.productsWithMissingPeriods.has(work.product_id);
}

export function selectMissingPriceTargets(
  works: MissingPriceTarget[],
  criteria: MissingPriceTargetCriteria,
) {
  const targets: MissingPriceTarget[] = [];
  for (const work of works) {
    if (needsPriceHistory(work, criteria)) targets.push(work);
  }
  return targets;
}
