import assert from "node:assert/strict";
import test from "node:test";
import { buildPermanentExclusionSets, exclusionTargetForCandidate, isPermanentlyExcluded, manualCandidateExclusionTarget, postedExclusionTarget, productExclusionKey, quoteCandidateExclusionKey, sourceExclusionKey } from "./myfansPermanentExclusions.ts";

const exclusions = [
  { id: 1, entity_type: "product" as const, entity_key: productExclusionKey(10), product_id: 10, source_status_url: null, quote_candidate_id: null, reason: "posted" as const, context: {}, created_at: "2026-01-01" },
  { id: 2, entity_type: "source" as const, entity_key: sourceExclusionKey("https://x.com/a/status/1"), product_id: null, source_status_url: "https://x.com/a/status/1", quote_candidate_id: null, reason: "user_skipped" as const, context: {}, created_at: "2026-01-01" },
];

test("permanent exclusion blocks posted product across another source", () => {
  const sets = buildPermanentExclusionSets(exclusions);
  assert.equal(isPermanentlyExcluded({ productId: 10, quoteXUrl: "https://x.com/other/status/2", sourceXUrl: "", sets }), true);
  assert.equal(isPermanentlyExcluded({ productId: 11, quoteXUrl: "https://x.com/other/status/2", sourceXUrl: "", sets }), false);
});

test("unlinked skipped source is permanent and URL-normalized", () => {
  const sets = buildPermanentExclusionSets(exclusions);
  assert.equal(isPermanentlyExcluded({ productId: null, quoteXUrl: "https://x.com/a/status/1?x=2", sourceXUrl: "", sets }), true);
  assert.equal(isPermanentlyExcluded({ productId: null, quoteXUrl: "https://x.com/a/status/2", sourceXUrl: "", sets }), false);
});

test("selected-unposted has no exclusion target by itself", () => {
  assert.equal(exclusionTargetForCandidate({ productId: null, quoteXUrl: "", sourceXUrl: "", quoteCandidateId: 20 }), null);
});

test("posted target prefers product and otherwise preserves source", () => {
  assert.deepEqual(postedExclusionTarget({ product_id: 10, quote_x_url: "https://x.com/a/status/1", source_x_url: "" })?.entityType, "product");
  assert.deepEqual(postedExclusionTarget({ product_id: null, quote_x_url: "", source_x_url: "https://x.com/a/status/1" })?.entityType, "source");
});

test("manual rejection is source-scoped even when a product is linked", () => {
  const target = manualCandidateExclusionTarget({ quoteXUrl: "https://x.com/a/status/1", quoteCandidateId: 22 });
  assert.equal(target?.entityType, "source");
  assert.equal(target?.productId, null);
  assert.equal(target?.entityKey, sourceExclusionKey("https://x.com/a/status/1"));
});

test("manual rejection can fall back to the quote candidate identity", () => {
  const target = manualCandidateExclusionTarget({ quoteCandidateId: 22 });
  assert.equal(target?.entityKey, quoteCandidateExclusionKey(22));
  const sets = buildPermanentExclusionSets([{ ...exclusions[0], id: 3, entity_type: "source", entity_key: quoteCandidateExclusionKey(22), product_id: null, quote_candidate_id: 22 }]);
  assert.equal(isPermanentlyExcluded({ productId: 10, quoteCandidateId: 22, quoteXUrl: "", sourceXUrl: "", sets }), true);
});
