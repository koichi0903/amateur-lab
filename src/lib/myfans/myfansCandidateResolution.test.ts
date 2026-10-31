import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "../myfansAnalytics";
import type { MyfansPostProductLinkageEvidence } from "../myfansProductResolver";
import { resolveMyfansCandidateProduct } from "./myfansCandidateResolution";

function product(overrides: Partial<MyfansProduct> = {}): MyfansProduct {
  return {
    id: 42,
    creator_id: 7,
    title: "作品タイトル",
    product_url: "https://myfans.jp/posts/00000000-0000-4000-8000-000000000042",
    genre: "",
    product_type: "video",
    status: "active",
    price: 1200,
    reward_rate: 0.3,
    estimated_reward: 360,
    plan_signup_reward: 0,
    recurring_reward_rate: 0,
    popularity_rank: 1,
    likes_count: 10,
    saves_count: 2,
    is_new: false,
    source_x_url: "",
    creator_x_url: "https://x.com/another_creator",
    quote_candidate_x_url: "",
    affiliate_url: "https://myfans.jp/affiliate/42",
    selection_reason: "test fixture",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function quote(overrides: Partial<MyfansQuoteCandidate> = {}): MyfansQuoteCandidate {
  return {
    id: 9,
    approved_media_id: 1,
    creator_id: 8,
    product_id: null,
    creator_x_url: "https://x.com/source_creator",
    source_x_handle: "source_creator",
    x_post_url: "https://x.com/source_creator/status/123",
    media_type: "video",
    posted_at: null,
    text_excerpt: "投稿本文",
    views: 100,
    likes: 10,
    reposts: 1,
    replies: 0,
    bookmarks: 0,
    has_image: false,
    has_video: true,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    collected_at: "2026-01-01T00:00:00.000Z",
    score: 80,
    score_reason: "test fixture",
    selected: false,
    ...overrides,
  };
}

function analytics(products: MyfansProduct[], evidence: MyfansPostProductLinkageEvidence[] = []): MyfansAnalytics {
  return {
    products,
    productLinkageEvidence: evidence,
    selectedMediaId: 1,
  } as MyfansAnalytics;
}

test("does not attach another creator's affiliate URL to an unrelated quote", () => {
  const candidate = quote();
  const unrelatedProduct = product();
  const result = resolveMyfansCandidateProduct({
    analytics: analytics([unrelatedProduct]),
    product: unrelatedProduct,
    productionLinkageEvidence: [],
    quote: candidate,
    dailyRole: "DISCOVERY",
  });

  assert.equal(result.canConnectProduct, false);
  assert.equal(result.candidateProduct, null);
  assert.equal(result.myfansTarget.affiliateUrl, "");
  assert.equal(result.monetizableStatus, "unlinked");
  assert.equal(result.candidateTitle, "@source_creator の動画");
});

test("connects the product when an exact stored quote linkage identifies it", () => {
  const candidate = quote();
  const linkedProduct = product({ creator_x_url: "https://x.com/another_creator" });
  const evidence: MyfansPostProductLinkageEvidence = {
    source_status_url: candidate.x_post_url,
    source_author_handle: candidate.source_x_handle,
    discovered_myfans_url: linkedProduct.product_url,
    final_myfans_url: linkedProduct.product_url,
    product_id: linkedProduct.id,
    resolution_method: "exact_product_url",
    confidence: "exact",
    evidence_source: "author_post",
    verified_at: "2026-01-02T00:00:00.000Z",
  };
  const result = resolveMyfansCandidateProduct({
    analytics: analytics([linkedProduct], [evidence]),
    product: null,
    productionLinkageEvidence: [evidence],
    quote: candidate,
    dailyRole: "DISCOVERY",
  });

  assert.equal(result.resolvedProduct?.id, linkedProduct.id);
  assert.equal(result.candidateProduct?.id, linkedProduct.id);
  assert.equal(result.resolverCanConnectProduct, true);
  assert.equal(result.myfansTarget.type, "none");
  assert.equal(result.myfansTarget.affiliateUrl, "");
  assert.equal(result.candidateTitle, linkedProduct.title);
});
