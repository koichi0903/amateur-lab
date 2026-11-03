import assert from "node:assert/strict";
import test from "node:test";
import { calculateDiscoveryScore } from "./discoveryScore.ts";

const emptyFunnel = {
  pageViews: 0,
  fanzaClicks: 0,
  rawCtr: 0,
  adjustedCtr: 0,
  confidence: 0,
};

test("discovery score combines hidden-rank, price, reviews, and funnel evidence", () => {
  const result = calculateDiscoveryScore({
    work: {
      id: 1,
      score: 85,
      price: 100,
      sale_price: 50,
      list_price: 100,
      discount_rate: 50,
      lowest_price: 50,
      review_average: 4.6,
      review_count: 36,
      ranking: 200,
      release_date: new Date(Date.now() - 365 * 86_400_000).toISOString(),
    },
    priceHistory: [{ normal_price: 80, sale_price: null }],
    buyTimingScore: 75,
    funnel: { ...emptyFunnel, pageViews: 20, fanzaClicks: 3, adjustedCtr: 9 },
  });

  assert.equal(result.score, 90);
  assert.equal(result.label, "本日の最有力発掘");
  assert.equal(result.currentPrice, 50);
  assert.equal(result.regularPrice, 100);
  assert.equal(result.discountRate, 50);
  assert.equal(result.lowestPrice, 50);
  assert.equal(result.lowestPriceText, "過去最安値と同額または更新");
  assert.equal(result.hiddenRankBonus, 18);
  assert.equal(result.reviewConfidence, 0.73);
  assert.equal(result.funnelConfidence, 1);
  assert.deepEqual(result.reasons, [
    "ランキング200位で上位定番に埋もれている",
    "評価4.60・レビュー36件で品質指標が強い",
    "既存発掘スコア85の有力作",
    "買い時スコア75で価格条件も強い",
  ]);
});

test("sparse high-ranking items stay low-confidence comparison candidates", () => {
  const result = calculateDiscoveryScore({
    work: { id: 2, ranking: 10, review_count: 3 },
    priceHistory: [],
    buyTimingScore: 0,
    funnel: emptyFunnel,
  });

  assert.equal(result.score, 0);
  assert.equal(result.label, "比較候補");
  assert.equal(result.lowestPriceText, "過去最安値データを蓄積中");
  assert.equal(result.hiddenRankBonus, 8);
  assert.equal(result.reviewConfidence, 0.28);
  assert.equal(result.funnelConfidence, 0);
  assert.deepEqual(result.reasons, ["ランキング10位で再評価余地あり"]);
});

test("discovery reasons keep price and funnel evidence in their existing order", () => {
  const result = calculateDiscoveryScore({
    work: { id: 3, price: 50, list_price: 100, discount_rate: 30, lowest_price: 50 },
    priceHistory: [],
    buyTimingScore: 0,
    funnel: { ...emptyFunnel, pageViews: 20, adjustedCtr: 5 },
  });

  assert.deepEqual(result.reasons, [
    "50%OFFで割安感がある",
    "過去最安値クラスまで下がっている",
    "直近30日の補正CTRが5%",
  ]);
});
