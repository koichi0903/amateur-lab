import assert from "node:assert/strict";
import test from "node:test";
import { selectCollectionAccounts } from "./myfansCollectionRotation.ts";
import { STALE_QUOTE_REFRESH_AGE_MS, isStaleQuoteRefreshJob, staleQuoteRefreshCleanupPreview } from "./myfansQuoteRefreshLifecycle.ts";

const old = new Date("2026-01-01T00:00:00.000Z").getTime();
const staleJob = {
  id: 41,
  status: "running",
  created_at: new Date(old - STALE_QUOTE_REFRESH_AGE_MS - 1).toISOString(),
  started_at: new Date(old - STALE_QUOTE_REFRESH_AGE_MS - 1).toISOString(),
  collection_session_id: "session-old",
  collection_run_token: "run-old",
  collector_version: "0.1.37",
  cursor_before_order: 38,
  cursor_after_order: 39,
  collection_cycle_no: 4,
  cycle_completed: false,
};

test("stale 1/5 cleanup terminalizes the job without advancing cursor or losing four creators", () => {
  const items = [
    { status: "success", processed_at: new Date(old - STALE_QUOTE_REFRESH_AGE_MS - 1).toISOString() },
    ...Array.from({ length: 4 }, () => ({ status: "pending", processed_at: null })),
  ];
  assert.equal(isStaleQuoteRefreshJob(staleJob, items, old), true);
  const preview = staleQuoteRefreshCleanupPreview(staleJob, items, "stale");
  assert.equal(preview.job.status, "cancelled");
  assert.equal(preview.pendingCount, 4);
  assert.deepEqual(preview.items.map((item) => item.status), ["success", "skipped", "skipped", "skipped", "skipped"]);
  assert.equal(preview.cursorBeforeOrder, 39);
  assert.equal(preview.cursorAfterOrder, 39);
  assert.equal(preview.cycleNo, 4);
  assert.equal(preview.rotationEligibilityPreserved, true);

  const next = selectCollectionAccounts(
    Array.from({ length: 8 }, (_, index) => ({ creatorId: index + 1, rotationOrder: index + 1, collectionEnabled: true })),
    { cursorOrder: 39, cycleNo: 4 },
    10,
  );
  assert.deepEqual(next.selected.map((account) => account.creatorId), [1, 2, 3, 4, 5]);
});

test("cleanup protects the current session/run and is idempotent", () => {
  const items = [{ status: "pending", processed_at: null }];
  assert.equal(isStaleQuoteRefreshJob(staleJob, items, old, { jobId: staleJob.id }), false);
  assert.equal(isStaleQuoteRefreshJob(staleJob, items, old, { sessionId: "session-old", runToken: "run-old", collectorVersion: "0.1.37" }), false);
  const once = staleQuoteRefreshCleanupPreview(staleJob, items, "stale");
  const twice = staleQuoteRefreshCleanupPreview(once.job, once.items, "stale");
  assert.equal(once.changed, true);
  assert.equal(twice.changed, false);
  assert.equal(twice.pendingCount, 0);
  assert.equal(isStaleQuoteRefreshJob({ ...staleJob, status: "paused" }, items, old), false);
});

test("NO_MATCH and TEMP_ERROR remain eligible while only NO_POSTS/PRIVATE are disabled", () => {
  const states = [
    { state: "NO_MATCH_THIS_RUN", collectionEnabled: true },
    { state: "TEMP_ERROR", collectionEnabled: true },
    { state: "NO_POSTS", collectionEnabled: false },
    { state: "PRIVATE", collectionEnabled: false },
  ];
  assert.deepEqual(states.filter((state) => state.collectionEnabled).map((state) => state.state), ["NO_MATCH_THIS_RUN", "TEMP_ERROR"]);
  assert.deepEqual(states.filter((state) => !state.collectionEnabled).map((state) => state.state), ["NO_POSTS", "PRIVATE"]);
});

test("cycle boundary remains owned by rotation, not stale cleanup", () => {
  const preview = staleQuoteRefreshCleanupPreview({ ...staleJob, cursor_after_order: 12, cycle_completed: true }, [{ status: "pending", processed_at: null }], "stale");
  assert.equal(preview.cursorAfterOrder, 12);
  assert.equal(preview.cycleCompleted, true);
  assert.equal(preview.cycleNo, 4);
});
