import assert from "node:assert/strict";
import test from "node:test";
import { resolveBijyoReadPageRequest } from "./bijyoReadPageRequest.ts";

test("bijyo read page selects a dedicated history or reserved page only when exclusive", () => {
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: "3", reservedPage: null, manualPage: null }), { mode: "history", page: 3 });
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: null, reservedPage: "2", manualPage: null }), { mode: "reserved", page: 2 });
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: "3", reservedPage: "2", manualPage: null }), { mode: "dashboard", historyPage: 3, reservedPage: 2 });
});

test("bijyo read page preserves manual-page priority and one-based fallback", () => {
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: "4", reservedPage: "2", manualPage: "" }), { mode: "manual", page: 1 });
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: null, reservedPage: null, manualPage: "-5" }), { mode: "manual", page: 1 });
  assert.deepEqual(resolveBijyoReadPageRequest({ historyPage: null, reservedPage: null, manualPage: null }), { mode: "dashboard", historyPage: 1, reservedPage: 1 });
});
