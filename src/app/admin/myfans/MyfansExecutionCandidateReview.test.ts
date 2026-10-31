import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import { formatCandidateQualityBreakdown } from "./MyfansExecutionCandidateReview";

test("candidate quality breakdown prefers explicit zero values", () => {
  const breakdown = {
    stopPower: 0,
    firstLineStop: 6,
    visualLeverage: 0,
    visual: 7,
    specificity: 3,
    proof: 4,
    broadCuriosity: 0,
    audience: 5,
    followReason: 6,
    roleDifferentiation: 7,
    spamSalesSmell: 8,
  } as ExecutionCandidate["quality"]["breakdown"];

  assert.equal(
    formatCandidateQualityBreakdown(breakdown),
    "stop 0 / visual 0 / specificity 3 / proof 4 / curiosity 0 / follow 6 / role 7 / smell 8",
  );
});

test("candidate quality breakdown falls back to legacy fields and dashes", () => {
  const breakdown = {
    firstLineStop: 6,
    visual: 7,
    audience: 5,
  } as ExecutionCandidate["quality"]["breakdown"];

  assert.equal(
    formatCandidateQualityBreakdown(breakdown),
    "stop 6 / visual 7 / specificity - / proof - / curiosity 5 / follow - / role - / smell -",
  );
});
