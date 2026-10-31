import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteScanCandidate } from "../myfansQuoteScoring";
import { scoreMyfansQuoteCandidate } from "../myfansQuoteScoring";

function candidate(overrides: Partial<MyfansQuoteScanCandidate> = {}): MyfansQuoteScanCandidate {
  return {
    xPostUrl: "https://x.com/creator/status/123",
    sourceXHandle: "creator",
    ...overrides,
  };
}

test("invalid URLs and reposts are rejected before scoring", () => {
  assert.deepEqual(scoreMyfansQuoteCandidate(candidate({ xPostUrl: "https://example.com/post" })), {
    score: 0,
    eligible: false,
    reason: "status URLを取得できませんでした。",
  });
  assert.deepEqual(scoreMyfansQuoteCandidate(candidate({ isRepost: true })), {
    score: 0,
    eligible: false,
    reason: "creator本人のオリジナル投稿ではないため除外。",
  });
});

test("candidate score preserves metric, verified-video, reply, quote, and pin contributions", () => {
  assert.deepEqual(scoreMyfansQuoteCandidate(candidate({
    views: 10_000,
    likes: 1_000,
    reposts: 100,
    replies: 50,
    isReply: true,
    isQuote: true,
    isPinned: true,
    quoteVisualReady: true,
    mediaPermalink: "https://video.twimg.com/example.mp4",
    mediaType: "video",
    validationStatus: "verified_video_permalink",
  })), {
    score: 72,
    eligible: true,
    reason: "返信投稿のため減点 / 表示10000件 / 反応: 返信50/RP100/いいね1000 / 動画media permalink取得済み / 引用投稿のため減点 / 固定投稿",
  });
});

test("a valid candidate with no scoring evidence stays ineligible", () => {
  assert.deepEqual(scoreMyfansQuoteCandidate(candidate()), {
    score: 0,
    eligible: false,
    reason: "候補不足: 客観指標が少ない",
  });
});
