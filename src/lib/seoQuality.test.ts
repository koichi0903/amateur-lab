import assert from "node:assert/strict";
import test from "node:test";
import { isWorkIndexable } from "./seoQuality.ts";

const qualityWork = {
  score: 80,
  price: 500,
  image_url: "https://example.com/image.jpg",
  affiliate_url: "https://example.com/product",
};

test("掲載情報が揃った作品はインデックス対象にする", () => {
  assert.equal(isWorkIndexable(qualityWork), true);
});

test("スコア、価格、画像、紹介先の不足はインデックス対象外にする", () => {
  for (const work of [
    { ...qualityWork, score: 0 },
    { ...qualityWork, price: 0 },
    { ...qualityWork, image_url: null },
    { ...qualityWork, affiliate_url: "  " },
  ]) {
    assert.equal(isWorkIndexable(work), false);
  }
});
