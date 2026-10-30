import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteCandidate } from "./myfansAnalytics";
import { analyzeMyfansQuoteVisual } from "./myfansVisualVerification";

function candidate(overrides: Partial<MyfansQuoteCandidate> = {}): MyfansQuoteCandidate {
  return {
    id: 1,
    approved_media_id: 1,
    creator_id: 2,
    product_id: 3,
    creator_x_url: "https://x.com/creator",
    source_x_handle: "creator",
    x_post_url: "https://x.com/creator/status/1",
    media_permalink: null,
    media_type: "none",
    media_count: null,
    quote_visual_ready: false,
    media_permalink_validation_status: null,
    posted_at: null,
    text_excerpt: "",
    views: 0,
    likes: 0,
    reposts: 0,
    replies: 0,
    bookmarks: 0,
    has_image: false,
    has_video: false,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    collected_at: "2026-10-29T00:00:00.000Z",
    score: 0,
    score_reason: "test",
    selected: false,
    ...overrides,
  };
}

test("visible video with a concrete source cue produces verified visual evidence", () => {
  const result = analyzeMyfansQuoteVisual(candidate({
    media_type: "video",
    media_permalink: "https://x.com/creator/status/1/video/1",
    media_permalink_validation_status: "verified_video_permalink",
    quote_visual_ready: true,
    media_count: 3,
    text_excerpt: "冒頭の引きから途中で表情の近い場面に切り替わる",
  }));

  assert.equal(result.status, "verified");
  assert.equal(result.visualRenderStatus, "browser_visible");
  assert.equal(result.analysis.confidence, "medium");
  assert.equal(result.analysis.evidence_source, "browser_visible_media_and_source_text");
  assert.equal(result.analysis.frame_or_image_count, 3);
  assert.ok(result.analysis.human_curiosity_cue);
  assert.equal(result.reason, "browser_visible mediaと具体的source textからvisual cueを確認");
});

test("visible image without a concrete cue stays partial with the existing fallback observation", () => {
  const result = analyzeMyfansQuoteVisual(candidate({
    media_type: "image",
    media_permalink: "https://x.com/creator/status/1/photo/1",
    media_permalink_validation_status: "",
    quote_visual_ready: true,
    media_count: 0,
    text_excerpt: "新しい紹介投稿です。",
  }));

  assert.equal(result.status, "partial");
  assert.equal(result.visualRenderStatus, "browser_visible");
  assert.equal(result.analysis.concrete_scene, "画像は見えるが、強い場面差は本文から確認できない");
  assert.equal(result.analysis.frame_or_image_count, 1);
  assert.equal(result.analysis.confidence, "low");
  assert.equal(result.analysis.evidence_source, "browser_visible_media_and_source_text");
  assert.equal(result.reason, "mediaは見えるがAttention cueが弱い/抽象");
});

test("unavailable media retains source cue text but does not claim visual verification", () => {
  const result = analyzeMyfansQuoteVisual(candidate({
    media_type: "none",
    media_permalink: null,
    media_permalink_validation_status: "unavailable",
    text_excerpt: "写真の冒頭が気になります。",
  }));

  assert.equal(result.status, "unavailable");
  assert.equal(result.visualRenderStatus, "blocked");
  assert.equal(result.analysis.evidence_source, "unavailable_or_blocked_media");
  assert.equal(result.analysis.human_curiosity_cue, "");
  assert.equal(result.reason, "mediaが見えない、または未確認");
});
