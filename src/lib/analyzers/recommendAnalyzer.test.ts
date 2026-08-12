import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecommendation, type RecommendationInput } from "./recommendAnalyzer.ts";

const baseWork = {
  review_average: 0,
  review_count: 0,
  ranking: null,
  realtime_rank: null,
  previous_realtime_rank: null,
  score: 0,
  stage: "OLD",
  duration: 60,
  long_hit_rank: null,
};

const price = (sale: number, changed_at?: string) => ({
  display_name: "HD版",
  type: "download",
  normal_price: 1000,
  sale_price: sale,
  changed_at,
});

const titles = (input: RecommendationInput) => analyzeRecommendation(input).map((reason) => reason.title);

test("現在500円・過去250円は過去最安値にしない", () => {
  const result = titles({
    work: baseWork,
    currentPrice: price(500),
    priceHistory: [price(500, "2026-08-12"), price(250, "2026-08-01")],
  });
  assert.equal(result.includes("過去最安値"), false);
  assert.equal(result[0], "大幅割引");
});

test("現在250円・過去500円は真の過去最安値にする", () => {
  const result = titles({
    work: baseWork,
    currentPrice: price(250),
    priceHistory: [price(250, "2026-08-12"), price(500, "2026-08-01")],
  });
  assert.equal(result[0], "過去最安値");
});

test("同一価格種別・同一表示条件の履歴だけを比較する", () => {
  const otherCondition = { ...price(100), display_name: "4K版", changed_at: "2026-08-01" };
  assert.equal(titles({ work: baseWork, currentPrice: price(500), priceHistory: [otherCondition, price(800, "2026-07-01")] })[0], "過去最安値");
});

test("4カテゴリから各1件だけを優先順で選ぶ", () => {
  const result = analyzeRecommendation({
    work: { ...baseWork, review_average: 4.58, review_count: 80, realtime_rank: 17, previous_realtime_rank: 50, score: 85, stage: "NEW", duration: 180, long_hit_rank: 4 },
    currentPrice: price(250),
    priceHistory: [price(500, "2026-08-01")],
    entityRanks: { actress: 1, genre: 1, maker: 1, series: 1 },
  });
  assert.deepEqual(result.map((reason) => reason.title), ["過去最安値", "高評価", "ランキング急上昇", "発掘スコア上位"]);
  assert.equal(new Set(result.map((reason) => reason.category)).size, 4);
});

test("成立数が少ない作品は無理に4件へ補完しない", () => {
  assert.deepEqual(titles({ work: { ...baseWork, review_count: 55, stage: "SEMI_NEW" } }), ["レビュー多数", "準新作"]);
});
