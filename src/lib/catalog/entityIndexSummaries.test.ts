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

test("薄いカテゴリページをインデックス対象外にする", () => {
  for (const summary of [
    { ...qualityEntity, count: 9, maxScore: 0 },
    { ...qualityEntity, imageUrl: null },
  ]) {
    assert.equal(isEntityIndexable("actress", summary), false);
  }
});
