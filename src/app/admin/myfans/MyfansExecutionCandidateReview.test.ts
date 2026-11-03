import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import { buildCandidateVisualReviewValues, formatCandidateQualityBreakdown } from "./MyfansExecutionCandidateReview";

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

test("candidate visual review preserves zero confidence and applies existing text fallbacks", () => {
  const candidate = {
    visualUnderstanding: {
      visualAnalysisStatus: "analyzed",
      analyzerVersion: "v2",
      rawVisualEvidence: "",
      concreteVisualCue: "wide framing",
      cueConfidence: 0,
      humanObservation: "",
      evidenceSource: "",
      sourceEvidence: "frame sample",
      visualMoment: "gesture",
      compositionOrStyle: "",
      cameraDistanceOrFraming: "medium shot",
    },
    quality: {
      breakdown: { followReason: null, specificity: 0 },
      reasons: ["clear action", "specific frame"],
    },
    reactionType: null,
    whyThisAngle: "opening frame",
  } as unknown as ExecutionCandidate;

  assert.deepEqual(buildCandidateVisualReviewValues(candidate), {
    visualAnalysisStatus: "analyzed",
    analyzerVersion: "v2",
    rawVisualEvidence: "wide framing",
    cueConfidence: 0,
    humanObservation: "-",
    evidenceSource: "frame sample",
    visualMoment: "gesture",
    compositionOrStyle: "-",
    cameraDistanceOrFraming: "medium shot",
    naturalness: "-",
    specificity: 0,
    qualityReasons: "clear action / specific frame",
    reactionType: "-",
    whyThisAngle: "opening frame",
  });
});

test("candidate visual review remains absent when no visual evidence exists", () => {
  assert.equal(buildCandidateVisualReviewValues({ visualUnderstanding: null } as unknown as ExecutionCandidate), null);
});
