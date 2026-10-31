import assert from "node:assert/strict";
import test from "node:test";
import { parseFavoriteWorkIds } from "./favoriteWorkIds.ts";

test("returns only unique positive integer IDs from a request body", () => {
  assert.deepEqual(parseFavoriteWorkIds({ ids: [4, 4, 0, -1, 2.5, "7", 9] }), [4, 9]);
});

test("returns an empty list when the request body has no ID array", () => {
  assert.deepEqual(parseFavoriteWorkIds(null), []);
  assert.deepEqual(parseFavoriteWorkIds({}), []);
  assert.deepEqual(parseFavoriteWorkIds({ ids: "4,9" }), []);
});

test("keeps the first 200 unique IDs", () => {
  const ids = Array.from({ length: 205 }, (_, index) => index + 1);
  assert.deepEqual(parseFavoriteWorkIds({ ids }), ids.slice(0, 200));
});
