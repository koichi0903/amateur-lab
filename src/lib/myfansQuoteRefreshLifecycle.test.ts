import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuoteRefreshLaunch, cursorMayAdvanceForItem, isTerminalQuoteRefreshStatus, mayAutoContinueQuoteRefresh, recomputeQuoteRefreshStatus } from "./myfansQuoteRefreshLifecycle.ts";

test("cancelled, failed, stale, and old-session jobs never auto-continue", () => {
  for (const status of ["cancelled", "failed", "completed", "stale"]) {
    assert.equal(mayAutoContinueQuoteRefresh({ status, collection_session_id: "session-a" }, "session-a"), false);
  }
  assert.equal(mayAutoContinueQuoteRefresh({ status: "running", collection_session_id: "old" }, "new"), false);
});

test("only the same current-session active job may continue", () => {
  assert.equal(mayAutoContinueQuoteRefresh({ status: "running", collection_session_id: "session-a" }, "session-a"), true);
  assert.equal(mayAutoContinueQuoteRefresh({ status: "paused", collection_session_id: "session-a" }, "session-a"), true);
  assert.equal(classifyQuoteRefreshLaunch({ explicitNew: true, sameSession: false, active: false }), "new");
  assert.equal(classifyQuoteRefreshLaunch({ explicitNew: false, sameSession: true, active: true }), "resumed");
});

test("cancelled pending items do not advance the cursor", () => {
  assert.equal(cursorMayAdvanceForItem("success"), true);
  assert.equal(cursorMayAdvanceForItem("skipped"), true);
  assert.equal(cursorMayAdvanceForItem("skipped", true), false);
  assert.equal(cursorMayAdvanceForItem("running"), false);
});

test("all terminal statuses are monotonic while active statuses remain recomputable", () => {
  for (const status of ["cancelled", "failed", "completed"]) assert.equal(isTerminalQuoteRefreshStatus(status), true);
  for (const status of ["pending", "running", "paused"]) assert.equal(isTerminalQuoteRefreshStatus(status), false);
});

test("terminal monotonicity and normal active completion", () => {
  assert.equal(recomputeQuoteRefreshStatus("cancelled", false, false), "cancelled");
  assert.equal(recomputeQuoteRefreshStatus("completed", true, false), "completed");
  assert.equal(recomputeQuoteRefreshStatus("failed", false, false), "failed");
  assert.equal(recomputeQuoteRefreshStatus("running", false, false), "completed");
});
