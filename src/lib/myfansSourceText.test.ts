import assert from "node:assert/strict";
import { extractMyfansSourceText, normalizeMyfansSourceText } from "./myfansSourceText.ts";

assert.equal(normalizeMyfansSourceText("  新作  更新\nしました。  "), "新作 更新 しました。");
assert.equal(extractMyfansSourceText("本人の新規投稿です。", "表示\n本人の新規投稿です。"), "本人の新規投稿です。");
assert.equal(extractMyfansSourceText("", "表示\nいいね\n新作を公開しました。\n返信\nhttps://x.com/example"), "新作を公開しました。");
assert.equal(extractMyfansSourceText("", "表示\nいいね\n123"), "");
