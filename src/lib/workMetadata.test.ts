import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkMetaDescription } from "./workMetadata.ts";

test("作品のmeta descriptionを簡潔にし、実データがある項目だけを含める", () => {
  const description = buildWorkMetaDescription({
    title: "作品タイトル",
    price: 500,
    sale_price: 315,
    review_average: 4.92,
    review_count: 12,
  });

  assert.match(description, /現在価格は315円/);
  assert.match(description, /レビュー平均4.9（12件）/);
  assert.ok(Array.from(description).length <= 160);
});

test("非常に長い作品名は文字化けさせず、説明文の長さを制御する", () => {
  const description = buildWorkMetaDescription({
    title: "😀長い作品タイトル".repeat(100),
    price: 0,
    sale_price: null,
    review_average: null,
    review_count: 0,
  });

  assert.ok(Array.from(description).length <= 160);
  assert.match(description, /…のFANZA価格情報/);
  assert.doesNotMatch(description, /現在価格は/);
  assert.doesNotMatch(description, /レビュー/);
});
