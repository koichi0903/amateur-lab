import test from "node:test";
import assert from "node:assert/strict";
import { AFFILIATE_PLACEMENTS, isAffiliatePlacement } from "./affiliatePlacements";

test("all declared affiliate CTA placements are accepted by click tracking", () => {
  assert.deepEqual(AFFILIATE_PLACEMENTS, [
    "listing-card",
    "detail-sidebar",
    "buy-timing-panel",
    "mobile-sticky",
    "compare-card",
    "sample-movie-fallback",
  ]);

  for (const placement of AFFILIATE_PLACEMENTS) {
    assert.equal(isAffiliatePlacement(placement), true);
  }
});

test("unknown CTA placements remain invalid", () => {
  assert.equal(isAffiliatePlacement("not-a-placement"), false);
  assert.equal(isAffiliatePlacement(null), false);
});
