import assert from "node:assert/strict";
import test from "node:test";
import { parseAffiliateClickPayload } from "./affiliateClickPayload";

test("parseAffiliateClickPayload normalizes tracking fields without changing the event contract", () => {
  const result = parseAffiliateClickPayload({
    workId: "42",
    placement: "detail-sidebar",
    sourcePage: "x",
    ctaVariant: "price-focus",
    xPostKey: ` ${"p".repeat(125)} `,
    externalAttribution: {
      channel: "social",
      source: "X/Twitter",
      landingPath: "/works/42?from=x#fragment",
    },
  });

  assert.deepEqual(result, {
    workId: 42,
    placement: "detail-sidebar",
    sourcePage: "x",
    ctaVariant: "price-focus",
    xPostKey: "p".repeat(120),
    externalAttribution: {
      channel: "social",
      source: "xtwitter",
      landingPath: "/works/42?from=x",
    },
  });
});

test("parseAffiliateClickPayload preserves existing defaults for optional tracking fields", () => {
  assert.deepEqual(parseAffiliateClickPayload({
    workId: 42,
    placement: "listing-card",
    sourcePage: 12,
    ctaVariant: "unknown",
    xPostKey: "   ",
    externalAttribution: { channel: "unknown", source: "x", landingPath: "/works/42" },
  }), {
    workId: 42,
    placement: "listing-card",
    sourcePage: "direct",
    ctaVariant: "control",
    xPostKey: null,
    externalAttribution: null,
  });
});

test("parseAffiliateClickPayload rejects invalid work IDs and placements", () => {
  assert.equal(parseAffiliateClickPayload(null), null);
  assert.equal(parseAffiliateClickPayload("not an object"), null);
  assert.equal(parseAffiliateClickPayload({ workId: Number.MAX_SAFE_INTEGER + 1, placement: "listing-card" }), null);
  assert.equal(parseAffiliateClickPayload({ workId: 0, placement: "listing-card" }), null);
  assert.equal(parseAffiliateClickPayload({ workId: 42, placement: "unknown" }), null);
});
