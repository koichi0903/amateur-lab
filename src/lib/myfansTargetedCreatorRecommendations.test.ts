import assert from "node:assert/strict";
import test from "node:test";
import { buildTargetedCreatorRecommendations, normalizeXProfileUrl } from "./myfansTargetedCreatorRecommendations";

const freshPassQuote = (creator_id: number, collected_at: string) => ({
  creator_id,
  text_excerpt: "今日は新作を紹介します",
  posted_at: collected_at,
  collected_at,
  media_type: "image" as const,
  media_permalink: `https://x.com/creator${creator_id}/status/123`,
  quote_visual_ready: true,
  visual_analysis_status: "verified" as const,
  views: 2000,
  likes: 30,
  reposts: 2,
  replies: 1,
  is_repost: false,
  is_reply: false,
  is_quote: false,
  last_used_at: null,
  cooldown_until: null,
});

test("normalizes only valid X profile URLs and legacy Twitter URLs", () => {
  assert.equal(normalizeXProfileUrl(" https://twitter.com/creator_1/ "), "https://x.com/creator_1");
  assert.equal(normalizeXProfileUrl("https://x.com/creator_1"), "https://x.com/creator_1");
  assert.equal(normalizeXProfileUrl("https://x.com/creator/status/123"), "");
  assert.equal(normalizeXProfileUrl("javascript:alert(1)"), "");
});

test("excludes creators with fresh PASS quotes and keeps the five priority candidates", () => {
  const now = Date.now();
  const old = new Date(now - 20 * 86_400_000).toISOString();
  const fresh = new Date(now - 2 * 86_400_000).toISOString();
  const input = {
    products: Array.from({ length: 6 }, (_, index) => ({ creator_id: index + 1 })),
    creators: Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      display_name: `creator-${index + 1}`,
      creator_x_url: `https://x.com/creator${index + 1}`,
    })),
    quotes: [freshPassQuote(1, fresh)],
    collectionStates: [
      { creator_id: 2, last_processed_at: old, state: "TEMP_ERROR" },
      { creator_id: 3, last_processed_at: old, state: "PRIVATE" },
      { creator_id: 4, last_processed_at: fresh, state: "THREAD_INCOMPLETE" },
      { creator_id: 5, last_processed_at: old, state: "ELIGIBLE" },
    ],
  };

  const result = buildTargetedCreatorRecommendations(input);

  assert.deepEqual(result.candidates.map(({ creatorId }) => creatorId), [6, 7, 2, 5, 4]);
  assert.equal(result.candidates[0].productCount, 1);
  assert.equal(result.candidates[0].eligible, true);
  assert.match(result.reason, /最大5件/);
});

test("returns the existing empty-candidate reason when every creator is filtered", () => {
  const result = buildTargetedCreatorRecommendations({
    products: [{ creator_id: 1 }],
    creators: [{ id: 1, display_name: "private", creator_x_url: "https://x.com/private" }],
    quotes: [freshPassQuote(1, new Date().toISOString())],
    collectionStates: [],
  });

  assert.deepEqual(result, {
    candidates: [],
    reason: "既存productにfresh source不足の対象なし",
  });
});
