import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct, MyfansQuoteCandidate } from "../myfansAnalytics";
import { discoveryInsightFor } from "./myfansCopyHelpers";

function product(overrides: Partial<MyfansProduct> = {}) {
  return {
    id: 10,
    title: "作品タイトル",
    popularity_rank: null,
    likes_count: 80,
    saves_count: 0,
    is_new: true,
    price: 0,
    ...overrides,
  } as MyfansProduct;
}

test("new-release insight still requires the new flag and the existing reaction threshold", () => {
  const insight = discoveryInsightFor(product(), null);
  assert.deepEqual(insight, {
    score: 96,
    line: "新着なのに、いいね80まで伸びている。",
    value: "新着の中で反応が先に立っている。",
  });
  assert.equal(discoveryInsightFor(product({ is_new: false }), null), null);
  assert.equal(discoveryInsightFor(product({ likes_count: 79, saves_count: 19 }), null), null);
});

test("external reaction insight preserves the view and like thresholds and wording", () => {
  const quote = { likes: 1_000, views: 50_000 } as MyfansQuoteCandidate;
  assert.deepEqual(discoveryInsightFor(product({ is_new: false, likes_count: 0 }), quote), {
    score: 91,
    line: "X側で5万表示を超えて、いいねも1,000まで出ている。",
    value: "myfans外でも引きが確認できる。",
  });
  assert.equal(discoveryInsightFor(product({ is_new: false, likes_count: 0 }), { ...quote, views: 49_999 }), null);
});
