import assert from "node:assert/strict";
import test from "node:test";
import { isEntityIndexable } from "./entityIndexQuality.ts";

const qualityEntity = {
  name: "テスト",
  count: 10,
  maxScore: 80,
  imageUrl: "https://example.com/image.jpg",
};

test("作品数と代表情報が揃うカテゴリをインデックス対象にする", () => {
  assert.equal(isEntityIndexable("actress", qualityEntity), true);
  assert.equal(
    isEntityIndexable("maker", { ...qualityEntity, count: 5, maxScore: 50 }),
    true,
  );
});

test("薄いカテゴリページをインデックス対象外にする", () => {
  for (const summary of [
    { ...qualityEntity, count: 9 },
    { ...qualityEntity, maxScore: 59 },
    { ...qualityEntity, imageUrl: null },
  ]) {
    assert.equal(isEntityIndexable("actress", summary), false);
  }
});
