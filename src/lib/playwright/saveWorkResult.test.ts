import assert from "node:assert/strict";
import test from "node:test";
import { didSaveWorkChange } from "./saveWorkResult.ts";

test("saveWork reports changes from row, price-history, or legacy-history writes", () => {
  assert.equal(didSaveWorkChange(null, false, false), false);
  assert.equal(didSaveWorkChange([], false, false), false);
  assert.equal(didSaveWorkChange([{}], false, false), true);
  assert.equal(didSaveWorkChange(null, true, false), true);
  assert.equal(didSaveWorkChange(null, false, true), true);
});
