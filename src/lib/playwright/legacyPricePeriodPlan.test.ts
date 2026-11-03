import assert from "node:assert/strict";
import test from "node:test";

import { buildLegacyPricePeriodPlan } from "./legacyPricePeriodPlan";

test("maps a unique normalized price name to its current period", () => {
  const plan = buildLegacyPricePeriodPlan(
    [{ id: 1, display_name: "単 品", normal_price: 1200, changed_at: "2026-10-01T12:30:00Z" }],
    [{ name: "単品", period: "無期限", normalPrice: 1200, type: "購入" }],
  );

  assert.deepEqual([...plan.updates], [["無期限", [1]]]);
  assert.deepEqual(plan.unresolved, []);
});

test("uses an exact normal-price match when a name has multiple current periods", () => {
  const plan = buildLegacyPricePeriodPlan(
    [{ id: 2, display_name: "作品", normal_price: 1200, changed_at: "2026-10-01T12:30:00Z" }],
    [
      { name: "作品", period: "7日間", normalPrice: 300, type: "レンタル" },
      { name: "作品", period: "無期限", normalPrice: 1200, type: "購入" },
    ],
  );

  assert.deepEqual([...plan.updates], [["無期限", [2]]]);
  assert.deepEqual(plan.unresolved, []);
});

test("uses same-time historical price order only when every candidate is represented", () => {
  const time = "2026-10-01T12:30:00Z";
  const plan = buildLegacyPricePeriodPlan(
    [
      { id: 3, display_name: "作品", normal_price: 1000, changed_at: time },
      { id: 4, display_name: "作品", normal_price: 1200, changed_at: time },
    ],
    [
      { name: "作品", period: "7日間", normalPrice: 1000, type: "レンタル" },
      { name: "作品", period: "無期限", normalPrice: 1000, type: "購入" },
    ],
  );

  assert.deepEqual([...plan.updates], [["7日間", [3]], ["無期限", [4]]]);
  assert.deepEqual(plan.unresolved, []);
});

test("leaves ambiguous legacy rows unresolved instead of guessing a period", () => {
  const plan = buildLegacyPricePeriodPlan(
    [{ id: 5, display_name: "作品", normal_price: 1000, changed_at: "2026-10-01T12:30:00Z" }],
    [
      { name: "作品", period: "7日間", normalPrice: 1000, type: "レンタル" },
      { name: "作品", period: "無期限", normalPrice: 1000, type: "購入" },
    ],
  );

  assert.deepEqual([...plan.updates], []);
  assert.deepEqual(plan.unresolved, [5]);
});
