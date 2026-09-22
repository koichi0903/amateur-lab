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
  assert.equal(result.reviewAverage, 4.4);
  assert.equal(result.reviewCount, 32);
});
