import assert from "node:assert/strict";
import test from "node:test";
import { calculateScore } from "./score.ts";

const completeCandidate = {
  reviewAverage: 4.6,
  reviewCount: 100,
  maxDiscountRate: 30,
  currentPrice: 700,
  lowestPrice: 600,
  hasSampleMovie: true,
  sampleImageCount: 5,
  hasImage: true,
  actressPoint: 8,
  genrePoint: 6,
  makerPoint: 4,
  seriesPoint: 3,
  realtimeRank: 100,
  dailyRank: 120,
  weeklyRank: 50,
  monthlyRank: 300,
  longHitRank: 80,
  releaseDate: null,
};

test("preserves score, discount, and decision support for a complete candidate", () => {
  const result = calculateScore(completeCandidate);
  assert.deepEqual({
    score: result.score,
    discountPoint: result.discountPoint,
    decisionSupportPoint: result.decisionSupportPoint,
  }, {
    score: 66,
    discountPoint: 7.666666666666667,
    decisionSupportPoint: 5,
  });
});

test("preserves the sparse low-review candidate result and defaults", () => {
  const result = calculateScore({
    reviewAverage: 0,
    reviewCount: 0,
    maxDiscountRate: 0,
    currentPrice: null,
    lowestPrice: null,
    actressPoint: 0,
    genrePoint: 0,
    makerPoint: 0,
    seriesPoint: 0,
    realtimeRank: 1,
    longHitRank: 1,
    releaseDate: null,
  });
  assert.deepEqual({
    score: result.score,
    discountPoint: result.discountPoint,
    decisionSupportPoint: result.decisionSupportPoint,
  }, {
    score: 24,
    discountPoint: 2,
    decisionSupportPoint: 0,
  });
});

test("preserves the lowest-price discount and information-support points", () => {
  const result = calculateScore({
    ...completeCandidate,
    currentPrice: 500,
    lowestPrice: 500,
    maxDiscountRate: 0,
    hasSampleMovie: false,
    sampleImageCount: 0,
    hasImage: false,
  });
  assert.deepEqual({
    score: result.score,
    discountPoint: result.discountPoint,
    decisionSupportPoint: result.decisionSupportPoint,
  }, {
    score: 64,
    discountPoint: 10,
    decisionSupportPoint: 1,
  });
});
