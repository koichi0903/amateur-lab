import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansQuoteRefreshProgressSummary } from "./myfansQuoteRefreshProgressSummary.ts";

test("progress summary preserves job counters and evidence aggregates", () => {
  const evidenceCounts = {
    status: { navigationAttempted: 3, threadsObserved: 5, fullyObserved: 3, authorReplies: 1, threadLinks: 3 },
    profile: { scanOk: 1, articles: 3, ownPosts: 4, mediaPosts: 3 },
  };

  assert.deepEqual(buildMyfansQuoteRefreshProgressSummary({
    accounts_processed: 4,
    complete_threads_found: 2,
    candidates_saved: 6,
    no_match: 1,
    retryable_errors: 2,
    excluded_no_posts: 3,
    excluded_private: 4,
  }, { skipped: 1 }, evidenceCounts), {
    skipped: 1,
    accounts_processed: 4,
    profile_scan_ok: 1,
    status_navigation_attempted: 3,
    status_threads_observed: 5,
    complete_threads_found: 2,
    candidates_saved: 6,
    no_match: 1,
    retryable: 2,
    excluded: 7,
    profile_counts: evidenceCounts.profile,
    status_counts: evidenceCounts.status,
  });
});

test("progress summary defaults missing job values to zero", () => {
  assert.deepEqual(buildMyfansQuoteRefreshProgressSummary(null, {}, {
    status: { navigationAttempted: 0, threadsObserved: 0 },
    profile: { scanOk: 0, articles: 0, ownPosts: 0, mediaPosts: 0 },
  }), {
    accounts_processed: 0,
    profile_scan_ok: 0,
    status_navigation_attempted: 0,
    status_threads_observed: 0,
    complete_threads_found: 0,
    candidates_saved: 0,
    no_match: 0,
    retryable: 0,
    excluded: 0,
    profile_counts: { scanOk: 0, articles: 0, ownPosts: 0, mediaPosts: 0 },
    status_counts: { navigationAttempted: 0, threadsObserved: 0 },
  });
});
