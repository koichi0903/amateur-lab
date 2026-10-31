import assert from "node:assert/strict";
import test from "node:test";
import { parseAmateurAffiliateClickPayload } from "./amateurAffiliateClickPayload";

test("parseAmateurAffiliateClickPayload trims a valid content ID", () => {
  assert.deepEqual(parseAmateurAffiliateClickPayload({
    contentId: " abcd00123 ",
    sourcePage: "amateur_detail",
    placement: "detail-sidebar",
  }), {
    contentId: "abcd00123",
    sourcePage: "amateur_detail",
    placement: "detail-sidebar",
  });
});

test("parseAmateurAffiliateClickPayload accepts listing events", () => {
  assert.deepEqual(parseAmateurAffiliateClickPayload({
    contentId: "abcd00123",
    sourcePage: "amateur",
    placement: "listing-card",
  }), {
    contentId: "abcd00123",
    sourcePage: "amateur",
    placement: "listing-card",
  });
});

test("parseAmateurAffiliateClickPayload rejects non-object payloads", () => {
  assert.equal(parseAmateurAffiliateClickPayload(null), null);
  assert.equal(parseAmateurAffiliateClickPayload(undefined), null);
  assert.equal(parseAmateurAffiliateClickPayload("abcd00123"), null);
  assert.equal(parseAmateurAffiliateClickPayload([]), null);
});

test("parseAmateurAffiliateClickPayload rejects missing or malformed content IDs", () => {
  assert.equal(parseAmateurAffiliateClickPayload({ sourcePage: "amateur", placement: "listing-card" }), null);
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "   ", sourcePage: "amateur", placement: "listing-card" }), null);
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "../works", sourcePage: "amateur", placement: "listing-card" }), null);
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "a".repeat(121), sourcePage: "amateur", placement: "listing-card" }), null);
});

test("parseAmateurAffiliateClickPayload rejects unknown source pages and placements", () => {
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "abcd00123", sourcePage: "x", placement: "listing-card" }), null);
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "abcd00123", sourcePage: "amateur", placement: "detail" }), null);
  assert.equal(parseAmateurAffiliateClickPayload({ contentId: "abcd00123", sourcePage: 1, placement: "listing-card" }), null);
});
