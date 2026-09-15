import assert from "node:assert/strict";
import test from "node:test";
import { analyzePurchaseDecision } from "./purchaseDecisionAnalyzer.ts";

const currentPrice = {
  display_name: "HD版",
  type: "download",
  period: "unlimited",
  normal_price: 2000,
  sale_price: 1000,
  changed_at: "2026-08-27T00:00:00Z",
};

test("marks a well-reviewed historical low as easy to consider", () => {
  const decision = analyzePurchaseDecision({
    work: {
      review_average: 4.5,
      review_count: 24,
      discount_rate: 50,
      duration: 130,
      sale_end_at: "2026-09-01T00:00:00Z",
      sample_movie_url: "https://example.com/sample",
    },
    currentPrice,
    priceHistory: [
      currentPrice,
      { ...currentPrice, sale_price: 1400, changed_at: "2026-08-01T00:00:00Z" },
    ],
    offerCount: 1,
    mainActress: "出演者A",
    mainGenre: "ジャンルA",
  });

  assert.equal(decision.verdict, "価格と評価の両面で検討しやすい");
  assert.match(decision.summary, /過去最安水準/);
  assert.equal(decision.evidence[0]?.detail, "同一プランの過去記録と比較して最安水準");
  assert.ok(decision.suitedFor.some((item) => item.includes("出演者A")));
});

test("states the exact gap when the current price is above the historical low", () => {
  const decision = analyzePurchaseDecision({
    work: {
      review_average: 3.8,
      review_count: 4,
      discount_rate: 0,
      duration: 80,
      sale_end_at: null,
      sample_movie_url: null,
    },
    currentPrice: { ...currentPrice, normal_price: 1500, sale_price: 1500 },
    priceHistory: [
      { ...currentPrice, normal_price: 1500, sale_price: 1500 },
      { ...currentPrice, normal_price: 1500, sale_price: 900, changed_at: "2026-07-01T00:00:00Z" },
    ],
    offerCount: 2,
  });

  assert.match(decision.summary, /過去最安は¥900/);
  assert.ok(decision.cautions.some((item) => item.includes("¥600高い")));
  assert.ok(decision.cautions.some((item) => item.includes("販売形式や視聴期間")));
});

test("does not claim a historical low when comparable history is unavailable", () => {
  const decision = analyzePurchaseDecision({
    work: {
      review_average: 0,
      review_count: 0,
      discount_rate: 50,
      duration: null,
      sale_end_at: null,
      sample_movie_url: null,
    },
    currentPrice,
    priceHistory: [currentPrice],
    offerCount: 1,
  });

  assert.equal(decision.verdict, "価格条件に注目したい作品");
  assert.ok(decision.cautions.some((item) => item.includes("過去最安との判定はできません")));
  assert.doesNotMatch(decision.summary, /過去最安水準/);
});

test("falls back to the normal price when sale price is zero", () => {
  const decision = analyzePurchaseDecision({
    work: {
      review_average: 4.5,
      review_count: 12,
      discount_rate: 0,
      duration: 90,
      sale_end_at: null,
      sample_movie_url: null,
    },
    currentPrice: { ...currentPrice, normal_price: 1800, sale_price: 0 },
    priceHistory: [],
  });

  assert.equal(decision.evidence[0]?.value, "¥1,800");
});
