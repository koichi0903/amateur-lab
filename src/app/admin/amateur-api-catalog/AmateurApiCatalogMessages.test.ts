import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogRunStepEffects,
  completedRunMessage,
  runningRunMessage,
  type CatalogRunProgress,
} from "./AmateurApiCatalogMessages.ts";

const baseRun: CatalogRunProgress = {
  fetched_item_count: 1234,
  rank_fetched_item_count: 4500,
  rank_next_offset: 0,
  rank_snapshot_at: null,
  current_range: { fromDate: "2026-01-01", toDate: "2026-01-31" },
  completed_range_count: 2,
  range_count: 4,
};

test("weekly completion includes the saved ranking snapshot", () => {
  const message = completedRunMessage("週次・全作品API補完", "weekly_full", {
    ...baseRun,
    rank_fetched_item_count: 5000,
    rank_snapshot_at: "2026-10-30T10:00:00.000Z",
  });

  assert.match(message, /^週次・全作品API補完が完了しました。1,234件を処理しました。人気順位5,000件も（.+時点）保存しました。$/);
});

test("legacy daily completion does not claim a ranking snapshot", () => {
  const message = completedRunMessage("旧・日次新作補完（履歴）", "daily_incremental", baseRun);

  assert.equal(message, "旧・日次新作補完（履歴）が完了しました。1,234件を処理しました。");
});

test("ranking progress uses the ranking-specific counter and limit", () => {
  const message = runningRunMessage("週次・全作品API補完", {
    ...baseRun,
    rank_next_offset: 2500,
  });

  assert.equal(message, "週次・全作品API補完：人気順の順位を取得中 4,500 / 5,000件");
});

test("range progress preserves the current range and completed range counts", () => {
  assert.equal(
    runningRunMessage("週次・全作品API補完", baseRun),
    "週次・全作品API補完：1,234件処理 · 期間 2026-01-01〜2026-01-31 · 2 / 4範囲完了",
  );
});

test("range preparation message is used when no current range is recorded", () => {
  assert.equal(
    runningRunMessage("週次・全作品API補完", { ...baseRun, current_range: null }),
    "週次・全作品API補完：1,234件処理 · 期間 次の期間を準備中 · 2 / 4範囲完了",
  );
});

test("completed run refreshes works and reports the completion message", () => {
  const effects = catalogRunStepEffects(
    { ...baseRun, status: "completed", last_error: null },
    "週次・全作品API補完",
    "weekly_full",
    1,
  );

  assert.equal(effects.message, "週次・全作品API補完が完了しました。1,234件を処理しました。人気順位4,500件も保存しました。");
  assert.equal(effects.refreshWorks, true);
  assert.equal(effects.wait, false);
});

test("attention run keeps its server error and does not wait", () => {
  const effects = catalogRunStepEffects(
    { ...baseRun, status: "needs_attention", last_error: "範囲を分割できません" },
    "週次・全作品API補完",
    "weekly_full",
    1,
  );

  assert.deepEqual(effects, { message: "範囲を分割できません", refreshWorks: false, wait: false });
});

test("running run refresh cadence stays every ten steps and keeps the one-second delay", () => {
  const everyTenthStep = catalogRunStepEffects(
    { ...baseRun, status: "running", last_error: null },
    "週次・全作品API補完",
    "weekly_full",
    10,
  );
  const otherStep = catalogRunStepEffects(
    { ...baseRun, status: "running", last_error: null },
    "週次・全作品API補完",
    "weekly_full",
    9,
  );

  assert.equal(everyTenthStep.message, runningRunMessage("週次・全作品API補完", baseRun));
  assert.deepEqual(everyTenthStep, { message: runningRunMessage("週次・全作品API補完", baseRun), refreshWorks: true, wait: true });
  assert.deepEqual(otherStep, { message: runningRunMessage("週次・全作品API補完", baseRun), refreshWorks: false, wait: true });
});

test("missing and terminal failed runs have no step side effects", () => {
  const missing = catalogRunStepEffects(null, "週次・全作品API補完", "weekly_full", 1);
  const failed = catalogRunStepEffects(
    { ...baseRun, status: "failed", last_error: "failed" },
    "週次・全作品API補完",
    "weekly_full",
    1,
  );

  assert.deepEqual(missing, { message: null, refreshWorks: false, wait: false });
  assert.deepEqual(failed, { message: null, refreshWorks: false, wait: false });
});
