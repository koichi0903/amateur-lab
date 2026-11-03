import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFanzaPrices,
  parseFanzaProductId,
  parseFanzaTotalPages,
} from "./getProductIdsParsing";

test("parses FANZA list page totals and defaults missing totals to one", () => {
  assert.equal(parseFanzaTotalPages("全12ページ中"), 12);
  assert.equal(parseFanzaTotalPages("ページ情報なし"), 1);
});

test("parses a content id from the list href", () => {
  assert.equal(
    parseFanzaProductId("/content/?id=ABC-123&sort=popular"),
    "ABC-123",
  );
  assert.equal(parseFanzaProductId("/content/?sort=popular"), null);
});

test("parses normal, sale, and missing list prices", () => {
  assert.deepEqual(parseFanzaPrices("1,980円"), {
    listPrice: 1980,
    salePrice: null,
  });
  assert.deepEqual(parseFanzaPrices("通常価格 1,980円 セール 990円"), {
    listPrice: 1980,
    salePrice: 990,
  });
  assert.deepEqual(parseFanzaPrices("価格情報なし"), {
    listPrice: null,
    salePrice: null,
  });
});
