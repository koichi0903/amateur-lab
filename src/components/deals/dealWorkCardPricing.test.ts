import assert from "node:assert/strict";
import test from "node:test";
import type { DealWork } from "./DealWorkCard.tsx";
import { buildDealWorkCardPresentation } from "./dealWorkCardPricing.ts";

const baseWork: DealWork = {
  id: 1,
  title: "作品",
  genre: null,
  image_url: null,
  price: 1000,
  sale_price: 500,
  list_price: 1000,
  discount_rate: 0,
  is_on_sale: true,
  review_average: 4.2,
  review_count: 100,
  sale_end_at: "2026-12-01T00:00:00+09:00",
  lowest_price: 500,
  is_lowest_price: true,
  sample_movie_url: "https://example.test/sample.mp4",
};

test("uses the sale price and keeps the original purchase-reason priority and two-item cap", () => {
  const view = buildDealWorkCardPresentation(baseWork, Date.parse("2026-10-30T00:00:00+09:00"));

  assert.equal(view.currentPrice, 500);
  assert.equal(view.discountRate, 50);
  assert.equal(view.isSale, true);
  assert.ok(view.saleEnd);
  assert.deepEqual(view.purchaseReasons, ["取得期間内の最安", "半額以上"]);
});

test("does not show expired sale timing and falls back to the first two available reasons", () => {
  const view = buildDealWorkCardPresentation({
    ...baseWork,
    is_on_sale: false,
    sale_price: 0,
    list_price: null,
    discount_rate: 0,
    sale_end_at: "2025-01-01T00:00:00+09:00",
    is_lowest_price: false,
  }, Date.parse("2026-10-30T00:00:00+09:00"));

  assert.equal(view.currentPrice, 1000);
  assert.equal(view.isSale, false);
  assert.equal(view.regularPrice, null);
  assert.equal(view.discountRate, 0);
  assert.equal(view.saleEnd, null);
  assert.deepEqual(view.purchaseReasons, ["レビュー根拠あり", "購入前にサンプル可"]);
});
