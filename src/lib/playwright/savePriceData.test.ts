import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWorkPriceSummary,
  getPriceKind,
  validatePriceData,
} from "./savePriceData";

test("validates complete positive price rows and rejects duplicate keys", () => {
  const prices = [
    { name: "見放題", period: "7日間", normalPrice: 300, salePrice: 250, type: "配信" },
    { name: "単品", period: "無期限", normalPrice: 1200, type: "購入" },
  ];

  assert.doesNotThrow(() => validatePriceData("ABC-123", prices));
  assert.throws(
    () => validatePriceData("ABC-123", [prices[0]!, prices[0]!]),
    /work_prices保存前重複/,
  );
  assert.throws(
    () => validatePriceData("ABC-123", [{ ...prices[0]!, salePrice: 300 }]),
    /Invalid FANZA price data/,
  );
});

test("selects the lowest normal price and keeps sale summary separate from maximum discount", () => {
  const saleEndAt = new Date("2026-11-01T00:00:00.000Z");
  const prices = [
    { name: "配信", period: "無期限", normalPrice: 2000, salePrice: 1000, type: "配信" },
    { name: "レンタル", period: "7日間", normalPrice: 300, salePrice: 240, type: "レンタル" },
    { name: "単品", period: "無期限", normalPrice: 1200, salePrice: 900, type: "購入" },
  ];

  const summary = deriveWorkPriceSummary(prices, saleEndAt);

  assert.equal(summary.mainPrice, prices[1]);
  assert.equal(summary.isBottomPrice, true);
  assert.equal(summary.price, 300);
  assert.equal(summary.salePrice, 240);
  assert.equal(summary.discountRate, 20);
  assert.equal(summary.maxDiscountRate, 50);
  assert.equal(summary.isOnSale, true);
  assert.equal(summary.saleEndAt, saleEndAt);
  assert.equal(getPriceKind(prices[1]!), "sale");
});

test("does not mark a sale without an end date and does not use other plans for the rental threshold", () => {
  const prices = [
    { name: "無期限", period: "無期限", normalPrice: 100, salePrice: 80, type: "購入" },
  ];

  const summary = deriveWorkPriceSummary(prices, null);

  assert.equal(summary.isBottomPrice, false);
  assert.equal(summary.isOnSale, false);
  assert.equal(summary.salePrice, null);
  assert.equal(summary.saleEndAt, null);
  assert.equal(summary.maxDiscountRate, 20);
});
