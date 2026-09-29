import test from "node:test";
import assert from "node:assert/strict";
import { calculateWinnerScore, evaluateCrossAccountGuard, rankMarketWinnerCandidates, winnerScoreComponents } from "./myfansMarketWinner";

const base = { sourceXUrl: "https://x.com/creator/status/1", body: "本文", productId: 10, creatorId: 20, sourceStrength: 80, productOpportunity: 70, creatorStrength: 60, patternFit: 90, globalContentFingerprint: "fp-1" };

test("same source and body are hard guards, product cooldown is hard, creator is a penalty", () => {
  const decision = evaluateCrossAccountGuard(base, [{ sourceXUrl: base.sourceXUrl, globalContentFingerprint: base.globalContentFingerprint, productId: 10, creatorId: 20, cooldownUntil: "2099-01-01T00:00:00.000Z" }]);
  assert.equal(decision.blocked, true);
  assert.deepEqual(decision.reasons.sort(), ["product_cooldown", "same_body_fingerprint", "same_source"]);
});

test("creator reuse is allowed with a diversity penalty", () => {
  const ranked = rankMarketWinnerCandidates([base], [{ creatorId: 20, lastSeenAt: "2026-09-27T00:00:00.000Z" }], new Date("2026-09-28T00:00:00.000Z"));
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].guard.blocked, false);
  assert.equal(ranked[0].guard.penalty, 8);
});

test("learning feedback changes the next score without changing the source row", () => {
  const neutral = evaluateCrossAccountGuard(base, []);
  const priorScore = calculateWinnerScore({ ...base, learningWeight: 1 }, neutral);
  const learnedScore = calculateWinnerScore({ ...base, learningWeight: 1.8 }, neutral);
  assert.equal(winnerScoreComponents({ ...base, learningWeight: 1.8 }, neutral).learningWeight, 1.8);
  assert.ok(learnedScore > priorScore);
  assert.equal(base.globalContentFingerprint, "fp-1");
});
