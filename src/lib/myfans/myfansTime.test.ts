import assert from "node:assert/strict";
import test from "node:test";

import { daysSinceIso } from "./myfansTime.ts";

test("daysSinceIso keeps the MyFans null and non-negative age contract", () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-10-29T00:00:00.000Z");
  try {
    assert.equal(daysSinceIso(null), null);
    assert.equal(daysSinceIso("not-a-date"), null);
    assert.equal(daysSinceIso("2026-10-30T00:00:00.000Z"), 0);
    assert.equal(daysSinceIso("2026-10-28T00:00:00.000Z"), 1);
  } finally {
    Date.now = originalNow;
  }
});
