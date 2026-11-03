import assert from "node:assert/strict";
import test from "node:test";
import { judgmentSourceLine } from "./xCreativeJudgment.ts";
import type { XCreativeInput } from "./xCreativeTypes.ts";

const input: XCreativeInput = {
  key: "judgment-source-test",
  title: "テスト作品",
  url: "https://example.com/work",
  category: "discovery",
  actress: "テスト女優",
  genre: "テストジャンル",
  currentPrice: 500,
  previousPrice: 1000,
  discountRate: 0,
  reviewAverage: 4.5,
  reviewCount: 10,
  ranking: 500,
  score: 50,
  discoveryScore: 50,
  buyTimingScore: 50,
  isNinetyDayLow: false,
};

test("judgment source keeps evidence precedence", () => {
  assert.equal(judgmentSourceLine({ ...input, sourceType: "JUDGMENT", reviewAverage: 4.1, discountRate: 50, xPageViews: 8 }), "値引きより、評価の低さが先に引っかかります。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "JUDGMENT", discountRate: 30 }), "値引きはありますが、価格優位だけで押すには少し弱いです。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "JUDGMENT", isNinetyDayLow: true, xPageViews: 5, xFanzaClicks: 0 }), "反応はあってもクリックに進んでいないので、今日は売り込まない判断でいいです。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "JUDGMENT", isNinetyDayLow: true }), "買う理由より、見送る理由を先に置いた方が信頼を残せます。");
});

test("judgment source preserves each source-specific line and fallback", () => {
  assert.equal(judgmentSourceLine({ ...input, sourceType: "MARKET" }), "一覧を流す前に、一回止まる理由だけ残せば十分です。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "COMPARISON" }), "安さで並べても、最後は見たい空気がある方に寄ります。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "HIDDEN_GEM", discountRate: 30 }), "セール目的じゃなくても、一度サンプルまで見てほしい。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "HIDDEN_GEM", reviewAverage: 4.6 }), "ランキングだけなら見落とすけど、評価まで見ると少し残ります。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "HIDDEN_GEM", reviewAverage: 4.5 }), "表紙より中身を先に見たい。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "ACTRESS_TREND" }), "女優目当てなら、タイトルより中身を先に見たい。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "ACTRESS_TREND", actress: null }), "タイトルより中身を先に見たい。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "PRICE_EVENT" }), "半額だけでなく評価も高いので、気になっていたなら今日は見ていいと思います。");
  assert.equal(judgmentSourceLine({ ...input, sourceType: "WORK" }), null);
});
