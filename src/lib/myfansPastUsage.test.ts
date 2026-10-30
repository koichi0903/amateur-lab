import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { buildMyfansPastUsageIndex } from "@/lib/myfansPastUsage";

test("past usage index resolves normalized posted sources and only selected historical options", () => {
  const quote = {
    id: 42,
    creator_id: 10,
    x_post_url: "https://x.com/creator/status/42",
  } as MyfansQuoteCandidate;
  const analytics = {
    quoteCandidates: [quote],
    products: [{ id: 7, creator_id: 10 }],
    posts: [
      {
        id: 1,
        product_id: 7,
        post_type: "discovery_interest",
        creative_strategy: "quote_post",
        status: "posted",
        body: "同じ引用本文",
        quote_x_url: "https://twitter.com/creator/status/42?ref=home",
        source_x_url: "",
        posted_at: "2026-10-20T12:00:00Z",
      },
    ],
    dailyPlans: [
      {
        plan_date: "2026-10-25",
        strategy_json: {
          daily_option_selection: { "1": "B" },
          candidate_options: [
            {
              post_order: 1,
              candidates: [
                { option_label: "A", quote_x_url: "https://x.com/other/status/9", body: "未選択" },
                { option_label: "B", quote_x_url: "https://x.com/creator/status/42", product_id: 7, body: "同じ引用本文" },
              ],
            },
          ],
        },
      },
    ],
  } as unknown as MyfansAnalytics;
  const normalizeSourceUrl = (value: string | null | undefined) =>
    String(value ?? "").trim().replace("https://twitter.com", "https://x.com").replace(/\?.*$/, "").replace(/\/$/, "");
  const normalizeBodyFingerprint = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, "").toLowerCase();
  const index = buildMyfansPastUsageIndex(analytics, "2026-10-27", {
    normalizeSourceUrl,
    normalizeBodyFingerprint,
    quoteUrlFromCandidate: (candidate) => candidate.x_post_url,
    creatorKeyFromQuote: (candidate) => `creator:${candidate.creator_id}`,
    creatorKeyFromProduct: (product) => `creator:${product.creator_id}`,
    topicSemanticKeyFor: (_product, candidate) => `quote-event:creator:${candidate.id}`,
    semanticTopicSimilarity: (left, right) => left === right ? 1 : 0,
  });

  assert.equal(index.latestSource("https://x.com/creator/status/42")?.date, "2026-10-25");
  assert.equal(index.latestCreator("creator:10")?.date, "2026-10-25");
  assert.equal(index.latestTopic("no-exact-id", "quote-event:creator:42")?.date, "2026-10-25");
  assert.equal(index.latestBody("同じ 引用本文")?.date, "2026-10-25");
  assert.equal(index.latestSource("https://x.com/other/status/9"), null);
  assert.equal(index.records.length, 2);
});
