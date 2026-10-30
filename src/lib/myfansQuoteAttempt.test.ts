import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "./myfansAnalytics";
import { selectMyfansQuoteForAttempt, type MyfansQuoteAttemptContext } from "./myfansQuoteAttempt";

function quote(overrides: Partial<MyfansQuoteCandidate> = {}): MyfansQuoteCandidate {
  return {
    id: 1,
    approved_media_id: 7,
    creator_id: 11,
    product_id: 7,
    creator_x_url: "https://x.com/creator",
    source_x_handle: "creator",
    x_post_url: "https://x.com/creator/status/1",
    posted_at: null,
    text_excerpt: "",
    views: 1_000,
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
    score: 70,
    score_reason: "test",
    selected: false,
    last_used_at: null,
    ...overrides,
  };
}

const product = { id: 7, creator_id: 11, creator_x_url: "https://x.com/creator" } as MyfansProduct;

function context(options: {
  quotes?: MyfansQuoteCandidate[];
  slotQuotes?: Array<[string, MyfansQuoteCandidate]>;
  exactQuotes?: MyfansQuoteCandidate[];
  poolQuotes?: MyfansQuoteCandidate[];
  acceptedCreators?: string[];
  linkageEvidence?: Array<{ product_id: number; source_status_url: string }>;
  latestSource?: (source: string) => { actualPosted: boolean; date: string } | null;
  latestTopic?: (topicIdentity: string, semanticKey: string) => { actualPosted: boolean; date: string } | null;
} = {}): MyfansQuoteAttemptContext {
  return {
    analytics: { quoteCandidates: options.quotes ?? [] } as unknown as MyfansAnalytics,
    productionLinkageEvidence: (options.linkageEvidence ?? []) as unknown as MyfansAnalytics["productLinkageEvidence"],
    resolverExactQuotes: options.exactQuotes ?? [],
    quoteBySlot: new Map(options.slotQuotes ?? []),
    quotePool: { global: (options.poolQuotes ?? []).map((candidate) => ({ candidate })) } as unknown as MyfansQuoteAttemptContext["quotePool"],
    acceptedQuoteCreators: new Set(options.acceptedCreators ?? []),
    pastUsage: {
      latestSource: options.latestSource ?? (() => null),
      latestTopic: options.latestTopic ?? (() => null),
    } as unknown as MyfansQuoteAttemptContext["pastUsage"],
    planDate: "2026-10-29",
  };
}

test("slot quote remains first choice and unsupported post types are rejected", () => {
  const direct = quote();
  const attemptContext = context({ slotQuotes: [["ranking_note:0", direct]] });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, attemptContext), direct);
  assert.equal(selectMyfansQuoteForAttempt(product, "unknown", 0, 0, attemptContext), null);
});

test("discovery can use its slot quote while other roles require a product match", () => {
  const otherProductQuote = quote({ id: 2, product_id: 99, creator_id: 99, creator_x_url: "https://x.com/other" });

  assert.equal(selectMyfansQuoteForAttempt(product, "discovery_interest", 0, 0, context({ slotQuotes: [["discovery_interest:0", otherProductQuote]] })), otherProductQuote);
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, context({ slotQuotes: [["ranking_note:0", otherProductQuote]] })), null);
});

test("exact resolver quote matches normalized linkage source URLs", () => {
  const exact = quote({ id: 3, x_post_url: "https://x.com/creator/status/3" });
  const attemptContext = context({
    exactQuotes: [exact],
    linkageEvidence: [{ product_id: 7, source_status_url: "https://twitter.com/creator/status/3?ref=linkage" }],
  });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, attemptContext), exact);
});

test("recently used sources stay excluded by the selected-source cooldown", () => {
  const direct = quote();
  const attemptContext = context({
    slotQuotes: [["ranking_note:0", direct]],
    latestSource: () => ({ actualPosted: false, date: "2026-10-28" }),
  });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, attemptContext), null);
});

test("posted sources use a seven-day cooldown while selected sources use three days", () => {
  const direct = quote();
  const slotQuotes: Array<[string, MyfansQuoteCandidate]> = [["ranking_note:0", direct]];
  const postedAtSixDays = context({ slotQuotes, latestSource: () => ({ actualPosted: true, date: "2026-10-23" }) });
  const postedAtSevenDays = context({ slotQuotes, latestSource: () => ({ actualPosted: true, date: "2026-10-22" }) });
  const selectedAtTwoDays = context({ slotQuotes, latestSource: () => ({ actualPosted: false, date: "2026-10-27" }) });
  const selectedAtThreeDays = context({ slotQuotes, latestSource: () => ({ actualPosted: false, date: "2026-10-26" }) });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, postedAtSixDays), null);
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, postedAtSevenDays), direct);
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, selectedAtTwoDays), null);
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, selectedAtThreeDays), direct);
});

test("topic reuse observes the three-day cooldown boundary", () => {
  const direct = quote();
  const slotQuotes: Array<[string, MyfansQuoteCandidate]> = [["ranking_note:0", direct]];
  const topicAtTwoDays = context({ slotQuotes, latestTopic: () => ({ actualPosted: false, date: "2026-10-27" }) });
  const topicAtThreeDays = context({ slotQuotes, latestTopic: () => ({ actualPosted: false, date: "2026-10-26" }) });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, topicAtTwoDays), null);
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 0, topicAtThreeDays), direct);
});

test("direct product fallback still picks the most-viewed eligible quote", () => {
  const lower = quote({ id: 4, views: 60_000, has_video: true });
  const higher = quote({ id: 5, views: 120_000, has_video: true });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 1, context({ quotes: [lower, higher] })), higher);
});

test("product-scoped pool quote wins before creator-wide rotation", () => {
  const creatorWide = quote({ id: 6, product_id: null, has_video: true });
  const productSpecific = quote({ id: 7, has_video: true });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 1, context({ poolQuotes: [creatorWide, productSpecific] })), productSpecific);
});

test("creator-wide pool rotates by attempt and slot index", () => {
  const first = quote({ id: 8, product_id: null, has_video: true });
  const second = quote({ id: 9, product_id: null, has_video: true });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 1, context({ poolQuotes: [first, second] })), second);
});

test("verified backup stays available after early attempts and respects accepted creators", () => {
  const lowerScore = quote({ id: 10, creator_id: 12, creator_x_url: "https://x.com/other", score: 65, views: 10_000, has_video: true });
  const higherScore = quote({ id: 11, score: 90, views: 10_000, has_video: true });
  const attemptContext = context({ quotes: [lowerScore, higherScore] });

  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 2, attemptContext), higherScore);
  attemptContext.acceptedQuoteCreators.add("creator:11");
  assert.equal(selectMyfansQuoteForAttempt(product, "ranking_note", 0, 2, attemptContext), lowerScore);
});
