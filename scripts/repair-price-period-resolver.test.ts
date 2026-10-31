import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSnapshotPriceIndex,
  groupCurrentPricePlans,
  normalizePricePlanName,
  resolvePriceHistoryPeriod,
  type CurrentPricePlan,
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
