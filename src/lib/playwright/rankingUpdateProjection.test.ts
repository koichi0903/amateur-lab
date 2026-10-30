import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRankingMaps,
  buildRankingResetRequest,
  changedStaleRankingProductIds,
} from "./rankingUpdateProjection";

test("ranking maps keep source-specific last values and unique source order", () => {
  const maps = buildRankingMaps({
    realtime: [{ productId: "A", ranking: 1 }, { productId: "B", ranking: 2 }, { productId: "A", ranking: 5 }],
    daily: [{ productId: "A", ranking: 4 }, { productId: "C", ranking: 3 }],
    weekly: [{ productId: "D", ranking: 1 }],
    monthly: [{ productId: "C", ranking: 8 }],
  });

  assert.deepEqual(maps.targetProductIds, ["A", "B", "C", "D"]);
  assert.equal(maps.realtimeMap.get("A"), 5);
  assert.equal(maps.dailyMap.get("A"), 4);
  assert.equal(maps.monthlyMap.get("C"), 8);
});

test("incomplete realtime coverage resets only non-realtime ranks", () => {
  assert.deepEqual(buildRankingResetRequest(false), {
    values: { daily_rank: null, weekly_rank: null, monthly_rank: null },
    filter: "daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null",
  });
  assert.deepEqual(buildRankingResetRequest(true), {
    values: { realtime_rank: null, daily_rank: null, weekly_rank: null, monthly_rank: null },
    filter: "realtime_rank.not.is.null,daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null",
  });
});

test("stale-row comparison preserves realtime values for partial coverage", () => {
  const maps = buildRankingMaps({
    realtime: [{ productId: "A", ranking: 1 }],
    daily: [{ productId: "A", ranking: 2 }],
    weekly: [],
    monthly: [],
  });
  const rows = [
    { product_id: "A", realtime_rank: 7, daily_rank: 2, weekly_rank: null, monthly_rank: null },
    { product_id: "B", realtime_rank: 9, daily_rank: 8, weekly_rank: null, monthly_rank: null },
  ];

  assert.deepEqual(changedStaleRankingProductIds(rows, maps, false), ["B"]);
  assert.deepEqual(changedStaleRankingProductIds(rows, maps, true), ["A", "B"]);
});
