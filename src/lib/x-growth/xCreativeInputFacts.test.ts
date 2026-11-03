import assert from "node:assert/strict";
import { calculateHookScore, strongestFacts } from "./xCreativeInputFacts";
import type { XCreativeInput } from "./xCreativeTypes";

const baseInput: XCreativeInput = {
  key: "hook-score-fixture",
  title: "fixture",
  url: "https://example.com/work",
  category: "work",
  actress: null,
  genre: null,
  currentPrice: 100,
  previousPrice: 200,
  discountRate: 30,
  reviewAverage: 4.7,
  reviewCount: 120,
  ranking: 42,
  score: 55,
  discoveryScore: null,
  buyTimingScore: null,
  isNinetyDayLow: false,
};

const result = calculateHookScore(baseInput);
assert.equal(result.axes.price_anomaly.score, 88);
assert.equal(result.axes.price_anomaly.metrics.discountRate, 50);
assert.equal(result.axes.rating_anomaly.score, 82);
assert.equal(result.axes.review_proof.score, 86);
assert.equal(result.axes.ranking_anomaly.score, 70);
assert.equal(result.axes.discovery_anomaly.score, 55);
assert.equal(result.axes.buy_timing.score, 88);
assert.equal(result.bestHook.type, "price_anomaly");
assert.equal(result.axes.price_anomaly.evidence, "200円から100円、50%OFF");

for (const [discountRate, expected] of [[14, 18], [15, 54], [30, 72], [50, 88], [70, 96]] as const) {
  const scored = calculateHookScore({ ...baseInput, currentPrice: null, previousPrice: null, discountRate });
  assert.equal(scored.axes.price_anomaly.score, expected, `${discountRate}% discount score`);
}

const ninetyDayLow = calculateHookScore({
  ...baseInput,
  currentPrice: null,
  previousPrice: null,
  discountRate: 15,
  isNinetyDayLow: true,
});
assert.equal(ninetyDayLow.axes.price_anomaly.score, 92);

assert.deepEqual(strongestFacts({
  ...baseInput,
  rankingHistoryCount: 2,
  previousRanking: 50,
}), ["50位→42位", "評価4.7"]);

assert.deepEqual(strongestFacts({
  ...baseInput,
  ranking: 20,
  reviewAverage: null,
  reviewCount: 0,
  discountRate: 0,
}), ["ランキング20位"]);

assert.deepEqual(strongestFacts({
  ...baseInput,
  ranking: 20,
  reviewAverage: 4.7,
  reviewCount: 120,
  discountRate: 0,
}), ["評価4.7", "ランキング20位"]);

assert.deepEqual(strongestFacts({
  ...baseInput,
  sourceType: "MONEY",
  ranking: null,
  reviewAverage: null,
  reviewCount: 0,
  discountRate: 0,
}), ["現在100円"]);

assert.deepEqual(strongestFacts({
  ...baseInput,
  ranking: null,
  reviewAverage: null,
  reviewCount: 0,
  discountRate: 0,
}), []);
