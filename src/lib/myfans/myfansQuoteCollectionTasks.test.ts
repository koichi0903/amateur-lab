import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics, MyfansQuoteCandidate } from "../myfansAnalytics.ts";
import { buildMyfansQuoteCollectionTasks } from "./myfansQuoteCollectionTasks.ts";

test("quote collection tasks preserve active creator, product selection, and rank display rules", () => {
  const creator = { id: 11, display_name: "Creator A", creator_x_url: "https://x.com/creator-a", source_x_handle: "@creator-a", is_active: true };
  const quote = (id: number, rank: number, score: number, collectedAt: string) => ({
    id,
    creator_id: creator.id,
    creator_x_url: creator.creator_x_url,
    creator_rank: rank,
    score,
    score_reason: `reason-${id}`,
    x_post_url: `https://x.com/creator-a/status/${id}`,
    media_permalink: rank <= 2 ? `https://x.com/creator-a/status/${id}/photo/1` : null,
    media_type: rank <= 2 ? "image" : "none",
    quote_visual_ready: rank <= 2,
    collected_at: collectedAt,
  }) as MyfansQuoteCandidate;
  const first = quote(1, 1, 70, "2026-10-26T00:00:00Z");
  const second = quote(2, 2, 60, "2026-10-25T00:00:00Z");
  const fourth = quote(3, 4, 95, "2026-10-27T00:00:00Z");
  const selected = { candidate: first };
  const analytics = {
    creators: [
      creator,
      { ...creator, id: 12, creator_x_url: "", display_name: "No X" },
      { ...creator, id: 13, is_active: false, display_name: "Inactive" },
    ],
    products: [
      { id: 21, creator_id: creator.id, title: "Best active", status: "candidate", selection_score: 20 },
      { id: 22, creator_id: creator.id, title: "Paused", status: "paused", selection_score: 99 },
      { id: 23, creator_id: creator.id, title: "Lower active", status: "candidate", selection_score: 10 },
    ],
    quoteCandidates: [first, second, fourth],
  } as unknown as MyfansAnalytics;
  const tasks = buildMyfansQuoteCollectionTasks(analytics, {
    global: [{ candidate: first }, { candidate: second }],
    selected: [selected],
  }, {
    creatorKeyFromCreator: (value) => String(value.id),
    creatorKeyFromQuote: (value) => String(value.creator_id),
    quoteUrlFromCandidate: (value) => value.media_permalink || value.x_post_url,
    daysSinceIso: (value) => value ? 40 : null,
    addDaysIso: (value) => value ? "2026-11-09T00:00:00Z" : null,
    quoteMinScore: 55,
    quoteRefreshDays: 28,
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].productId, 21);
  assert.equal(tasks[0].productTitle, "Best active");
  assert.deepEqual(tasks[0].topCandidates.map((candidate) => candidate.rank), [1, 2]);
  assert.equal(tasks[0].collectedCount, 3);
  assert.equal(tasks[0].globalRank, 1);
  assert.equal(tasks[0].selectedForToday, true);
  assert.equal(tasks[0].nextRefreshLabel, "2026-11-09");
});
