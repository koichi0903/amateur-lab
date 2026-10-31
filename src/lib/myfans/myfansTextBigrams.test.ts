import assert from "node:assert/strict";
import test from "node:test";
import { myfansTextBigrams } from "./myfansTextBigrams";

test("myfansTextBigrams returns unique overlapping two-character slices", () => {
  assert.deepEqual([...myfansTextBigrams("ababa")], ["ab", "ba"]);
  assert.deepEqual([...myfansTextBigrams("x")], ["x"]);
});
