import assert from "node:assert/strict";
import test from "node:test";
import {
  recordExistingWorkPricePlans,
  selectMissingPriceTargets,
  type MissingPriceTarget,
} from "./missingPriceTargetSelection.ts";

test("selects incomplete price rows and products with missing or absent plans", () => {
  const criteria = {
    productsWithPricePlans: new Set<string>(),
    productsWithMissingPeriods: new Set<string>(),
  };
  recordExistingWorkPricePlans([
    { product_id: "complete", period: "monthly" },
    { product_id: "missing-period", period: null },
  ], criteria);

  const works: MissingPriceTarget[] = [
    { id: 1, product_id: "complete", price: 500, list_price: 1000 },
    { id: 2, product_id: "null-price", price: null, list_price: 1000 },
    { id: 3, product_id: "zero-price", price: 0, list_price: 1000 },
    { id: 4, product_id: "zero-list-price", price: 500, list_price: 0 },
    { id: 5, product_id: "no-plan", price: 500, list_price: 1000 },
    { id: 6, product_id: "missing-period", price: 500, list_price: 1000 },
  ];

  assert.deepEqual(selectMissingPriceTargets(works, criteria).map((work) => work.id), [2, 3, 4, 5, 6]);
});
