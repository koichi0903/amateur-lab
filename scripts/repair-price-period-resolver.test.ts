import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSnapshotPriceIndex,
  groupCurrentPricePlans,
  limitPricePeriodRepairTargets,
  normalizePricePlanName,
  resolvePriceHistoryPeriod,
  selectPricePeriodRepairTargets,
  type CurrentPricePlan,
  type PricePeriodRepairHistory,
  type PricePeriodRepairWork,
  type PriceHistoryPeriodRow,
} from "./repair-price-period-resolver.ts";

const timestamp = "2026-10-30T12:34:00.000+09:00";

function historyRow(overrides: Partial<PriceHistoryPeriodRow> = {}): PriceHistoryPeriodRow {
  return {
    display_name: "Basic Plan",
    period: null,
    normal_price: null,
    changed_at: timestamp,
    ...overrides,
  };
}

function currentPlan(overrides: Partial<CurrentPricePlan> = {}): CurrentPricePlan {
  return {
    display_name: "Basic Plan",
    period: "30 days",
    normal_price: 1_000,
    ...overrides,
  };
}

function repairWork(
  product_id: string,
  overrides: Partial<PricePeriodRepairWork> = {},
): PricePeriodRepairWork {
  return { product_id, display_name: "Basic Plan", period: "30 days", ...overrides };
}

function repairHistory(
  product_id: string,
  overrides: Partial<PricePeriodRepairHistory> = {},
): PricePeriodRepairHistory {
  return {
    product_id,
    display_name: "Basic Plan",
    period: null,
    normal_price: 1_000,
    changed_at: timestamp,
    ...overrides,
  };
}

test("normalizes compatibility-width characters and removes whitespace", () => {
  assert.equal(normalizePricePlanName("１２ GB　 Plan"), "12GBPlan");
});

test("uses the only current period even when the history price is unknown", () => {
  const current = groupCurrentPricePlans([currentPlan({ normal_price: null })]);
  assert.equal(
    resolvePriceHistoryPeriod(historyRow(), current, new Map()),
    "30 days",
  );
});

test("uses a unique exact normal-price match among duplicate plan names", () => {
  const current = groupCurrentPricePlans([
    currentPlan({ period: "7 days", normal_price: 500 }),
    currentPlan({ period: "unlimited", normal_price: 1_500 }),
  ]);
  assert.equal(
    resolvePriceHistoryPeriod(historyRow({ normal_price: 1_500 }), current, new Map()),
    "unlimited",
  );
});

test("uses same-minute snapshot price order when exact prices do not match", () => {
  const current = groupCurrentPricePlans([
    currentPlan({ period: "7 days", normal_price: 900 }),
    currentPlan({ period: "unlimited", normal_price: 1_900 }),
  ]);
  const snapshots = buildSnapshotPriceIndex([
    historyRow({ normal_price: 2_000 }),
    historyRow({ display_name: "Basic　Plan", normal_price: 1_000 }),
  ]);

  assert.deepEqual([...snapshots.values()], [[1_000, 2_000]]);
  assert.equal(
    resolvePriceHistoryPeriod(historyRow({ normal_price: 1_000 }), current, snapshots),
    "7 days",
  );
});

test("leaves a period unresolved when snapshot cardinality cannot disambiguate plans", () => {
  const current = groupCurrentPricePlans([
    currentPlan({ period: "7 days", normal_price: 900 }),
    currentPlan({ period: "unlimited", normal_price: 1_900 }),
  ]);
  const snapshots = buildSnapshotPriceIndex([
    historyRow({ normal_price: 1_000 }),
  ]);

  assert.equal(
    resolvePriceHistoryPeriod(historyRow({ normal_price: 1_000 }), current, snapshots),
    null,
  );
});

test("selects mismatched periods and ambiguous same-minute history without selecting matching or empty history", () => {
  const targets = selectPricePeriodRepairTargets({
    prices: [
      repairWork("mismatch"),
      repairWork("matching"),
      repairWork("empty-history"),
    ],
    history: [
      repairHistory("mismatch"),
      repairHistory("matching", { period: "30 days" }),
      repairHistory("ambiguous", { normal_price: 500 }),
      repairHistory("ambiguous", { normal_price: 1_500 }),
    ],
    repairAll: false,
  });

  assert.deepEqual(targets, ["ambiguous", "mismatch"]);
});

test("includes null current periods only in all mode and honors a requested product override", () => {
  const prices = [
    repairWork("missing-period", { period: null }),
    repairWork("known-period"),
  ];
  assert.deepEqual(selectPricePeriodRepairTargets({
    prices,
    history: [],
    repairAll: false,
  }), []);
  assert.deepEqual(selectPricePeriodRepairTargets({
    prices,
    history: [],
    repairAll: true,
  }), ["missing-period"]);
  assert.deepEqual(selectPricePeriodRepairTargets({
    prices,
    history: [],
    repairAll: false,
    requestedProductId: "manual-override",
  }), ["manual-override"]);
});

test("limits repair targets only for a positive finite configured value", () => {
  const targets = ["one", "two", "three"];
  assert.deepEqual(limitPricePeriodRepairTargets(targets, "2"), ["one", "two"]);
  assert.deepEqual(limitPricePeriodRepairTargets(targets, "0"), targets);
  assert.deepEqual(limitPricePeriodRepairTargets(targets, "-1"), targets);
  assert.deepEqual(limitPricePeriodRepairTargets(targets, "invalid"), targets);
  assert.deepEqual(limitPricePeriodRepairTargets(targets), targets);
});
