import assert from "node:assert/strict";
import test from "node:test";

import {
  createChartData,
  getPriceSeries,
  getPriceSeriesSummary,
  priceSeriesKey,
} from "./createChartData";
import type { PriceHistoryItem } from "@/types/price";

const history: PriceHistoryItem[] = [
  { id: 1, changed_at: "2026-08-01T00:00:00Z", display_name: "DVD", type: "DVD", period: "無期限", price_kind: "regular", normal_price: 3000, sale_price: null },
  { id: 2, changed_at: "2026-09-01T00:00:00Z", display_name: "ダウンロード", type: "ダウンロード", period: "7日間", price_kind: "regular", normal_price: 1200, sale_price: null },
  { id: 3, changed_at: "2026-09-15T00:00:00Z", display_name: "DVD", type: "DVD", period: "無期限", price_kind: "sale", normal_price: 3000, sale_price: 1800 },
  { id: 4, changed_at: "2026-10-01T00:00:00Z", display_name: "ダウンロード", type: "ダウンロード", period: "7日間", price_kind: "regular", normal_price: 1000, sale_price: null },
];

test("価格要約とチャートが選択した販売形式・期間だけを比較する", () => {
  const series = getPriceSeries(history).find((item) => item.displayName === "ダウンロード" && item.period === "7日間");
  assert.ok(series);
  const summary = getPriceSeriesSummary(history, priceSeriesKey(series));
  const chart = createChartData(history, series.displayName, series.period);
  assert.ok(summary);
  assert.equal(summary.recordCount, 2);
  assert.equal(summary.latest.price, 1000);
  assert.equal(summary.lowestPrice, 1000);
  assert.deepEqual(chart.map((point) => point.price), [1200, 1000]);
  assert.ok(summary.firstDate.getTime() > Date.parse("2026-08-01T00:00:00Z"));
});

test("セール価格をその系列の最安値として通常価格と区別して扱う", () => {
  const series = getPriceSeries(history).find((item) => item.displayName === "DVD" && item.period === "無期限");
  assert.ok(series);
  const summary = getPriceSeriesSummary(history, priceSeriesKey(series));
  assert.ok(summary);
  assert.equal(summary.recordCount, 2);
  assert.equal(summary.latest.price, 1800);
  assert.equal(summary.lowestPrice, 1800);
  assert.equal(summary.latest.item.normal_price, 3000);
});

test("存在しない選択系列の価格要約は返さない", () => {
  assert.equal(getPriceSeriesSummary(history, "unknown\u0000series"), null);
});
