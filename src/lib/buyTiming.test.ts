import assert from "node:assert/strict";
import test from "node:test";
import { calculateBuyTimingScore } from "./buyTiming.ts";

test("買い時判定に価格記録期間とレビュー情報を含める", () => {
  const startedAt = new Date(Date.now() - 4 * 86_400_000).toISOString();
  const result = calculateBuyTimingScore({
    work: {
      id: 1,
      price: 500,
      sale_price: 250,
      list_price: 500,
      discount_rate: 50,
      lowest_price: 250,
      review_average: 4.4,
      review_count: 32,
      score: 85,
    },
    priceHistory: [
      { changed_at: startedAt, normal_price: 500, sale_price: null },
      { changed_at: new Date().toISOString(), normal_price: 500, sale_price: 250 },
    ],
    funnel: { pageViews: 0, fanzaClicks: 0, rawCtr: 0, adjustedCtr: 0, confidence: 0 },
  });

  assert.ok((result.historyDays ?? 0) >= 3);
  assert.equal(result.score, 61);
  assert.equal(result.labelTone, "watch");
  assert.deepEqual(result.reasons, [
    "50%OFFで割引幅が大きい",
    "過去最安値クラスの価格",
    "レビュー4.40・32件で評価が安定",
    "発掘スコア85の有力候補",
  ]);
  assert.equal(result.currentPrice, 250);
  assert.equal(result.regularPrice, 500);
  assert.equal(result.discountRate, 50);
  assert.equal(result.lowestPriceComparison, "lowest");
  assert.equal(result.reviewAverage, 4.4);
  assert.equal(result.reviewCount, 32);
});

test("期限切れセールの価格・割引を買い時スコアから除外する", () => {
  const result = calculateBuyTimingScore({
    work: {
      id: 2,
      price: 400,
      sale_price: 100,
      list_price: 500,
      discount_rate: 80,
      is_on_sale: true,
      sale_end_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    priceHistory: [],
    funnel: { pageViews: 0, fanzaClicks: 0, rawCtr: 0, adjustedCtr: 0, confidence: 0 },
  });

  assert.equal(result.score, 12);
  assert.equal(result.currentPrice, 400);
  assert.equal(result.regularPrice, null);
  assert.equal(result.discountRate, 0);
  assert.equal(result.lowestPriceComparison, "unknown");
  assert.equal(result.lowestPriceText, "過去最安値データを蓄積中");
  assert.deepEqual(result.reasons, ["価格・レビューを確認して判断しやすい"]);
});
