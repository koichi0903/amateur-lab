import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueStats, normalizeRevenueWorkIds } from "./revenueWeightedWorksProjection.ts";

test("normalizes revenue work IDs to unique positive safe integers", () => {
  assert.deepEqual(normalizeRevenueWorkIds([4, 4, 0, -2, Number.NaN, Number.MAX_SAFE_INTEGER + 1]), [4]);
});

test("counts only requested events and rounds CTR to one decimal place", () => {
  const stats = buildRevenueStats(
    [4, 4, 9],
    [{ work_id: 4 }, { work_id: 4 }, { work_id: 4 }, { work_id: 9 }, { work_id: 100 }],
    [{ work_id: 4 }, { work_id: 4 }, { work_id: 100 }],
  );

  assert.deepEqual([...stats], [
    [4, { pageViews: 3, fanzaClicks: 2, ctr: 66.7 }],
    [9, { pageViews: 1, fanzaClicks: 0, ctr: 0 }],
  ]);
});

test("returns an empty map when no valid work IDs are requested", () => {
  assert.deepEqual([...buildRevenueStats([0, -1], [{ work_id: 1 }], [{ work_id: 1 }])], []);
});
