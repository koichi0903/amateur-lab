import assert from "node:assert/strict";
import test from "node:test";

import {
  assessRankingCoverage,
  buildRankingUpdate,
} from "./rankingCoverage.ts";

test("marks a full ranking snapshot as complete", () => {
  const coverage = assessRankingCoverage(3000, 3000);

  assert.equal(coverage.complete, true);
  assert.equal(coverage.acceptable, true);
});

test("accepts a high-coverage partial snapshot without calling it complete", () => {
  const coverage = assessRankingCoverage(2822, 3000);

  assert.equal(coverage.complete, false);
  assert.equal(coverage.acceptable, true);
  assert.ok(coverage.ratio > 0.94);
});

test("rejects a partial snapshot below the safety threshold", () => {
  const coverage = assessRankingCoverage(2699, 3000);

  assert.equal(coverage.complete, false);
  assert.equal(coverage.acceptable, false);
});

test("preserves a missing realtime rank when the snapshot is partial", () => {
  const update = buildRankingUpdate({
    existingRealtimeRank: 88,
    realtimeRank: undefined,
    dailyRank: undefined,
    weeklyRank: undefined,
    monthlyRank: undefined,
    realtimeComplete: false,
  });

  assert.equal("realtime_rank" in update, false);
  assert.equal("previous_realtime_rank" in update, false);
});

test("clears a missing realtime rank when the snapshot is complete", () => {
  const update = buildRankingUpdate({
    existingRealtimeRank: 88,
    realtimeRank: undefined,
    dailyRank: undefined,
    weeklyRank: undefined,
    monthlyRank: undefined,
    realtimeComplete: true,
  });

  assert.equal(update.previous_realtime_rank, 88);
  assert.equal(update.realtime_rank, null);
});
