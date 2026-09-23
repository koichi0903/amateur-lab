import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULE_RUN_STALE_AFTER_MS,
  getEffectiveScheduleRunStatus,
  isScheduleRunStale,
} from "./scheduleRunStatus.ts";

const now = Date.parse("2026-09-23T12:00:00.000Z");

test("uses a recent heartbeat to keep a long-running schedule active", () => {
  assert.equal(
    isScheduleRunStale({
      status: "running",
      started_at: "2026-09-23T00:30:00.000Z",
      heartbeat_at: new Date(now - SCHEDULE_RUN_STALE_AFTER_MS + 1).toISOString(),
    }, now),
    false,
  );
});

test("marks an old running row stale without mutating the database", () => {
  const run = {
    status: "running" as const,
    started_at: "2026-09-23T00:30:00.000Z",
    heartbeat_at: null,
  };
  assert.equal(isScheduleRunStale(run, now), true);
  assert.equal(getEffectiveScheduleRunStatus(run, now), "stale");
  assert.equal(run.status, "running");
});

test("does not mark completed or failed rows stale", () => {
  assert.equal(isScheduleRunStale({ status: "completed", started_at: null }, now), false);
  assert.equal(isScheduleRunStale({ status: "failed", started_at: null }, now), false);
});
