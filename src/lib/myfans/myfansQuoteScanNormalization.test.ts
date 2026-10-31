import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteScanCollectionEvidence, normalizeQuoteScanCandidates } from "./myfansQuoteScanNormalization";
import type { MyfansQuoteScanCandidate } from "../myfansQuoteScoring";

function candidate(overrides: Partial<MyfansQuoteScanCandidate> = {}): MyfansQuoteScanCandidate {
  return {
    xPostUrl: "https://x.com/creator/status/123",
    sourceXHandle: "creator",
    ...overrides,
  };
}

test("limits collection transition evidence and normalizes missing containers", () => {
  const evidence = buildQuoteScanCollectionEvidence({
    refreshJobId: "42",
    collectionSessionId: " session ",
    stateTransitions: Array.from({ length: 82 }, (_, index) => ({ stage: String(index) })),
    profileCounts: { creator: 2 },
    collectionStatuses: undefined,
  });

  assert.equal(evidence.job_id, 42);
  assert.equal(evidence.collection_session_id, "session");
  assert.deepEqual(evidence.stateTransitions.map((transition) => transition.stage), Array.from({ length: 80 }, (_, index) => String(index + 2)));
  assert.deepEqual(evidence.profileCounts, { creator: 2 });
  assert.deepEqual(evidence.profileScan, {});
  assert.deepEqual(evidence.collectionStatuses, []);
});

test("normalizes quote scan fields while preserving valid thread and media evidence", () => {
  const [normalized] = normalizeQuoteScanCandidates([candidate({
    xPostUrl: "https://twitter.com/Creator/status/123?s=20",
    parentStatusUrl: "",
    ownReplyStatusUrl: "https://x.com/Creator/status/456?s=20",
    myfansLinkSource: "own_reply",
    threadCollectionStatus: " COMPLETE ",
    collectorMethod: " collector_v2 ",
    resolvedProductEvidence: { productId: 42 },
    mediaPermalink: "https://twitter.com/Creator/status/123/video/1?format=mp4",
    validationStatus: "verified video!",
    mediaType: "video",
    mediaCount: 2.6,
    sourceXHandle: " @Creator ",
    text: "  source   text  ",
    myfansUrls: ["https://www.myfans.jp/@creator/posts/123?from=x", "invalid"],
  })], "creator");

  assert.equal(normalized.xPostUrl, "https://x.com/Creator/status/123");
  assert.equal(normalized.parentStatusUrl, "https://x.com/Creator/status/123");
  assert.equal(normalized.ownReplyStatusUrl, "https://x.com/Creator/status/456");
  assert.equal(normalized.myfansLinkSource, "own_reply");
  assert.equal(normalized.threadCollectionStatus, "COMPLETE");
  assert.equal(normalized.collectorMethod, "collector_v2");
  assert.deepEqual(normalized.resolvedProductEvidence, { productId: 42 });
  assert.equal(normalized.mediaPermalink, "https://x.com/Creator/status/123/video/1");
  assert.equal(normalized.validationStatus, "verifiedvideo");
  assert.equal(normalized.mediaType, "video");
  assert.equal(normalized.mediaCount, 3);
  assert.equal(normalized.sourceXHandle, "Creator");
  assert.equal(normalized.text, "source text");
  assert.deepEqual(normalized.myfansUrls, ["https://www.myfans.jp/@creator/posts/123"]);
});

test("rejects candidates whose source or post URL does not match the requested account", () => {
  const normalized = normalizeQuoteScanCandidates([
    candidate(),
    candidate({ sourceXHandle: "other" }),
    candidate({ xPostUrl: "https://x.com/other/status/789" }),
  ], "creator");

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].xPostUrl, "https://x.com/creator/status/123");
});
