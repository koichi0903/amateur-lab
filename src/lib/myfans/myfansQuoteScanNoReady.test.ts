import assert from "node:assert/strict";
import test from "node:test";
import { resolveNoReadyQuoteCandidateOutcome } from "./myfansQuoteScanNoReady.ts";

const incompleteStatuses = new Set(["THREAD_NOT_FULLY_OBSERVED", "THREAD_INCOMPLETE_WITHOUT_LINK"]);

test("returns retryable thread status when collection is incomplete", () => {
  const statuses = [{ status: "THREAD_NOT_FULLY_OBSERVED" }];
  assert.deepEqual(resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: true,
    statuses,
    incompleteStatuses,
  }), {
    kind: "thread-status",
    statuses,
    incomplete: true,
    reason: "THREAD_NOT_FULLY_OBSERVED",
    error: "THREAD_NOT_FULLY_OBSERVED: status threadを十分に観測できませんでした。",
  });
});

test("preserves successful empty status response and fallback reason", () => {
  assert.deepEqual(resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: true,
    statuses: [],
    incompleteStatuses,
  }), {
    kind: "thread-status",
    statuses: [],
    incomplete: false,
    reason: "THREAD_INCOMPLETE_WITHOUT_LINK",
    error: undefined,
  });
});

test("uses no-body fallback when the collector candidate or status array is absent", () => {
  assert.deepEqual(resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: false,
    statuses: [{ status: "THREAD_NOT_FULLY_OBSERVED" }],
    incompleteStatuses,
  }), { kind: "no-body" });
  assert.deepEqual(resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: true,
    statuses: undefined,
    incompleteStatuses,
  }), { kind: "no-body" });
});

test("matches statuses after NFKC normalization but retains the raw reason", () => {
  const outcome = resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: true,
    statuses: [{ status: "　THREAD_NOT_FULLY_OBSERVED　" }],
    incompleteStatuses,
  });

  assert.equal(outcome.kind, "thread-status");
  if (outcome.kind !== "thread-status") return;
  assert.equal(outcome.incomplete, true);
  assert.equal(outcome.reason, "　THREAD_NOT_FULLY_OBSERVED　");
});
