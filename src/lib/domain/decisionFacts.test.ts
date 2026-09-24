import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionFacts, decisionFactProofLine } from "./decisionFacts.ts";

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

test("does not fabricate a numeric claim when a source value is missing", () => {
  const facts = buildDecisionFacts({ ...base, currentPrice: null, recordedLowestPrice: null, reviewAverage: null, reviewCount: null });
  assert.equal(facts.decisionType, "UNKNOWN");
  assert.equal(facts.differenceFromLowest, null);
  assert.equal(decisionFactProofLine(facts), "");
});
