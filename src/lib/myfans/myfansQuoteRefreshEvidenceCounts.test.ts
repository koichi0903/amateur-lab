import assert from "node:assert/strict";
import test from "node:test";
import { summarizeMyfansQuoteRefreshEvidence } from "./myfansQuoteRefreshEvidenceCounts.ts";

test("quote refresh evidence aggregates profile and status counts", () => {
  assert.deepEqual(summarizeMyfansQuoteRefreshEvidence([
    { collection_evidence: { statusCounts: { navigationAttempted: 1, threadsObserved: 2, fullyObserved: 1, authorReplies: 1, threadLinks: 2 }, profileCounts: { articles: 3, ownPosts: 4, mediaPosts: 2 } } },
    { collection_evidence: { statusCounts: { navigationAttempted: 2, threadsObserved: 3, fullyObserved: 2, authorReplies: 0, threadLinks: 1 }, profileCounts: { articles: 0, ownPosts: 0, mediaPosts: 1 } } },
    { collection_evidence: null },
  ]), {
    status: { navigationAttempted: 3, threadsObserved: 5, fullyObserved: 3, authorReplies: 1, threadLinks: 3 },
    profile: { scanOk: 1, articles: 3, ownPosts: 4, mediaPosts: 3 },
  });
});
