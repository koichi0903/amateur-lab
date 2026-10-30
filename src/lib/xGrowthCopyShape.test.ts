import assert from "node:assert/strict";
import test from "node:test";
import { judgmentShape, subjectStructure } from "./xGrowthCopyShape";

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

test("judgment shape maps hook directions before body keywords", () => {
  assert.equal(judgmentShape("価格を比べて選ぶ", "follow_up"), "conversation_open");
  assert.equal(judgmentShape("本文", "comparison"), "compare_then_choose");
  assert.equal(judgmentShape("本文", "hot_take"), "reject_obvious");
  assert.equal(judgmentShape("本文", "missed"), "reconsider");
  assert.equal(judgmentShape("本文", "social_proof"), "trust_signal");
  assert.equal(judgmentShape("本文", "surprise"), "notice_change");
});

test("judgment shape preserves ordered body keyword categories and fallback", () => {
  assert.equal(judgmentShape("見送るか見たい。気になる点を比べる"), "defer");
  assert.equal(judgmentShape("見ておきたい。気になる点を比べる"), "watch_next");
  assert.equal(judgmentShape("気になる点を比べる"), "stop_on_reaction");
  assert.equal(judgmentShape("候補を選びたい"), "choose");
  assert.equal(judgmentShape("発表日を確認"), "open_observation");
});
