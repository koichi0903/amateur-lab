import assert from "node:assert/strict";
import test from "node:test";
import { hasPublicCopyDiversityIssue } from "./myfansPublicCopyRules";

test("diversity checks keep first-line, repeated-line, and repeated-phrase precedence", () => {
  assert.equal(hasPublicCopyDiversityIssue("冒頭は同じです。\n別本文", ["冒頭は同じです。\n別の本文"]), "同じ1行目構文が続いています");
  assert.equal(hasPublicCopyDiversityIssue("別の冒頭です\nこの具体的な文章は同じです\n最後", ["違う導入です\nこの具体的な文章は同じです\n別の最後"]), "同じ文が別投稿にも出ています");
  assert.equal(hasPublicCopyDiversityIssue("今日は別の話です\n地味に強い部分がある", ["昨日の話でした\n地味に強い見せ方"]), "同じreaction phraseが別投稿にも出ています: 地味に強い");
});

test("diversity checks keep ending and metric-template comparisons", () => {
  assert.equal(hasPublicCopyDiversityIssue("共通の書き出しAB\nAAAAABBBB", ["共通の書き出しAC\nAAAAABBBB"]), "同じ語尾が続いています");
  assert.equal(hasPublicCopyDiversityIssue("abcdefA\n表示100/いいね20\n本文x", ["abcdefB\n表示200/いいね40\n本文y"]), "数字テンプレの見え方が近すぎます");
});

test("daily copy limits and no-issue results stay unchanged", () => {
  assert.equal(hasPublicCopyDiversityIssue("この動画三", ["この動画一", "この動画二"]), "「この動画」始まりは同日2回までです");
  assert.equal(hasPublicCopyDiversityIssue("投稿します。確認します。", []), "宣言文の連発が残っています");
  assert.equal(hasPublicCopyDiversityIssue("今日は晴れです。", []), "");
});
