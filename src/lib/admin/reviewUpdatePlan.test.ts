import assert from "node:assert/strict";
import test from "node:test";
import { createReviewUpdatePlan, resolveReviewPageState, shouldStopReviewUpdateForDeadline } from "./reviewUpdatePlan.ts";

test("review update plan keeps the full run default and clamps explicit maxItems to one", () => {
  assert.deepEqual(createReviewUpdatePlan(25, {}), {
    targetEnd: Number.POSITIVE_INFINITY,
    deadline: null,
  });
  assert.equal(createReviewUpdatePlan(25, { maxItems: 0 }).targetEnd, 26);
  assert.equal(createReviewUpdatePlan(25, { maxItems: -10 }).targetEnd, 26);
  assert.equal(createReviewUpdatePlan(25, { maxItems: 4 }).targetEnd, 29);
});

test("review update plan creates a deadline only for a positive time budget", () => {
  const now = () => 1000;
  assert.deepEqual(createReviewUpdatePlan(0, { timeBudgetMs: 200 }, now), {
    targetEnd: Number.POSITIVE_INFINITY,
    deadline: 1200,
  });
  assert.equal(createReviewUpdatePlan(0, { timeBudgetMs: 0 }, now).deadline, null);
  assert.equal(createReviewUpdatePlan(0, { timeBudgetMs: -1 }, now).deadline, null);
});

test("deadline stops only after progress has advanced and at the deadline boundary", () => {
  const now = () => 500;
  assert.equal(shouldStopReviewUpdateForDeadline(10, 10, 500, now), false);
  assert.equal(shouldStopReviewUpdateForDeadline(11, 10, null, now), false);
  assert.equal(shouldStopReviewUpdateForDeadline(11, 10, 501, now), false);
  assert.equal(shouldStopReviewUpdateForDeadline(11, 10, 500, now), true);
});

test("review page state preserves incomplete-page precedence and end detection", () => {
  assert.equal(resolveReviewPageState(10, 11, 0, 250), "paused");
  assert.equal(resolveReviewPageState(10, 10, 249, 250), "complete");
  assert.equal(resolveReviewPageState(10, 10, 250, 250), "continue");
});
