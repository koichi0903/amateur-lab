import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionFacts, decisionFactEligibilityReason, decisionFactProofLine } from "./decisionFacts.ts";

const base = {
  currentPrice: 500,
  recordedLowestPrice: 500,
  discountRate: 50,
  isOnSale: true,
  ranking: 9999,
  reviewAverage: 4.5,
  reviewCount: 12,
  recordedLowestAt: "2026-09-23T12:00:00.000Z",
  coverageStart: "2026-07-08T00:00:00.000Z",
  coverageEnd: "2026-09-24T00:00:00.000Z",
  priceSeries: { displayName: "7日間", period: "7日間" },
};

test("builds a record-low fact without claiming FANZA all-time coverage", () => {
  const facts = buildDecisionFacts(base);
  assert.equal(facts.decisionType, "RECORD_LOW");
  assert.equal(facts.currentRecordedLow, "yes");
  assert.equal(facts.newRecordedLowToday, "unknown");
  assert.equal(facts.recordLow.scope, "observed_price_history");
  assert.match(decisionFactProofLine(facts), /発掘LABの記録上の最安値/);
  assert.doesNotMatch(decisionFactProofLine(facts), /FANZA全期間|過去最安/);
});

test("keeps the high-discount difference deterministic", () => {
  const facts = buildDecisionFacts({ ...base, currentPrice: 650, recordedLowestPrice: 500 });
  assert.equal(facts.decisionType, "HIGH_DISCOUNT_NOT_LOW");
  assert.equal(facts.differenceFromLowest, 150);
  assert.match(decisionFactProofLine(facts), /650円、記録最安500円より150円高い/);
});

test("classifies an outside-ranking review and price signal", () => {
  const facts = buildDecisionFacts({ ...base, currentPrice: 700, recordedLowestPrice: 500, discountRate: 20 });
  assert.equal(facts.decisionType, "HIDDEN_VALUE");
  assert.match(decisionFactProofLine(facts), /ランキング外。評価4\.5 \/ レビュー12件/);
});

test("HIDDEN_VALUE does not require recorded-low or price-history evidence", () => {
  assert.equal(decisionFactEligibilityReason({
    currentPrice: 800,
    recordedLowestPrice: null,
    isOnSale: true,
    discountRate: 20,
    ranking: null,
    reviewAverage: 4.4,
    reviewCount: 8,
  }, "HIDDEN_VALUE"), null);
  const facts = buildDecisionFacts({
    currentPrice: 800,
    recordedLowestPrice: null,
    isOnSale: true,
    discountRate: 20,
    ranking: null,
    reviewAverage: 4.4,
    reviewCount: 8,
  });
  assert.equal(facts.decisionType, "HIDDEN_VALUE");
  assert.match(decisionFactProofLine(facts), /ランキング外/);
});

test("RECORD_LOW and HIDDEN_VALUE can both be eligible from the same facts", () => {
  const facts = buildDecisionFacts({
    currentPrice: 500,
    recordedLowestPrice: 500,
    discountRate: 20,
    isOnSale: true,
    ranking: null,
    reviewAverage: 4.5,
    reviewCount: 10,
  });
  assert.deepEqual(facts.eligibleDecisionTypes, ["RECORD_LOW", "HIDDEN_VALUE"]);
  assert.equal(facts.decisionType, "RECORD_LOW");
});

test("HIGH_DISCOUNT_NOT_LOW never coexists with RECORD_LOW", () => {
  const facts = buildDecisionFacts({
    currentPrice: 500,
    recordedLowestPrice: 500,
    discountRate: 50,
    isOnSale: true,
    ranking: 10,
    reviewAverage: 4.5,
    reviewCount: 10,
  });
  assert.deepEqual(facts.eligibleDecisionTypes, ["RECORD_LOW"]);
  assert.equal(facts.eligibleDecisionTypes.includes("HIGH_DISCOUNT_NOT_LOW"), false);
});

test("HIGH_DISCOUNT_NOT_LOW requires the recorded-low comparison but not a chart", () => {
  assert.equal(decisionFactEligibilityReason({
    currentPrice: 800,
    recordedLowestPrice: 500,
    isOnSale: true,
    discountRate: 30,
    ranking: 20,
    reviewAverage: 4,
    reviewCount: 5,
  }, "HIGH_DISCOUNT_NOT_LOW"), null);
  assert.equal(decisionFactEligibilityReason({
    currentPrice: 800,
    recordedLowestPrice: null,
    isOnSale: true,
    discountRate: 30,
    ranking: 20,
    reviewAverage: 4,
    reviewCount: 5,
  }, "HIGH_DISCOUNT_NOT_LOW"), "missing_recorded_low");
});

test("does not fabricate a numeric claim when a source value is missing", () => {
  const facts = buildDecisionFacts({ ...base, currentPrice: null, recordedLowestPrice: null, reviewAverage: null, reviewCount: null });
  assert.equal(facts.decisionType, "UNKNOWN");
  assert.equal(facts.differenceFromLowest, null);
  assert.equal(decisionFactProofLine(facts), "");
});

test("keeps current recorded low separate from today's new low", () => {
  const facts = buildDecisionFacts({ ...base, newRecordedLowToday: false });
  assert.equal(facts.currentRecordedLow, "yes");
  assert.equal(facts.newRecordedLowToday, "no");
});

test("accepts today's new low only from an explicit deterministic fact", () => {
  const facts = buildDecisionFacts({ ...base, newRecordedLowToday: true });
  assert.equal(facts.currentRecordedLow, "yes");
  assert.equal(facts.newRecordedLowToday, "yes");
});
