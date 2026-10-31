import assert from "node:assert/strict";
import test from "node:test";
import { buildXPostPriceChart } from "./xPostPlannerPriceChart";
import type { PriceHistoryRow } from "./xPostPlannerData";

const row = (
  changed_at: string,
  display_name: string,
  period: string | null,
  normal_price: number | null,
  sale_price: number | null = null,
): PriceHistoryRow => ({ product_id: "product-1", changed_at, display_name, period, normal_price, sale_price });

test("price chart follows the current price series and preserves repeated observations", () => {
  const now = new Date("2026-10-28T05:00:00.000Z");
  const checkedAt = "2026-10-28T04:00:00.000Z";
  const chart = buildXPostPriceChart(100, [
    row("2026-10-24T04:00:00.000Z", "Foo", "monthly", 240),
    row("2026-10-26T04:00:00.000Z", "F oo", "monthly", 200),
    row("2026-10-27T04:00:00.000Z", " Foo ", "monthly", 200),
    row(checkedAt, "Foo", "monthly", 250, 100),
    row(checkedAt, "Foo", "yearly", 80),
    row(checkedAt, "Other", "monthly", 500),
  ], now);

  assert.ok(chart);
  assert.equal(chart.seriesName, "Foo");
  assert.equal(chart.seriesPeriod, "monthly");
  assert.equal(chart.previousPrice, 200);
  assert.equal(chart.hadPriceDrop, true);
  assert.equal(chart.seriesMinimumPrice, 100);
  assert.equal(chart.seriesMaximumPrice, 240);
  assert.equal(chart.seriesObservationCount, 4);
  assert.equal(chart.seriesLowestAt, checkedAt);
  assert.equal(chart.newRecordedLowToday, true);
  assert.deepEqual(chart.points.map(({ price }) => price), [240, 200, 200, 100]);
});

test("price chart is omitted when the current price is not the latest observation in its series", () => {
  const chart = buildXPostPriceChart(100, [
    row("2026-10-26T04:00:00.000Z", "Foo", "monthly", 200),
    row("2026-10-27T04:00:00.000Z", "Foo", "monthly", 100),
    row("2026-10-28T04:00:00.000Z", "Foo", "monthly", 120),
  ], new Date("2026-10-28T05:00:00.000Z"));

  assert.equal(chart, null);
});

test("a one-observation current series keeps the existing two-point chart fallback", () => {
  const checkedAt = "2026-10-28T04:00:00.000Z";
  const chart = buildXPostPriceChart(100, [row(checkedAt, "Foo", "monthly", 100)], new Date("2026-10-28T05:00:00.000Z"));

  assert.ok(chart);
  assert.equal(chart.newRecordedLowToday, null);
  assert.deepEqual(chart.points, [
    { changedAt: checkedAt, price: 100 },
    { changedAt: checkedAt, price: 100 },
  ]);
});
