import assert from "node:assert/strict";
import test from "node:test";
import { getPriceSeries, getPriceSeriesSummary, priceSeriesKey } from "./createChartData.ts";
import { buildWorkDetailPriceFacts } from "./workDetailPriceFacts.ts";

const history = [
  {
    id: 1,
    changed_at: "2026-10-28T12:00:00+09:00",
    display_name: "HD",
    type: "download",
    period: null,
    normal_price: 500,
    sale_price: 300,
    price_kind: "sale" as const,
  },
];

test("代表価格・割引・選択中系列の最安値を画面文言へ反映する", () => {
  const series = getPriceSeries(history)[0];
  const summary = getPriceSeriesSummary(history, priceSeriesKey(series));
  const facts = buildWorkDetailPriceFacts({
    displayPrice: 300,
    regularPrice: 500,
    discountRate: 40,
    history,
    selectedSummary: summary,
    durationLabel: "120分",
  });

  assert.equal(facts.currentLabel, "¥300");
  assert.equal(facts.hasDiscount, true);
  assert.match(facts.workSummary, /現在の代表価格はセール中：通常500円が300円（40%OFF）/);
  assert.match(facts.workSummary, /2026\/10\/28/);
  assert.match(facts.workSummary, /記録上の最安値は300円/);
  assert.match(facts.workSummary, /収録時間は120分。/);
});

test("価格未取得時は未取得文言と系列なしの説明を保つ", () => {
  const facts = buildWorkDetailPriceFacts({
    displayPrice: null,
    regularPrice: null,
    discountRate: 0,
    history: [],
    selectedSummary: null,
    durationLabel: null,
  });

  assert.equal(facts.currentLabel, "価格未取得");
  assert.equal(facts.hasDiscount, false);
  assert.match(facts.workSummary, /代表価格は未取得です/);
  assert.match(facts.workSummary, /価格取得日：—/);
  assert.match(facts.workSummary, /価格履歴から最安値を確認できません/);
});
