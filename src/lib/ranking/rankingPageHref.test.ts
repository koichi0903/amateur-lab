import assert from "node:assert/strict";
import test from "node:test";
import { buildRankingPageHref } from "./rankingPageHref.ts";

test("builds the unfiltered first ranking page without a query string", () => {
  assert.equal(buildRankingPageHref({
    type: "overall",
    targetPage: 1,
    saleOnly: false,
    sampleOnly: false,
    maxPrice: null,
  }), "/ranking");
});

test("preserves ranking type, page, and active filters in the existing order", () => {
  assert.equal(buildRankingPageHref({
    type: "actress",
    targetPage: 3,
    saleOnly: true,
    sampleOnly: true,
    maxPrice: 1200,
  }), "/ranking?type=actress&page=3&sale=1&sample=1&maxPrice=1200");
});
