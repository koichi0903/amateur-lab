import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { topicIdentityFor } from "./myfansQuotePool";

const product = {
  id: 7,
  creator_id: 5,
  creator_x_url: "https://x.com/creator",
  popularity_rank: 12,
  price: 2_500,
} as MyfansProduct;

test("quote identity takes precedence and normalizes source URLs", () => {
  assert.equal(topicIdentityFor(product, { id: 31, x_post_url: "https://X.com/Creator/status/31" } as MyfansQuoteCandidate, "creator_outlier"), "quote:31");
  assert.equal(topicIdentityFor(product, { id: 0, x_post_url: "https://X.com/Creator/status/31" } as MyfansQuoteCandidate, null), "source:https://x.com/creator/status/31");
});

test("product identities preserve reason-specific keys and fallback values", () => {
  assert.equal(topicIdentityFor(product, null, "creator_outlier"), "creator:5:creator-outlier");
  assert.equal(topicIdentityFor(product, null, "ranking_anomaly"), "product:7:ranking-anomaly:12");
  assert.equal(topicIdentityFor({ ...product, popularity_rank: null }, null, "ranking_anomaly"), "product:7:ranking-anomaly:none");
  assert.equal(topicIdentityFor(product, null, "clear_comparison"), "product:7:clear_comparison:mid");
  assert.equal(topicIdentityFor(product, null, "price_anomaly"), "product:7:price_anomaly:mid");
  assert.equal(topicIdentityFor(product, null, "visual_gap"), "product:7:visual_gap");
  assert.equal(topicIdentityFor(product, null, null), "product:7:topic");
});
