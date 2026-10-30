import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct, MyfansQuoteCandidate } from "./myfansAnalytics";
import { publicCopyFactsFor } from "./myfansPublicCopyFacts";

const product = {
  id: 21,
  title: "作品A",
  genre: "人妻",
  price: 500,
  popularity_rank: 12,
  likes_count: 34,
  saves_count: 5,
  is_new: true,
  myfans_creators: { display_name: "作者A" },
} as unknown as MyfansProduct;

function quote(overrides: Partial<MyfansQuoteCandidate> = {}): MyfansQuoteCandidate {
  return {
    id: 31,
    text_excerpt: "  出典の短い観察文  ",
    source_x_handle: "@source",
    views: 1_200,
    likes: 80,
    reposts: 10,
    replies: 4,
    media_type: "video",
    media_permalink: "https://video.twimg.com/example.mp4",
    quote_visual_ready: true,
    visual_render_status: "browser_visible",
    visual_analysis_status: "verified",
    visual_analysis_json: {
      concrete_observation: "冒頭から後半へ表情が変わる",
      evidence_source: "https://video.twimg.com/example.mp4",
    },
    visual_analyzer_version: "test-analyzer-v1",
    x_post_url: "https://x.com/source/status/123",
    ...overrides,
  } as unknown as MyfansQuoteCandidate;
}

test("public-copy facts keep product defaults when no quote exists", () => {
  assert.deepEqual(publicCopyFactsFor(product, null), {
    sourceText: "",
    creatorName: "作者A",
    creatorHandle: "",
    publicMetrics: {
      views: null,
      likes: null,
      reposts: null,
      replies: null,
      popularityRank: 12,
      productLikes: 34,
      productSaves: 5,
      price: 500,
      isNew: true,
    },
    visualContext: "text_only",
    quoteVisualAnalysis: null,
    productFacts: { title: "作品A", genre: "人妻" },
  });
});

test("public-copy facts preserve trimmed source, quote metrics, and verified visual context", () => {
  const facts = publicCopyFactsFor(product, quote());

  assert.equal(facts.sourceText, "出典の短い観察文");
  assert.equal(facts.creatorHandle, "@source");
  assert.deepEqual(facts.publicMetrics, {
    views: 1_200,
    likes: 80,
    reposts: 10,
    replies: 4,
    popularityRank: 12,
    productLikes: 34,
    productSaves: 5,
    price: 500,
    isNew: true,
  });
  assert.equal(facts.visualContext, "video");
  assert.equal(facts.quoteVisualAnalysis?.status, "verified");
  assert.equal(facts.quoteVisualAnalysis?.analyzerVersion, "test-analyzer-v1");
  assert.deepEqual(facts.productFacts, { title: "作品A", genre: "人妻" });
});

test("a quote without visible media remains public-post context", () => {
  const facts = publicCopyFactsFor(product, quote({
    media_permalink: null,
    quote_visual_ready: false,
    visual_render_status: "unknown",
  }));

  assert.equal(facts.visualContext, "public_post");
});
