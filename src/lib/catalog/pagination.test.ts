import assert from "node:assert/strict";
import test from "node:test";
import { getPaginationItems } from "./pagination";

test("pagination links every page when the category has a small number of pages", () => {
  assert.deepEqual(getPaginationItems(11, 1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("pagination keeps the current neighborhood and both ends for large page counts", () => {
  assert.deepEqual(getPaginationItems(40, 20), [1, "ellipsis", 18, 19, 20, 21, 22, "ellipsis", 40]);
});
