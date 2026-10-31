import assert from "node:assert/strict";
import test from "node:test";
import type { XGrowthOpportunity } from "./xGrowthTypes";
import type { XPostCandidate } from "../xPostPlanner";
import {
  buildXGrowthVideoCandidateSignals,
  collectHardGatePassedVideoIds,
  collectVideoQualityFailureCounts,
  selectBestVideoOpportunityByWorkId,
} from "./xGrowthVideoCandidateSummary";

function opportunity(workId: number, freshness: number, creativeVariants: unknown[]): XGrowthOpportunity {
  return { workId, freshness: { total: freshness }, creativeVariants } as unknown as XGrowthOpportunity;
}

function movieVariant(total: number, passed: boolean, failed: string[] = [], reasons: string[] = []) {
  return {
    mediaType: "sample_movie",
    quality: { total, passed, gate: { failed }, lastMile: { reasons } },
  };
}

function candidate(workId: number): XPostCandidate {
  return {
    workId,
    title: `作品 ${workId}`,
    score: 90 - workId,
    discountRate: 20,
    saleEndAt: null,
  } as unknown as XPostCandidate;
}

test("video quality summaries count failed sample movies and select the best passing movie quality", () => {
  const failed = opportunity(1, 40, [movieVariant(60, false, ["weak_visual", "low_hook"], ["not_native"])]);
  const passed = opportunity(1, 70, [movieVariant(80, true)]);
  const nonMovie = opportunity(2, 30, [{ mediaType: "text", quality: { total: 100, passed: false, gate: { failed: ["ignored"] }, lastMile: { reasons: ["ignored"] } } }]);

  assert.deepEqual(collectVideoQualityFailureCounts([failed, passed, nonMovie]), {
    "axis:weak_visual": 1,
    "axis:low_hook": 1,
    "last-mile:not_native": 1,
  });
  assert.deepEqual([...collectHardGatePassedVideoIds([failed, passed, nonMovie])], [1]);
  assert.equal(selectBestVideoOpportunityByWorkId([failed, passed]).get(1), passed);
});

test("video candidate signals retain the first pipeline drop reason and fallback fields", () => {
  const candidateIds = new Set([1, 2, 3, 4, 5, 6, 7]);
  const all = new Set([1, 2, 3, 4, 5, 6, 7]);
  const stages = {
    expandedVideoIds: new Set([1, 3, 4, 5, 6, 7]),
    scoreWindowVideoIds: new Set([1, 4, 5, 6, 7]),
    afterMediaVideoIds: new Set([1, 5, 6, 7]),
    prefilterVideoIds: new Set([1, 6, 7]),
    hardGateVideoIds: new Set([1, 7]),
  };
  const candidates = new Map([...all].filter((id) => id !== 1).map((id) => [id, candidate(id)]));
  const opportunities = new Map([[1, opportunity(1, 75, [movieVariant(82, true)])]]);
  const signals = buildXGrowthVideoCandidateSignals(candidateIds, candidates, opportunities, stages);

  assert.deepEqual(signals.map((signal) => signal.firstDropReason), [
    null,
    "creative_supply_expansion",
    "shared_score_window",
    "current_url_media_eligibility",
    "shared_quality_prefilter",
    "creative_quality_gate",
    null,
  ]);
  assert.equal(signals[0].title, "作品 1");
  assert.equal(signals[0].rankingScore, 0);
  assert.equal(signals[0].freshnessScore, 75);
  assert.equal(signals[0].creativeQualityScore, 82);
  assert.equal(signals[6].hardGatePassed, true);
});
