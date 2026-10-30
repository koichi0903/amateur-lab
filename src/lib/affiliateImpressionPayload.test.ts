import assert from "node:assert/strict";
import test from "node:test";
import { parseAffiliateImpressionPayload } from "./affiliateImpressionPayload";

test("parseAffiliateImpressionPayload normalizes accepted impression fields", () => {
  assert.deepEqual(parseAffiliateImpressionPayload({
    workId: "52",
    placement: "mobile-sticky",
    sourcePage: "ranking",
    ctaVariant: "price-focus",
    xPostKey: ` ${"x".repeat(125)} `,
  }), {
    workId: 52,
    placement: "mobile-sticky",
    sourcePage: "ranking",
    ctaVariant: "price-focus",
    xPostKey: "x".repeat(120),
  });
});

test("parseAffiliateImpressionPayload keeps defaults and rejects other placements", () => {
  assert.deepEqual(parseAffiliateImpressionPayload({
    workId: 52,
    placement: "detail-sidebar",
    sourcePage: 99,
    ctaVariant: "other",
    xPostKey: "   ",
  }), {
    workId: 52,
    placement: "detail-sidebar",
    sourcePage: "direct",
    ctaVariant: "control",
    xPostKey: null,
  });
  assert.equal(parseAffiliateImpressionPayload({ workId: 52, placement: "listing-card" }), null);
  assert.equal(parseAffiliateImpressionPayload({ workId: 0, placement: "detail-sidebar" }), null);
  assert.equal(parseAffiliateImpressionPayload(null), null);
});
