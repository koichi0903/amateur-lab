import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteScanCandidateRecord } from "./myfansQuoteScanRecord";
import type { MyfansQuoteScanCandidate, MyfansQuoteScore } from "../myfansQuoteScoring";

const score: MyfansQuoteScore = { score: 82, eligible: true, reason: "eligible source" };

function input(candidate: MyfansQuoteScanCandidate, creatorRank = 2) {
  return {
    approvedMediaId: null,
    approvedProduct: { id: 41, creator_id: 19, approved_media_id: 7, title: "Approved product", creator_x_url: "https://x.com/creator" },
    candidate,
    creatorId: 19,
    creatorRank,
    creatorXUrl: "https://x.com/creator",
    productId: 41,
    result: score,
    selected: true,
    sourceXHandle: "creator",
  };
}

test("verified image records preserve media approval, selection, score, and thread identity", () => {
  const record = buildQuoteScanCandidateRecord(input({
    xPostUrl: "https://x.com/creator/status/123",
    sourceXHandle: "creator",
    mediaType: "image",
    mediaPermalink: "https://pbs.twimg.com/media/sample.jpg",
    quoteVisualReady: true,
    hasImage: true,
    text: "source text",
    myfansLinkSource: "own_reply",
    ownReplyStatusUrl: "https://x.com/creator/status/124",
    threadCollectionStatus: "COMPLETE",
    collectorMethod: "complete_thread_first_v2",
  }));

  assert.equal(record.approved_media_id, 7);
  assert.equal(record.product_id, 41);
  assert.equal(record.quote_visual_ready, true);
  assert.equal(record.visual_score, 85);
  assert.equal(record.creator_rank, 2);
  assert.equal(record.selected, true);
  assert.equal(record.parent_status_url, "https://x.com/creator/status/123");
  assert.equal(record.parent_status_id, "123");
  assert.equal(record.own_reply_status_url, "https://x.com/creator/status/124");
  assert.equal(record.myfans_link_source, "own_reply");
  assert.equal(record.thread_collection_status, "COMPLETE");
  assert.equal(record.collector_method, "complete_thread_first_v2");
  assert.equal(typeof record.source_value_score, "number");
});

test("an unverified video cannot become visual-ready or retain a creator rank", () => {
  const record = buildQuoteScanCandidateRecord(input({
    xPostUrl: "https://x.com/creator/status/456",
    sourceXHandle: "creator",
    mediaType: "video",
    mediaPermalink: "https://video.twimg.com/sample.mp4",
    verifiedVideoPermalink: "https://video.twimg.com/sample.mp4",
    validationStatus: "http_error",
    hasVideo: true,
  }, 4));

  assert.equal(record.quote_visual_ready, false);
  assert.equal(record.media_permalink_verified_at, null);
  assert.equal(record.visual_score, 25);
  assert.equal(record.creator_rank, null);
  assert.equal(record.selected, true);
});
