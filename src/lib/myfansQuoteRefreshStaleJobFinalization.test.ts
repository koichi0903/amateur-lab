import assert from "node:assert/strict";
import test from "node:test";
import { staleQuoteRefreshCleanupPreview, type QuoteRefreshStaleJob } from "./myfansQuoteRefreshLifecycle";
import {
  buildStaleJobAuditMetadata,
  buildStaleJobCancellationPatch,
  buildStaleJobItemPatch,
} from "./myfansQuoteRefreshStaleJobFinalization";

const job: QuoteRefreshStaleJob = {
  id: 41,
  status: "running",
  cursor_before_order: 38,
  cursor_after_order: 39,
  collection_cycle_no: 4,
  cycle_completed: false,
  collection_session_id: "session-old",
  collection_run_token: "run-old",
  collector_version: "0.1.37",
};

test("stale job finalization audit preserves the cursor, cycle, and rotation eligibility", () => {
  const reason = "stale cleanup";
  const preview = staleQuoteRefreshCleanupPreview(job, [
    { status: "success" },
    { status: "pending" },
    { status: "running" },
  ], reason);

  assert.equal(preview.changed, true);
  assert.deepEqual(buildStaleJobAuditMetadata(job, { cursor_order: 39, cycle_no: 4 }, preview, reason), {
    reason,
    prior_status: "running",
    final_status: "cancelled",
    cursor_before_order: 39,
    cursor_after_order: 39,
    job_cursor_before_order: 38,
    job_cursor_after_order: 39,
    cursor_unchanged: true,
    cycle_no: 4,
    cycle_completed: false,
    pending_count: 2,
    rotation_eligibility_preserved: true,
    protected_run: false,
  });
});

test("stale job update patches retain terminal statuses and cancellation evidence", () => {
  const reason = "stale cleanup";
  const now = "2026-10-30T00:00:00.000Z";

  assert.deepEqual(buildStaleJobItemPatch(reason, now), {
    status: "skipped",
    error: reason,
    processed_at: now,
    finished_at: now,
    request_type: "quote_scan",
    result_code: "STALE_JOB_CANCELLED",
    http_status: 200,
    diagnostics: { rotation_eligibility_preserved: true },
    collection_state: "CANCELLED",
    collection_evidence: {
      final_collection_state: "CANCELLED",
      final_error: reason,
      rotation_eligibility_preserved: true,
    },
  });
  assert.deepEqual(buildStaleJobCancellationPatch(reason, now), {
    status: "cancelled",
    completed_at: now,
    last_error: reason,
  });
});
