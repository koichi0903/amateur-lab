import assert from "node:assert/strict";
import test from "node:test";

import { resolveListPriceToSave } from "./saveListPrice";

test("backfills a missing list price from the parsed regular price", () => {
  assert.equal(resolveListPriceToSave(undefined, null, 1200), 1200);
});

test("does not replace an existing list price", () => {
  assert.equal(resolveListPriceToSave(undefined, 1500, 1200), undefined);
});

test("keeps an explicitly supplied list price, including null", () => {
  assert.equal(resolveListPriceToSave(900, null, 1200), 900);
  assert.equal(resolveListPriceToSave(null, 1500, 1200), null);
});
