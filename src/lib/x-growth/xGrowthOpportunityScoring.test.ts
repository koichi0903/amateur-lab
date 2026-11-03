import assert from "node:assert/strict";
import test from "node:test";
import { compareOpportunitiesByPeakScore, inferXGrowthEvent } from "./xGrowthOpportunityScoring.ts";

const opportunity = (reachScore: number, followScore = 0, authorityScore = 0, revenueScore = 0) => ({
  reachScore,
  followScore,
  authorityScore,
  revenueScore,
});

const candidate = {
  category: "sales" as const,
  decisionFacts: null,
  ranking: null,
  reviewAverage: null,
  reviewCount: 0,
};

test("peak-score comparator sorts descending and preserves ties", () => {
  assert.ok(compareOpportunitiesByPeakScore(opportunity(90), opportunity(75, 80)) < 0);
  assert.equal(compareOpportunitiesByPeakScore(opportunity(70, 80), opportunity(80, 70)), 0);
});

test("keeps event inference priorities from decision evidence through fallback signals", () => {
  assert.equal(inferXGrowthEvent({ ...candidate, decisionFacts: { decisionType: "RECORD_LOW" }, category: "today_discovery" }), "price_anomaly");
  assert.equal(inferXGrowthEvent({ ...candidate, decisionFacts: { decisionType: "HIDDEN_VALUE" }, category: "today_buy" }), "hidden_gem");
  assert.equal(inferXGrowthEvent({ ...candidate, category: "deal" }), "price_anomaly");
  assert.equal(inferXGrowthEvent({ ...candidate, category: "today_discovery" }), "hidden_gem");
  assert.equal(inferXGrowthEvent({ ...candidate, category: "actress_best" }), "creator_trend");
  assert.equal(inferXGrowthEvent({ ...candidate, category: "series_best" }), "series_trend");
  assert.equal(inferXGrowthEvent({ ...candidate, category: "genre_best" }), "genre_trend");
  assert.equal(inferXGrowthEvent({ ...candidate, ranking: 30, reviewAverage: 5, reviewCount: 20 }), "ranking_velocity");
  assert.equal(inferXGrowthEvent({ ...candidate, reviewAverage: 4.5, reviewCount: 10 }), "review_anomaly");
  assert.equal(inferXGrowthEvent(candidate), "traffic_velocity");
});
