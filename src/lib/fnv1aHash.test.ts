import assert from "node:assert/strict";
import test from "node:test";
import { fnv1aHash } from "./fnv1aHash";

test("fnv1aHash keeps the 32-bit FNV-1a results used by deterministic selection", () => {
  assert.equal(fnv1aHash(""), 2166136261);
  assert.equal(fnv1aHash("hello"), 1335831723);
});
