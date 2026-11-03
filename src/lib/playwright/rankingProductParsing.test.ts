import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRankingProduct,
  parseRankingProductId,
} from "./rankingProductParsing";

test("ranking product id is read from a content URL", () => {
  assert.equal(
    parseRankingProductId("/content/?id=abc123&foo=bar"),
    "abc123",
  );
  assert.equal(parseRankingProductId(null), null);
  assert.equal(parseRankingProductId("/content/without-id"), null);
});

test("ranking card prices preserve list and sale price ordering", () => {
  assert.deepEqual(buildRankingProduct("abc123", 17, "2,200円 1,650円"), {
    productId: "abc123",
    ranking: 17,
    listPrice: 2200,
    salePrice: 1650,
  });
});

test("ranking card parsing keeps one price as list price and no price as null", () => {
  assert.deepEqual(buildRankingProduct("one-price", 1, "880円"), {
    productId: "one-price",
    ranking: 1,
    listPrice: 880,
    salePrice: null,
  });
  assert.deepEqual(buildRankingProduct("no-price", 2, ""), {
    productId: "no-price",
    ranking: 2,
    listPrice: null,
    salePrice: null,
  });
});
