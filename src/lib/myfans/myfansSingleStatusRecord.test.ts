import assert from "node:assert/strict";
import test from "node:test";
import { buildSingleStatusCandidateRecord } from "./myfansSingleStatusRecord";

function input(media: Record<string, unknown> = {}) {
  return {
    approvedMediaId: null,
    candidate: {
      xPostUrl: "https://x.com/creator/status/123",
      authorHandle: "creator",
      text: "source text",
      mediaType: "none",
      mediaCount: 0,
      ...media,
    } as never,
    candidateUrl: "https://x.com/creator/status/123",
    creatorId: 19,
    finalMyfansUrl: "https://myfans.jp/posts/abc",
    existingCandidate: null,
    product: { id: 41, approved_media_id: 7, creator_x_url: "https://x.com/creator" },
    productId: 41,
    productResolutionMethod: "existing_canonical_url",
    resolvedEvidence: [],
    sourceXHandle: "creator",
    text: "source text",
  };
}

test("verified images keep source, product, and visual approval in the saved record", () => {
  const result = buildSingleStatusCandidateRecord(input({
    mediaType: "image",
    mediaPermalink: "https://x.com/creator/status/123/photo/1",
    quoteVisualReady: true,
    hasImage: true,
  }));

  assert.equal(result.record.creator_id, 19);
  assert.equal(result.record.product_id, 41);
  assert.equal(result.record.approved_media_id, 7);
  assert.equal(result.record.x_post_url, "https://x.com/creator/status/123");
  assert.equal(result.record.quote_visual_ready, true);
  assert.equal(result.record.visual_score, 85);
  assert.equal(result.record.creator_rank, result.scored.eligible ? 1 : null);
  assert.equal(result.record.selected, false);
  assert.equal(result.record.text_excerpt, "source text");
});

test("unverified videos remain non-visual candidates", () => {
  const result = buildSingleStatusCandidateRecord(input({
    mediaType: "video",
    mediaPermalink: "https://x.com/creator/status/123/video/1",
    verifiedVideoPermalink: "https://x.com/creator/status/124/video/1",
    validationStatus: "http_error",
    hasVideo: true,
  }));

  assert.equal(result.quoteVisualReady, false);
  assert.equal(result.record.quote_visual_ready, false);
  assert.equal(result.record.visual_score, 0);
  assert.equal(result.record.media_permalink_validation_status, "http_error");
});
