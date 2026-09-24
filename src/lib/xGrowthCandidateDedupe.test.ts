import assert from "node:assert/strict";
import test from "node:test";
import { buildXCreativeVariants } from "./xCreativeEngine";
import { candidateDedupeKey, candidateMediaDedupeKey, cheapCandidatePrefilter, decisionCoverageScore, decisionTypeForCandidate, decisionTypesForCandidate, expandCreativeSupply, isDecisionFactEligible, isDistinctCandidate, presentationDecisionFactsForSource, preserveDecisionLanesBeforeLimit } from "./xGrowthOS";
import { buildDecisionFacts } from "./domain/decisionFacts";

const candidate = (overrides: Record<string, unknown> = {}) => ({
  workId: 1,
  productId: "p1",
  sampleMovieUrl: null,
  mediaAsset: null,
  ...overrides,
});

test("candidate identity prioritizes media asset, sample URL, then work", () => {
  assert.equal(candidateDedupeKey(candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://same" })), "media_asset:42");
  assert.equal(candidateDedupeKey(candidate({ sampleMovieUrl: "https://same" })), "sample_movie_url:https://same");
  assert.equal(candidateDedupeKey(candidate()), "work:1");
});

test("same slot rejects duplicate media asset, sample URL, and work", () => {
  assert.equal(isDistinctCandidate(candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://a" }), []), true);
  assert.equal(isDistinctCandidate(candidate({ workId: 2, mediaAsset: { id: 42 }, sampleMovieUrl: "https://b" }), [candidate({ mediaAsset: { id: 42 }, sampleMovieUrl: "https://a" })]), false);
  assert.equal(isDistinctCandidate(candidate({ workId: 2, sampleMovieUrl: "https://a" }), [candidate({ workId: 3, sampleMovieUrl: "https://a" })]), false);
  assert.equal(isDistinctCandidate(candidate({ workId: 1, sampleMovieUrl: "https://b" }), [candidate({ workId: 1, sampleMovieUrl: "https://a" })]), false);
});

test("different media can reuse a work only when caller explicitly allows cross-slot reuse", () => {
  const first = candidate({ mediaAsset: { id: 1 }, sampleMovieUrl: "https://a" });
  const second = candidate({ mediaAsset: { id: 2 }, sampleMovieUrl: "https://b" });
  assert.equal(candidateMediaDedupeKey(first) === candidateMediaDedupeKey(second), false);
  assert.equal(isDistinctCandidate(second, [first]), false);
});

test("Decision Facts eligibility excludes UNKNOWN and preserves all three lanes", () => {
  const facts = (decisionType: "RECORD_LOW" | "HIGH_DISCOUNT_NOT_LOW" | "HIDDEN_VALUE") => ({
    ...buildDecisionFacts({
      currentPrice: 500,
      recordedLowestPrice: decisionType === "RECORD_LOW" ? 500 : 400,
      discountRate: decisionType === "HIDDEN_VALUE" ? 20 : 50,
      isOnSale: true,
      ranking: decisionType === "HIDDEN_VALUE" ? null : 10,
      reviewAverage: 4.5,
      reviewCount: 10,
    }),
    decisionType,
  });
  assert.equal(isDecisionFactEligible({ decisionFacts: { decisionType: "UNKNOWN" } } as never), false);
  assert.equal(isDecisionFactEligible({ decisionFacts: facts("RECORD_LOW") } as never), true);
  assert.equal(isDecisionFactEligible({ decisionFacts: facts("HIGH_DISCOUNT_NOT_LOW") } as never), true);
  assert.equal(isDecisionFactEligible({ decisionFacts: facts("HIDDEN_VALUE") } as never), true);
  const supply = { RECORD_LOW: 10, HIGH_DISCOUNT_NOT_LOW: 10, HIDDEN_VALUE: 10, UNKNOWN: 0 } as const;
  assert.equal(decisionCoverageScore("RECORD_LOW", {}, supply), 100);
  assert.equal(decisionCoverageScore("HIGH_DISCOUNT_NOT_LOW", { RECORD_LOW: 1 }, supply), 100);
  assert.equal(decisionCoverageScore("HIDDEN_VALUE", { RECORD_LOW: 1, HIGH_DISCOUNT_NOT_LOW: 1 }, supply), 100);
  assert.equal(decisionCoverageScore("RECORD_LOW", { RECORD_LOW: 1, HIGH_DISCOUNT_NOT_LOW: 1, HIDDEN_VALUE: 1 }, supply), 0);
});

test("multi-label Decision Facts preserve HIDDEN lane eligibility while primary stays presentation-specific", () => {
  const facts = buildDecisionFacts({
    currentPrice: 500,
    recordedLowestPrice: 500,
    discountRate: 20,
    isOnSale: true,
    ranking: null,
    reviewAverage: 4.5,
    reviewCount: 10,
  });
  assert.equal(facts.decisionType, "RECORD_LOW");
  assert.deepEqual(decisionTypesForCandidate({ decisionFacts: facts } as never), ["RECORD_LOW", "HIDDEN_VALUE"]);
  const hiddenPresentation = { ...facts, decisionType: "HIDDEN_VALUE" as const };
  assert.equal(isDecisionFactEligible({ decisionFacts: hiddenPresentation } as never), true);
});

test("HIDDEN_GEM sourceType promotes a multi-label candidate to HIDDEN_VALUE primary", () => {
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
  assert.equal(decisionTypeForCandidate({ decisionFacts: facts, sourceType: "HIDDEN_GEM" } as never), "HIDDEN_VALUE");
  assert.equal(decisionTypeForCandidate({ decisionFacts: facts, sourceType: "PRICE_EVENT" } as never), "RECORD_LOW");
});

test("HIDDEN_GEM expansion propagates primary facts into HIDDEN copy and persistence payload", () => {
  const facts = buildDecisionFacts({
    currentPrice: 213,
    recordedLowestPrice: 213,
    discountRate: 30,
    isOnSale: true,
    ranking: null,
    reviewAverage: 4.5,
    reviewCount: 10,
  });
  const primaryFacts = presentationDecisionFactsForSource(facts, "HIDDEN_GEM");
  assert.equal(primaryFacts?.decisionType, "HIDDEN_VALUE");
  assert.deepEqual(primaryFacts?.eligibleDecisionTypes, ["RECORD_LOW", "HIDDEN_VALUE"]);
  const hiddenCopy = buildXCreativeVariants({
    key: "hidden-primary",
    title: "Hidden work",
    url: "https://example.test/work",
    category: "discovery_gap",
    actress: null,
    genre: null,
    currentPrice: 213,
    previousPrice: null,
    discountRate: 30,
    reviewAverage: 4.5,
    reviewCount: 10,
    ranking: null,
    score: 50,
    discoveryScore: 60,
    buyTimingScore: 40,
    isNinetyDayLow: false,
    decisionFacts: primaryFacts!,
    sourceType: "HIDDEN_GEM",
  });
  assert.equal(hiddenCopy.some((variant) => variant.bodyText.includes("ランキング外") && variant.bodyText.includes("レビュー10件")), true);

  const expanded = expandCreativeSupply([{
    key: "hidden-expansion",
    category: "score",
    sourceType: "WORK",
    discoveryScore: 60,
    decisionFacts: facts,
  } as never]);
  const hidden = expanded.find((candidate) => candidate.sourceType === "HIDDEN_GEM");
  assert.equal(hidden?.decisionFacts?.decisionType, "HIDDEN_VALUE");
  assert.deepEqual(hidden?.decisionFacts?.eligibleDecisionTypes, ["RECORD_LOW", "HIDDEN_VALUE"]);
});

test("cheap prefilter reserves every available Decision Facts lane before score fill", () => {
  const facts = (decisionType: "RECORD_LOW" | "HIGH_DISCOUNT_NOT_LOW" | "HIDDEN_VALUE") => ({
    ...buildDecisionFacts({
      currentPrice: 500,
      recordedLowestPrice: decisionType === "RECORD_LOW" ? 500 : 400,
      discountRate: decisionType === "HIDDEN_VALUE" ? 20 : 50,
      isOnSale: true,
      ranking: decisionType === "HIDDEN_VALUE" ? null : 10,
      reviewAverage: 4.5,
      reviewCount: 10,
    }),
    decisionType,
  });
  const visualScoring = { videoHookStrength: 0, visualSpecificity: 0 } as never;
  const recordLow = Array.from({ length: 120 }, (_, index) => ({
    key: `record-${index}`,
    sourceType: "COMPARISON",
    decisionFacts: facts("RECORD_LOW"),
    visualScoring,
    reachScore: 100,
    followScore: 100,
    authorityScore: 100,
    revenueScore: 100,
  }));
  const highDiscount = {
    key: "high-discount",
    sourceType: "PRICE_EVENT",
    decisionFacts: facts("HIGH_DISCOUNT_NOT_LOW"),
    visualScoring,
    reachScore: 1,
    followScore: 1,
    authorityScore: 1,
    revenueScore: 1,
  };
  const hiddenValue = {
    key: "hidden-value",
    sourceType: "HIDDEN_GEM",
    decisionFacts: facts("HIDDEN_VALUE"),
    visualScoring,
    reachScore: 1,
    followScore: 1,
    authorityScore: 1,
    revenueScore: 1,
  };
  const result = cheapCandidatePrefilter([...recordLow, highDiscount, hiddenValue] as never, 30);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "RECORD_LOW"), true);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "HIGH_DISCOUNT_NOT_LOW"), true);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "HIDDEN_VALUE"), true);
});

