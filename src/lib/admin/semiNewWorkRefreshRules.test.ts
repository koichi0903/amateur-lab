import assert from "node:assert/strict";
import test from "node:test";
import { assessSemiNewWorkRefresh } from "./semiNewWorkRefreshRules.ts";

const base = {
  dbPrice: 900,
  latestPrice: 900,
  isPending: false,
  isUnavailable: false,
  isMissingData: false,
  captureSampleMovie: false,
};

test("skips a complete unchanged work unless sample movie capture is due", () => {
  assert.deepEqual(assessSemiNewWorkRefresh(base), { shouldSkip: true, reasons: [] });
  assert.deepEqual(assessSemiNewWorkRefresh({ ...base, captureSampleMovie: true }), { shouldSkip: false, reasons: [] });
});

test("retains refresh reasons and their established order", () => {
  assert.deepEqual(
    assessSemiNewWorkRefresh({ ...base, isPending: true, isUnavailable: true, isMissingData: true, latestPrice: null }),
    { shouldSkip: false, reasons: ["PENDING", "UNAVAILABLE", "MISSING_DATA", "LIST_PRICE_MISSING"] },
  );
});

test("reports price changes without requesting an unnecessary refresh", () => {
  assert.deepEqual(assessSemiNewWorkRefresh({ ...base, latestPrice: 800 }), {
    shouldSkip: false,
    reasons: ["PRICE_CHANGED"],
  });
});
