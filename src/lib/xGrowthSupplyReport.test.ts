import assert from "node:assert/strict";
import test from "node:test";
import { buildSupplyDiagnostics } from "./xGrowthSupplyReport";

test("empty supply reports configured shortages and zeroed diagnostic defaults", () => {
  const report = buildSupplyDiagnostics([], [], undefined, undefined, new Set());

  assert.equal(report.target, "候補不足");
  assert.deepEqual(report.eligibleByIntent, { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 });
  assert.deepEqual(report.shortagesByRole, { REACH: 5, FOLLOW: 3, AUTHORITY: 2, CONVERSATION: 0, MONEY: 2 });
  assert.deepEqual(report.pipeline, {
    rawCandidates: 0,
    afterPosted: 0,
    afterStale: 0,
    afterMedia: 0,
    afterQuality: 0,
    afterSemantic: 0,
    slotEligible: 0,
    finalSelected: 0,
  });
  assert.deepEqual(report.decisionPipeline.eligibleByType, { RECORD_LOW: 0, HIGH_DISCOUNT_NOT_LOW: 0, HIDDEN_VALUE: 0 });
  assert.equal(report.mediaMix.uniqueAudit.passed, true);
});

test("supply report counts source and MONEY gates for a candidate without variants", () => {
  const candidate = {
    workId: 1,
    title: "fixture",
    sourceType: "MONEY",
    mediaType: "data_card",
    creativeAngle: "fixture",
    creativeVariants: [],
    freshness: { status: "fresh" },
    mediaUsage: "not_available",
    sampleMovieUrl: null,
    imageUrl: null,
    recommendedMediaUrl: null,
    discountRate: 0,
    currentPrice: null,
    previousPrice: null,
    rankingHistory: { status: "none" },
  };
  const report = buildSupplyDiagnostics([candidate as never], [], undefined, undefined, new Set());

  assert.deepEqual(report.mediaTypeCounts, { data_card: 1 });
  assert.deepEqual(report.sourceTypeCounts, { MONEY: 1 });
  assert.deepEqual(report.generatedBySource, { MONEY: 1 });
  assert.equal(report.eligibleByIntent.MONEY, 1);
  assert.deepEqual(report.moneyGateReasons, [{
    workId: 1,
    candidateId: null,
    reasons: ["missing_affiliate_url", "price_truth_unavailable", "media_mismatch"],
  }]);
  assert.deepEqual(report.decisionTypeCounts, { UNKNOWN: 1 });
});

test("shortages distinguish generated REACH candidates from Gate OK candidates", () => {
  const candidate = {
    workId: 2,
    title: "fixture",
    sourceType: "MARKET",
    mediaType: "data_card",
    creativeAngle: "fixture",
    creativeVariants: [],
    freshness: { status: "fresh" },
    mediaUsage: "not_available",
    sampleMovieUrl: null,
    imageUrl: null,
    recommendedMediaUrl: null,
    discountRate: 0,
    currentPrice: null,
    previousPrice: null,
    rankingHistory: { status: "none" },
  };
  const report = buildSupplyDiagnostics([candidate as never], [], undefined, undefined, new Set());

  assert.ok(report.shortages.includes("REACH候補は1件生成したがGate OKが不足"));
});

test("supplied pipeline and decision selection diagnostics remain authoritative", () => {
  const report = buildSupplyDiagnostics(
    [],
    [],
    {
      sourcePoolTotal: 9,
      sourcePoolAfterPosted: 8,
      postedExcluded: 1,
      prefilterCount: 5,
      humanVoiceTargetCount: 4,
      diversityTargetCount: 3,
      pipeline: { rawCandidates: 9, afterPosted: 8 },
    },
    {
      eligibleSupply: { RECORD_LOW: 4, HIGH_DISCOUNT_NOT_LOW: 3, HIDDEN_VALUE: 2, UNKNOWN: 0 },
      dedupedEligibleSupply: 8,
      selectedBeforeReplenishment: 3,
      replenished: 1,
      selected: 4,
      selectedByType: { RECORD_LOW: 2, HIGH_DISCOUNT_NOT_LOW: 1, HIDDEN_VALUE: 1, UNKNOWN: 0 },
    },
    new Set(),
  );

  assert.equal(report.sourcePoolTotal, 9);
  assert.equal(report.sourcePoolAfterPosted, 8);
  assert.equal(report.postedExcluded, 1);
  assert.deepEqual(report.pipeline, { rawCandidates: 9, afterPosted: 8 });
  assert.equal(report.decisionPipeline.eligible, 9);
  assert.equal(report.decisionPipeline.dedupedEligible, 8);
  assert.equal(report.decisionPipeline.replenished, 1);
  assert.equal(report.decisionPipeline.persisted, 0);
  assert.deepEqual(report.decisionPipeline.selectedByType, { RECORD_LOW: 2, HIGH_DISCOUNT_NOT_LOW: 1, HIDDEN_VALUE: 1, UNKNOWN: 0 });
});