test("score window preserves Decision Facts lanes before truncating ranked supply", () => {
  const facts = (decisionType: "RECORD_LOW" | "HIGH_DISCOUNT_NOT_LOW" | "HIDDEN_VALUE") => ({
    ...buildDecisionFacts({
      currentPrice: 500,
      recordedLowestPrice: decisionType === "RECORD_LOW" ? 500 : 400,
      discountRate: decisionType === "HIDDEN_VALUE" ? 20 : 50,
      isOnSale: true,
      ranking: decisionType === "HIDDEN_VALUE" ? null : 10,
      reviewAverage: 4.5,
      reviewCount: 10,
    }),
    decisionType,
  });
  const visualScoring = { videoHookStrength: 0, visualSpecificity: 0 } as never;
  const recordLow = Array.from({ length: 600 }, (_, index) => ({
    key: `record-window-${index}`,
    workId: index + 1,
    sourceType: "COMPARISON",
    decisionFacts: facts("RECORD_LOW"),
    visualScoring,
  }));
  const highDiscount = { key: "high-window", workId: 10_001, sourceType: "PRICE_EVENT", decisionFacts: facts("HIGH_DISCOUNT_NOT_LOW"), visualScoring };
  const hiddenValue = { key: "hidden-window", workId: 10_002, sourceType: "HIDDEN_GEM", decisionFacts: facts("HIDDEN_VALUE"), visualScoring };
  const result = preserveDecisionLanesBeforeLimit([...recordLow, highDiscount, hiddenValue] as never, 100);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "RECORD_LOW"), true);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "HIGH_DISCOUNT_NOT_LOW"), true);
  assert.equal(result.some((item) => item.decisionFacts?.decisionType === "HIDDEN_VALUE"), true);
});
