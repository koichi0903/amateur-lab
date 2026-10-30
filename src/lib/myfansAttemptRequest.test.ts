import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct, MyfansQuoteCandidate } from "./myfansAnalytics";
import { fallbackMyfansPostTypes, resolveMyfansAttemptRequest, resolveMyfansPostingRoute } from "./myfansAttemptRequest";
import type { RotationItem } from "./myfansGrowthStrategy";

function quote(id: number) {
  return { id } as MyfansQuoteCandidate;
}

function rotationItem(overrides: Partial<RotationItem> = {}): RotationItem {
  return {
    postType: "discovery_interest",
    linkStrategy: "no_link",
    objective: "impression",
    cta: "保存用の発見メモ",
    slot: "A",
    role: "ATTENTION",
    ...overrides,
  };
}

function requestContext(options: {
  resolverExactQuotes?: MyfansQuoteCandidate[];
  slotQuotes?: Array<[string, MyfansQuoteCandidate]>;
  poolQuotes?: MyfansQuoteCandidate[];
} = {}) {
  return {
    resolverExactQuotes: options.resolverExactQuotes ?? [],
    quoteBySlot: new Map(options.slotQuotes ?? []),
    growthQuotePool: (options.poolQuotes ?? []).map((candidate) => ({ candidate })),
  };
}

test("fallback post type order remains stable for each starting role", () => {
  assert.deepEqual(fallbackMyfansPostTypes("profile_cta"), ["profile_cta", "ranking_note", "comparison_review", "discovery_interest"]);
  assert.deepEqual(fallbackMyfansPostTypes("ranking_note"), ["ranking_note", "profile_cta", "comparison_review", "discovery_interest"]);
  assert.deepEqual(fallbackMyfansPostTypes("discovery_interest"), ["discovery_interest", "ranking_note", "profile_cta", "comparison_review"]);
  assert.deepEqual(fallbackMyfansPostTypes("reply_link_sales"), ["reply_link_sales", "profile_cta", "ranking_note", "comparison_review", "discovery_interest"]);
  assert.deepEqual(fallbackMyfansPostTypes("body_link_sales"), ["body_link_sales", "profile_cta", "ranking_note", "comparison_review", "discovery_interest"]);
  assert.deepEqual(fallbackMyfansPostTypes("custom_post"), ["custom_post", "ranking_note", "profile_cta", "comparison_review", "discovery_interest"]);
});

test("discovery quote priority stays forced, resolver, slot, then rotating pool", () => {
  const forced = quote(1);
  const resolver = quote(2);
  const slot = quote(3);
  const pool = [quote(4), quote(5), quote(6)];
  const item = rotationItem();
  const context = requestContext({
    resolverExactQuotes: [resolver],
    slotQuotes: [["discovery_interest:0", slot]],
    poolQuotes: pool,
  });

  assert.equal(resolveMyfansAttemptRequest(context, item, 0, 0, forced).directGrowthQuote, forced);
  assert.equal(resolveMyfansAttemptRequest(context, item, 0, 0, null).directGrowthQuote, resolver);
  assert.equal(resolveMyfansAttemptRequest(requestContext({ slotQuotes: [["discovery_interest:0", slot]], poolQuotes: pool }), item, 0, 0, null).directGrowthQuote, slot);
  assert.equal(resolveMyfansAttemptRequest(requestContext({ poolQuotes: pool }), item, 1, 4, null).directGrowthQuote, pool[2]);
  assert.equal(resolveMyfansAttemptRequest(context, item, 0, 1, null).directGrowthQuote, null);
});

test("revenue link attempts require a revenue target and fall back without a direct growth quote", () => {
  const candidate = quote(7);
  const item = rotationItem({ postType: "reply_link_sales", linkStrategy: "reply_link", objective: "conversion", role: "REVENUE" });
  const request = resolveMyfansAttemptRequest(requestContext({ poolQuotes: [candidate] }), item, 0, 0, candidate);

  assert.equal(request.requestedPostType, "reply_link_sales");
  assert.equal(request.requestedLinkStrategy, "reply_link");
  assert.equal(request.needsAffiliateUrl, true);
  assert.equal(request.directGrowthQuote, null);

  assert.deepEqual(resolveMyfansPostingRoute({
    item,
    product: null,
    needsAffiliateUrl: request.needsAffiliateUrl,
    requestedPostType: request.requestedPostType,
    requestedLinkStrategy: request.requestedLinkStrategy,
  }), {
    hasRevenueTarget: false,
    linkStrategy: "no_link",
    objective: "impression",
    postType: "discovery_interest",
    cta: "保存用の発見メモ",
    role: "REVENUE / myfans送客先不足のためリンクなし運用",
  });
});

test("a valid revenue target keeps the requested route and labels fallback post types", () => {
  const item = rotationItem({ postType: "reply_link_sales", linkStrategy: "reply_link", objective: "conversion", cta: "購入はこちら", role: "REVENUE" });
  const product = { product_url: "https://myfans.jp/users/42", price: 1000 } as MyfansProduct;

  assert.deepEqual(resolveMyfansPostingRoute({
    item,
    product,
    needsAffiliateUrl: true,
    requestedPostType: "profile_cta",
    requestedLinkStrategy: "profile_cta",
  }), {
    hasRevenueTarget: true,
    linkStrategy: "profile_cta",
    objective: "conversion",
    postType: "profile_cta",
    cta: "購入はこちら",
    role: "REVENUE / reply_link_salesからprofile_ctaへRecovery",
  });
});
