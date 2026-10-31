import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedData } from "./parser";
import { deriveWorkPriceSummary } from "./savePriceData";
import {
  buildWorkRecordUpdate,
  type ExistingWorkRecord,
} from "./saveWorkRecord";

const prices: ParsedData["prices"] = [
  { name: "単品", period: "無期限", normalPrice: 1000, type: "購入" },
];
const data = {
  title: "作品",
  actressLinks: ["女優A", "女優B"],
  maker: "メーカー",
  series: "シリーズ",
  label: "レーベル",
  releaseDate: "2026-10-01",
  productReleaseDate: "2026-10-01",
  duration: "120分",
};
const summary = deriveWorkPriceSummary(prices, null);

function currentWork(overrides: Partial<ExistingWorkRecord> = {}): ExistingWorkRecord {
  return {
    price: 1000,
    list_price: 1000,
    sale_price: null,
    lowest_price: 900,
    discount_rate: 0,
    max_discount_rate: 0,
    is_on_sale: false,
    sale_end_at: null,
    playwright_status: "NORMAL",
    stage: "NEW",
    is_bottom_price: false,
    is_lowest_price: false,
    actress: "女優A",
    ...overrides,
  };
}

test("does not update an unchanged work or replace an existing list price", () => {
  const result = buildWorkRecordUpdate(currentWork({ list_price: 1400 }), data, summary);

  assert.equal(result.changed, false);
  assert.equal("list_price" in result.workUpdate, false);
  assert.equal(result.workUpdate.actress, undefined);
});

test("records a newly observed low and only fills a missing list price", () => {
  const result = buildWorkRecordUpdate(
    currentWork({ list_price: null, lowest_price: 1200 }),
    data,
    summary,
  );

  assert.equal(result.changed, true);
  assert.equal(result.workUpdate.list_price, 1000);
  assert.equal(result.lowestPrice, 1000);
  assert.equal(result.isNewLowestPrice, true);
  assert.equal(result.workUpdate.is_lowest_price, true);
});

test("preserves lowest-price status only when the current price ties the recorded low", () => {
  const alreadyLowest = buildWorkRecordUpdate(
    currentWork({ lowest_price: 1000, is_lowest_price: true }),
    data,
    summary,
  );
  const notLowest = buildWorkRecordUpdate(
    currentWork({ lowest_price: 1000, is_lowest_price: false }),
    data,
    summary,
  );

  assert.equal(alreadyLowest.isNewLowestPrice, false);
  assert.equal(alreadyLowest.workUpdate.is_lowest_price, true);
  assert.equal(notLowest.isNewLowestPrice, false);
  assert.equal(notLowest.workUpdate.is_lowest_price, false);
});

test("restores the prior stage from a discontinued work status", () => {
  const result = buildWorkRecordUpdate(
    currentWork({
      stage: "DISCONTINUED",
      playwright_status: "DISCONTINUED_20261020_SEMI_NEW",
    }),
    data,
    summary,
  );

  assert.equal(result.changed, true);
  assert.equal(result.workUpdate.stage, "SEMI_NEW");
});

test("uses the legacy default stage only for discontinued rows with an unknown suffix", () => {
  const result = buildWorkRecordUpdate(
    currentWork({ stage: "DISCONTINUED", playwright_status: "DISCONTINUED_UNKNOWN" }),
    data,
    summary,
  );

  assert.equal(result.workUpdate.stage, "OLD");
});
