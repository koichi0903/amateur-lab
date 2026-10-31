import assert from "node:assert/strict";
import test from "node:test";
import { decideExactProductMatch } from "./myfansExactProductMatch.ts";

test("returns not found when the exact URL has no product", () => {
  assert.deepEqual(decideExactProductMatch([], 7), { kind: "not_found" });
});

test("rejects duplicate exact URLs and products owned by another creator", () => {
  const product = { id: 1, creator_id: 7 };
  assert.deepEqual(decideExactProductMatch([product, product], 7), {
    kind: "ambiguous",
    method: "exact_canonical_url_duplicate",
  });
  assert.deepEqual(decideExactProductMatch([{ ...product, creator_id: 8 }], 7), {
    kind: "ambiguous",
    method: "exact_url_creator_conflict",
  });
});

test("allows an exact product owned by the requested creator or no creator", () => {
  const linkedProduct = { id: 1, creator_id: 7 };
  const unlinkedProduct = { id: 2, creator_id: null };
  assert.deepEqual(decideExactProductMatch([linkedProduct], 7), {
    kind: "match",
    product: linkedProduct,
  });
  assert.deepEqual(decideExactProductMatch([unlinkedProduct], 7), {
    kind: "match",
    product: unlinkedProduct,
  });
});
