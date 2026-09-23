import assert from "node:assert/strict";
import test from "node:test";
import { isWorkIndexable } from "./seoQuality.ts";

const qualityWork = {
  score: 80,
  review_count: 12,
  review_average: 4.5,
  price: 500,
  discount_rate: 50,
  image_url: "https://example.com/image.jpg",
  affiliate_url: "https://example.com/product",
};

test("掲載情報が揃った作品はインデックス対象にする", () => {
  assert.equal(isWorkIndexable(qualityWork), true);
});

test("需要シグナル、購入判断シグナル、価格、画像、紹介先が不足した作品は対象外にする", () => {
  for (const work of [
    { ...qualityWork, stage: "DISCONTINUED" },
    { ...qualityWork, score: 0 },
    { ...qualityWork, score: 59 },
    { ...qualityWork, review_count: 0 },
    { ...qualityWork, review_count: 5, review_average: 3.5, discount_rate: 0 },
    { ...qualityWork, price: 0 },
    { ...qualityWork, image_url: null },
    { ...qualityWork, affiliate_url: "  " },
  ]) {
    assert.equal(isWorkIndexable(work), false);
  }
});

test("スコアが高くても購入判断シグナルがなければ対象外にする", () => {
  assert.equal(
    isWorkIndexable({ ...qualityWork, review_count: 5, review_average: 3.5, discount_rate: 0, score: 100 }),
    false,
  );
});
