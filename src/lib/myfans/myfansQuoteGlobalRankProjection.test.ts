import assert from "node:assert/strict";
import test from "node:test";
import {
  projectGlobalQuoteCandidates,
  projectGlobalQuoteRankUpdates,
  type GlobalQuoteRankCandidate,
  type ScoredGlobalQuoteRankCandidate,
} from "./myfansQuoteGlobalRankProjection.ts";

const nowIso = "2026-10-31T12:00:00.000Z";
const nowMs = Date.parse(nowIso);

function candidate(overrides: Partial<GlobalQuoteRankCandidate> = {}): GlobalQuoteRankCandidate {
  return {
    id: 1,
    creator_id: 1,
    creator_x_url: "https://x.com/creator",
    score: 60,
    creator_rank: 1,
    collected_at: nowIso,
    cooldown_until: null,
    last_used_at: null,
    use_count: 0,
    is_repost: false,
    media_type: "image",
    media_permalink: "https://x.com/creator/status/1/photo/1",
    quote_visual_ready: true,
    media_permalink_validation_status: "verified_image_permalink",
    visual_score: 90,
    ...overrides,
  };
}

function scoredCandidate(globalScore: number, overrides: Partial<GlobalQuoteRankCandidate> = {}): ScoredGlobalQuoteRankCandidate {
  return { ...candidate(overrides), globalScore };
}

test("filters unavailable rows and preserves visual score and render penalties", () => {
  const rows = projectGlobalQuoteCandidates([
    candidate({ id: 1, score: 60 }),
    candidate({ id: 2, score: 100, is_repost: true }),
    candidate({ id: 3, score: 100, last_used_at: nowIso }),
    candidate({ id: 4, score: 100, cooldown_until: "2026-10-31T12:00:01.000Z" }),
    candidate({
      id: 5,
      score: 60,
      media_type: "video",
      media_permalink_validation_status: "not_rendered",
    }),
  ], nowIso, nowMs);

  assert.deepEqual(rows.map((row) => row.id), [1, 5]);
  assert.equal(rows[0].globalScore, 82);
  assert.equal(rows[1].globalScore, 58);
});

test("caps, deduplicates, and thresholds daily selections in ranked order", () => {
  const rows: ScoredGlobalQuoteRankCandidate[] = [
    scoredCandidate(50, { id: 1, creator_id: null, creator_x_url: "https://x.com/ONE" }),
    scoredCandidate(120, { id: 2, creator_id: null, creator_x_url: "https://x.com/one" }),
    scoredCandidate(77, { id: 3, creator_id: 3 }),
    scoredCandidate(78, { id: 4, creator_id: 4 }),
    scoredCandidate(120, { id: 5, creator_id: 5 }),
    scoredCandidate(200, { id: 6, creator_id: 6, media_type: "video", media_permalink_validation_status: "pending" }),
  ];

  assert.deepEqual(projectGlobalQuoteRankUpdates(rows), [
    { id: 1, global_score: 50, global_rank: 1, selected_for_today: true },
    { id: 2, global_score: 120, global_rank: 2, selected_for_today: false },
    { id: 3, global_score: 77, global_rank: 3, selected_for_today: false },
    { id: 4, global_score: 78, global_rank: 4, selected_for_today: true },
    { id: 5, global_score: 120, global_rank: 5, selected_for_today: false },
    { id: 6, global_score: 200, global_rank: 6, selected_for_today: false },
  ]);
});
