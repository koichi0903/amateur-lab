import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansExecutionBoard, currentPlanDate } from "./myfansXExecution";

function quote(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    approved_media_id: 1,
    creator_id: 100 + id,
    product_id: null,
    creator_x_url: `https://x.com/creator-${id}`,
    source_x_handle: `creator-${id}`,
    x_post_url: `https://x.com/creator-${id}/status/${id}`,
    media_type: "image",
    media_permalink: `https://x.com/creator-${id}/status/${id}/photo/1`,
    media_count: 1,
    quote_visual_ready: true,
    visual_render_status: "browser_visible",
    visual_analysis_status: "unavailable",
    posted_at: null,
    text_excerpt: "この動画の最初の置き方が変わるから気になる",
    views: 50_000,
    likes: 1_000,
    reposts: 10,
    replies: 10,
    bookmarks: 2,
    has_image: true,
    has_video: false,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    collected_at: new Date().toISOString(),
    score: 90,
    score_reason: "fixture",
    selected: false,
    creator_rank: 1,
    global_score: null,
    global_rank: null,
    last_used_at: null,
    use_count: 0,
    cooldown_until: null,
    selected_for_today: false,
    source_value_verdict: "PASS",
    source_value_score: 80,
    source_value_reasons: [],
    reaction_angles: [],
    source_specificity: 80,
    ...overrides,
  };
}

function analytics(quotes: Array<Record<string, unknown>>) {
  return {
    selectedMediaId: 1,
    selectedMedia: { id: 1, media_name: "@lumi_reviw", media_url: "", affiliate_media_id: "", status: "active", notes: "", created_at: "" },
    products: [],
    quoteCandidates: quotes,
    quoteCandidateSource: { dbCount: quotes.length, loadedCount: quotes.length, pageSize: 1000, loadedAll: true, latestCollectedAt: quotes[0]?.collected_at ?? null },
    posts: [],
    dailyPlans: [],
    creators: [],
    conversions: [],
    productLinkageEvidence: [],
    permanentExclusions: [],
    xAccountGrowth: {},
    auditLogs: [],
  } as never;
}

test("eligible unlinked quote sources fill slot options without creating a monetizable product", () => {
  const board = buildMyfansExecutionBoard(analytics(Array.from({ length: 12 }, (_, index) => quote(index + 1))), { planDate: "2026-09-24", operationDay: 1 });
  assert.equal(board.candidateOptions.length, 4);
  assert.ok(board.recovery.candidateOptions <= 12);
  assert.ok(board.recovery.candidateOptions > 0);
  assert.ok(board.candidateOptions.flatMap((slot) => slot.candidates).every((candidate) => candidate.product === null));
});

test("NO_CANDIDATES is not converted into a Daily option", () => {
  const board = buildMyfansExecutionBoard(analytics([]), { planDate: "2026-09-24", operationDay: 1 });
  assert.equal(board.recovery.candidateOptions, 0);
  assert.equal(board.candidateOptions.flatMap((slot) => slot.candidates).length, 0);
});

test("stale or ineligible quote sources remain excluded", () => {
  const board = buildMyfansExecutionBoard(analytics([
    quote(1, { collected_at: "2026-08-01T00:00:00.000Z" }),
    quote(2, { text_excerpt: "", source_value_verdict: "LOW_SOURCE_VALUE", score: 10, views: 0, likes: 0, has_image: false, media_type: "none", media_permalink: null }),
  ]), { planDate: "2026-09-24", operationDay: 1 });
  assert.equal(board.recovery.candidateOptions, 0);
  assert.ok(board.quotePool.funnel.rejectionReasons.some((row) => row.reason === "期限切れ(7日超)"));
  assert.ok(board.quotePool.funnel.rejectionReasons.some((row) => row.reason === "source value不通過"));
});

test("plan date uses JST at the UTC day boundary", () => {
  assert.equal(currentPlanDate(new Date("2026-09-23T15:30:00.000Z")), "2026-09-24");
  assert.equal(currentPlanDate(new Date("2026-09-24T14:59:59.000Z")), "2026-09-24");
});
