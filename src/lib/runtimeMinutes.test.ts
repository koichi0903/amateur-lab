import assert from "node:assert/strict";
import test from "node:test";

import { parseRuntimeMinutes } from "./runtimeMinutes.ts";

test("parses numeric and Japanese runtime formats", () => {
  assert.equal(parseRuntimeMinutes(89.5), 89.5);
  assert.equal(parseRuntimeMinutes("1時間29分"), 89);
  assert.equal(parseRuntimeMinutes("29分"), 29);
  assert.equal(parseRuntimeMinutes("90"), 90);
});

test("returns null for empty, invalid, or non-finite runtime values", () => {
  assert.equal(parseRuntimeMinutes(null), null);
  assert.equal(parseRuntimeMinutes(""), null);
  assert.equal(parseRuntimeMinutes("分"), null);
  assert.equal(parseRuntimeMinutes(Number.NaN), null);
});
