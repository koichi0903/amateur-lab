import assert from "node:assert/strict";
import test from "node:test";
import { getAmateurWorkPrice, getAmateurWorkSitemapPaths, isAmateurWorkIndexable } from "./amateurWorkIndexability.ts";

const validWork = {
  contentId: "sample001",
  isListed: true,
  missingSince: null,
  imageUrl: "https://example.test/image.jpg",
  affiliateUrl: "https://example.test/affiliate",
  price: 1,
};

test("indexes a listed amateur work when all four quality fields exist", () => {
  assert.equal(isAmateurWorkIndexable(validWork), true);
});

test("does not index missing or unlisted works, or works missing any quality field", () => {
  assert.equal(isAmateurWorkIndexable({ ...validWork, isListed: false }), false);
  assert.equal(isAmateurWorkIndexable({ ...validWork, missingSince: "2026-11-25T00:00:00Z" }), false);
  assert.equal(isAmateurWorkIndexable({ ...validWork, imageUrl: null }), false);
  assert.equal(isAmateurWorkIndexable({ ...validWork, affiliateUrl: null }), false);
  assert.equal(isAmateurWorkIndexable({ ...validWork, price: null }), false);
  assert.equal(isAmateurWorkIndexable({ ...validWork, price: 0 }), false);
});

test("builds 1000-row amateur work sitemap shards", () => {
  assert.deepEqual(getAmateurWorkSitemapPaths(1_001), [
    "/sitemaps/amateur-works-1.xml",
    "/sitemaps/amateur-works-2.xml",
  ]);
  assert.deepEqual(getAmateurWorkSitemapPaths(0), []);
  assert.deepEqual(getAmateurWorkSitemapPaths(Number.NaN), []);
});

test("reads a positive price or list price from stored price data", () => {
  assert.equal(getAmateurWorkPrice({ price: "1,200円" }), 1200);
  assert.equal(getAmateurWorkPrice({ price: 0, list_price: "800円" }), 800);
  assert.equal(getAmateurWorkPrice({ price: "無料" }), null);
});
