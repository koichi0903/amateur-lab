import assert from "node:assert/strict";
import test from "node:test";
import { isEntityIndexable } from "./entityIndexQuality.ts";

const qualityEntity = {
  name: "テスト",
  count: 10,
  maxScore: 80,
  imageUrl: "https://example.com/image.jpg",
};

test("作品数と画像が揃うカテゴリはスコアに関係なくインデックス対象にする", () => {
  assert.equal(isEntityIndexable("actress", qualityEntity), true);
  assert.equal(
    isEntityIndexable("actress", { ...qualityEntity, maxScore: 0 }),
    true,
  );
  assert.equal(
    isEntityIndexable("maker", { ...qualityEntity, count: 5, maxScore: 0 }),
    true,
  );
});

test("女優は1作品以上と代表画像があれば対象、0作品は対象外", () => {
  assert.equal(
    isEntityIndexable("actress", { ...qualityEntity, count: 1, maxScore: 0 }),
    true,
  );
  assert.equal(isEntityIndexable("actress", { ...qualityEntity, count: 0 }), false);
  assert.equal(
    isEntityIndexable("actress", { ...qualityEntity, count: 1, imageUrl: null }),
    false,
  );
});

test("他カテゴリの現行作品数条件を維持する", () => {
  assert.equal(isEntityIndexable("genre", { ...qualityEntity, count: 9 }), false);
  assert.equal(isEntityIndexable("genre", { ...qualityEntity, count: 10 }), true);
  assert.equal(isEntityIndexable("maker", { ...qualityEntity, count: 4 }), false);
  assert.equal(isEntityIndexable("maker", { ...qualityEntity, count: 5 }), true);
  assert.equal(isEntityIndexable("series", { ...qualityEntity, count: 4 }), false);
  assert.equal(isEntityIndexable("series", { ...qualityEntity, count: 5 }), true);
});
