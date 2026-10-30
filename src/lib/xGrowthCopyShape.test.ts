import assert from "node:assert/strict";
import test from "node:test";
import { subjectStructure } from "./xGrowthCopyShape";

test("subject structure keeps actress and genre ahead of keyword categories", () => {
  assert.equal(subjectStructure({ actress: "めいさん,別名", genre: "OL" }, "今日の一覧：OLのめいさん"), "actress_first");
  assert.equal(subjectStructure({ genre: "OL" }, "今日の一覧：OL作品"), "genre_first");
});

test("subject structure preserves keyword rule priority", () => {
  assert.equal(subjectStructure({}, "今日の一覧を見送り、価格も確認"), "market_first");
  assert.equal(subjectStructure({}, "似た作品を見送り、価格も確認"), "comparison_first");
  assert.equal(subjectStructure({}, "見送るか価格で判断"), "judgment_first");
  assert.equal(subjectStructure({}, "価格を比較"), "price_first");
  assert.equal(subjectStructure({}, "発売日の話"), "work_first");
});
