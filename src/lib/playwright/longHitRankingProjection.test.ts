import assert from "node:assert/strict";
import test from "node:test";
import {
  changedLongHitRankingProductIds,
  shouldReportLongHitRankingProgress,
} from "./longHitRankingProjection.ts";

test("detects changed ranks, including stale ranks that should reset to null", () => {
  const changed = changedLongHitRankingProductIds([
    { product_id: "same", long_hit_rank: 1 },
    { product_id: "update", long_hit_rank: 4 },
    { product_id: "new", long_hit_rank: null },
    { product_id: "stale", long_hit_rank: 8 },
  ], new Map([["same", 1], ["update", 2], ["new", 3]]));
  assert.deepEqual(changed, ["update", "new", "stale"]);
});

test("reports ranking progress at each ten records and at the final record", () => {
  assert.equal(shouldReportLongHitRankingProgress(10, 25), true);
  assert.equal(shouldReportLongHitRankingProgress(20, 25), true);
  assert.equal(shouldReportLongHitRankingProgress(25, 25), true);
  assert.equal(shouldReportLongHitRankingProgress(9, 25), false);
  assert.equal(shouldReportLongHitRankingProgress(0, 0), false);
});
