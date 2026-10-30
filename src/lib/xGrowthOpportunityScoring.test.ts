import assert from "node:assert/strict";
import test from "node:test";
import { compareOpportunitiesByPeakScore } from "./xGrowthOpportunityScoring";

const opportunity = (reachScore: number, followScore = 0, authorityScore = 0, revenueScore = 0) => ({
  reachScore,
  followScore,
  authorityScore,
  revenueScore,
});

test("peak-score comparator sorts descending and preserves ties", () => {
  assert.ok(compareOpportunitiesByPeakScore(opportunity(90), opportunity(75, 80)) < 0);
  assert.equal(compareOpportunitiesByPeakScore(opportunity(70, 80), opportunity(80, 70)), 0);
});
