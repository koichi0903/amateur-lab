import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPurchaseDecisionFacts,
  calculatePurchaseCardPricing,
} from "./purchaseCardPricing.ts";

const baseWork = {
  sale_price: 250,
  price: 500,
  list_price: 500,
  discount_rate: 50,
  lowest_price: 250,
  is_on_sale: true,
  sale_end_at: "2026-10-31T00:00:00+09:00",
};

test("購入カードの判断材料を順序と3件上限を保って組み立てる", () => {
  assert.deepEqual(buildPurchaseDecisionFacts({
    isLowestPrice: true,
    sampleMovieAvailable: true,
    reviewAverage: 4.25,
    reviewCount: 12,
    recommendationTitle: "人気作品",
  }), [
    "登録以降の最安価格",
    "無料サンプル動画あり",
    "レビュー 4.25 / 5（12件）",
  ]);
});

test("購入カードの判断材料がない場合は空配列を返す", () => {
  assert.deepEqual(buildPurchaseDecisionFacts({
    isLowestPrice: false,
    sampleMovieAvailable: false,
    reviewAverage: null,
    reviewCount: null,
  }), []);
});

test("有効なセールでは商品価格と一致する販売形式を選び、割引と最安を判定する", () => {
  const pricing = calculatePurchaseCardPricing(
    baseWork,
    [
      { display_name: "通常版", type: "download", normal_price: 500, sale_price: null },
      { display_name: "セール版", type: "download", normal_price: 500, sale_price: 250 },
    ],
    Date.parse("2026-10-30T00:00:00+09:00"),
  );

  assert.equal(pricing.currentPrice, 250);
  assert.equal(pricing.bestOffer?.display_name, "セール版");
  assert.equal(pricing.regularPrice, 500);
  assert.equal(pricing.calculatedDiscount, 50);
  assert.equal(pricing.discountRate, 50);
  assert.equal(pricing.isLowestPrice, true);
});

test("期限切れセールを除外し、有効な販売形式の最安値へフォールバックする", () => {
  const pricing = calculatePurchaseCardPricing(
    { ...baseWork, price: null, sale_end_at: "2026-10-29T00:00:00+09:00" },
    [
      { display_name: "無効", type: "download", normal_price: 0, sale_price: null },
      { display_name: "通常版", type: "download", normal_price: 420, sale_price: null },
      { display_name: "セール版", type: "download", normal_price: 500, sale_price: 300 },
    ],
    Date.parse("2026-10-30T00:00:00+09:00"),
  );

  assert.deepEqual(pricing.sortedOffers.map((offer) => offer.effectivePrice), [300, 420]);
  assert.equal(pricing.currentPrice, 300);
  assert.equal(pricing.bestOffer, null);
  assert.equal(pricing.regularPrice, null);
  assert.equal(pricing.calculatedDiscount, 0);
});

test("セール情報がない場合は通常価格を表示し、割引比較を出さない", () => {
  const pricing = calculatePurchaseCardPricing(
    { ...baseWork, sale_price: null, discount_rate: null, is_on_sale: false },
    [{ display_name: "通常版", type: "download", normal_price: 450, sale_price: null }],
    Date.parse("2026-10-30T00:00:00+09:00"),
  );

  assert.equal(pricing.currentPrice, 500);
  assert.equal(pricing.regularPrice, null);
  assert.equal(pricing.calculatedDiscount, 0);
});
