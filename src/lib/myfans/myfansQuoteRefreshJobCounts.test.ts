import assert from "node:assert/strict";
import test from "node:test";
import { summarizeMyfansQuoteRefreshJobItems } from "./myfansQuoteRefreshJobCounts.ts";

test("quote refresh job counters aggregate terminal, collection, and pending states", () => {
  assert.deepEqual(summarizeMyfansQuoteRefreshJobItems([
    { status: "success", collected_count: 3, collection_state: "COMPLETE" },
    { status: "failed", collected_count: 0, collection_state: "TEMP_ERROR" },
    { status: "skipped", collected_count: "1", collection_state: "PRIVATE" },
    { status: "running", collected_count: null, collection_state: "NO_MATCH_THIS_RUN" },
    { status: "pending", collection_state: "NO_POSTS" },
    { status: "pending", collection_state: "THREAD_INCOMPLETE" },
  ]), {
    processed: 3,
    success: 1,
    failed: 1,
    completeThreadsFound: 2,
    noMatch: 1,
    excludedNoPosts: 1,
    excludedPrivate: 1,
    retryableErrors: 2,
    candidatesSaved: 4,
    runningItems: true,
    pendingItems: true,
  });
});
