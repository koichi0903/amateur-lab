import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorkIndexable,
  SEARCH_DEMAND_WORK_INDEX_EXCEPTION_IDS,
} from "./seoQuality.ts";

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

test("7日レンタルの安さだけでは過去最安の購入判断シグナルにしない", () => {
  assert.equal(
    isWorkIndexable({
      ...qualityWork,
      review_count: 5,
      review_average: 3.5,
      discount_rate: 0,
      is_bottom_price: true,
    }),
    false,
  );
  assert.equal(
    isWorkIndexable({
      ...qualityWork,
      review_count: 5,
      review_average: 3.5,
      discount_rate: 0,
      is_lowest_price: true,
    }),
    true,
  );
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

test("Search Consoleで需要が確認できた作品だけ、レビュー品質条件付きで例外掲載する", () => {
  const evidencedWork = {
    ...qualityWork,
    id: 39697,
    score: 51,
    review_count: 12,
    review_average: 4.92,
    price: 315,
    discount_rate: 0,
  };
  assert.equal(isWorkIndexable(evidencedWork), true);
  assert.equal(isWorkIndexable({ ...evidencedWork, id: 39698 }), false);
  assert.equal(isWorkIndexable({ ...evidencedWork, review_count: 9 }), false);
  assert.equal(isWorkIndexable({ ...evidencedWork, review_average: 4.49 }), false);
  assert.equal(isWorkIndexable({ ...evidencedWork, stage: "DISCONTINUED" }), false);
  assert.equal(isWorkIndexable({ ...evidencedWork, image_url: null }), false);
  assert.equal(isWorkIndexable({ ...evidencedWork, affiliate_url: null }), false);
});

test("検索実績とレビュー評価が確認できた作品32775は個別例外で対象にする", () => {
  assert.ok(SEARCH_DEMAND_WORK_INDEX_EXCEPTION_IDS.includes(32775));
  assert.equal(
    isWorkIndexable({
      ...qualityWork,
      id: 32775,
      score: 49,
      review_count: 3,
      review_average: 5.0,
      price: 2180,
      discount_rate: 0,
    }),
    true,
  );
});

test("作品32775の個別例外は品質条件を下回ると対象外にする", () => {
  for (const work of [
    { ...qualityWork, id: 32775, score: 48, review_count: 3, review_average: 5.0, discount_rate: 0 },
    { ...qualityWork, id: 32775, score: 49, review_count: 2, review_average: 5.0, discount_rate: 0 },
    { ...qualityWork, id: 32775, score: 49, review_count: 3, review_average: 4.99, discount_rate: 0 },
    { ...qualityWork, id: 32775, stage: "DISCONTINUED", score: 49, review_count: 3, review_average: 5.0, discount_rate: 0 },
  ]) {
    assert.equal(isWorkIndexable(work), false);
  }
});

test("低品質の作品6375は検索需要例外の対象にしない", () => {
  assert.equal(
    isWorkIndexable({
      ...qualityWork,
      id: 6375,
      score: 36,
      review_count: 0,
      review_average: 0,
      discount_rate: 0,
      is_lowest_price: false,
    }),
    false,
  );
});
