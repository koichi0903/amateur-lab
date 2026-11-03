import assert from "node:assert/strict";
import test from "node:test";
import { splitEntityNames } from "./entityNames";

test("splits, trims, and deduplicates the supported entity separators", () => {
  assert.deepEqual(splitEntityNames(" A / B／A, C、 "), ["A", "B", "C"]);
});

test("returns no names for null or separator-only values", () => {
  assert.deepEqual(splitEntityNames(null), []);
  assert.deepEqual(splitEntityNames(" / 、 , "), []);
});
