import assert from "node:assert/strict";
import test from "node:test";
import { xGrowthMediaDataCard, type XGrowthMediaDataCardWork } from "./xGrowthMediaDataCard.ts";

const work: XGrowthMediaDataCardWork = {
  title: "<script>& Very long title for a product card that wraps across lines",
  actress: "<actress>& / second name",
  genre: null,
  ranking: null,
  discount_rate: null,
  review_average: 4.2,
  review_count: 12,
  sale_price: 500,
  price: 800,
  list_price: 1000,
  lowest_price: 500,
  is_bottom_price: true,
  is_on_sale: true,
  sale_end_at: "2026-11-02T00:00:00+09:00",
};

test("data card escapes untrusted labels and reflects a current sale and recorded low", () => {
  const now = new Date("2026-10-30T12:00:00+09:00").getTime();
  const svg = xGrowthMediaDataCard(work, now);

  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.match(svg, /&lt;actress&gt;&amp;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /現在価格/);
  assert.match(svg, /通常価格から50%OFF/);
  assert.match(svg, /記録最安と同額/);
  assert.match(svg, /セール期限/);
  assert.match(svg, /¥1,000/);
  assert.match(svg, /¥500/);
  assert.doesNotMatch(svg, /second name/);
});

test("expired sale dates fall back to the listed price and omit sale timing", () => {
  const now = new Date("2026-11-03T00:00:00+09:00").getTime();
  const svg = xGrowthMediaDataCard(work, now);

  assert.match(svg, /掲載価格/);
  assert.match(svg, /¥800/);
  assert.match(svg, /通常価格から20%OFF/);
  assert.doesNotMatch(svg, /セール期限/);
  assert.doesNotMatch(svg, /記録最安と同額/);
});

test("data card caps wrapped titles at three text lines", () => {
  const longWork = { ...work, title: "あ".repeat(100), is_on_sale: false };
  const now = new Date("2026-10-30T12:00:00+09:00").getTime();
  const svg = xGrowthMediaDataCard(longWork, now);
  const titleLines = svg.match(/<text x="82" y="(?:202|242|282)"/g) ?? [];

  assert.equal(titleLines.length, 3);
});
