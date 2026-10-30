import assert from "node:assert/strict";
import {
  buildPriceInsightFromRows,
  type HomePriceInsightWork,
  type PriceHistoryRow,
} from "./getHomePriceInsights";

const work = {
  id: 1,
  product_id: "abc123",
  title: "sample work",
  image_url: null,
  price: 100,
  sale_price: null,
  sale_end_at: null,
  list_price: 0,
  discount_rate: 0,
} as unknown as HomePriceInsightWork;

const rows: PriceHistoryRow[] = [
  {
    product_id: "abc123",
    changed_at: "2026-10-25T00:00:00.000Z",
    display_name: "単品",
    period: null,
    price_kind: "regular",
    normal_price: 200,
    sale_price: null,
  },
  {
    product_id: "abc123",
    changed_at: "2026-10-28T00:00:00.000Z",
    display_name: "単品",
    period: null,
    price_kind: "regular",
    normal_price: 100,
    sale_price: null,
  },
];

const insight = buildPriceInsightFromRows(
  work,
  rows,
  "2026-08-01T00:00:00.000Z",
  "2026-10-29T00:00:00.000Z",
);

assert.equal(insight?.previousPrice, 200);
assert.equal(insight?.currentPrice, 100);
assert.equal(insight?.dropAmount, 100);
assert.equal(insight?.dropRate, 50);
assert.equal(insight?.low90Price, 100);
assert.equal(insight?.peak90Price, 200);
assert.equal(insight?.badge, "急落");
assert.deepEqual(
  insight?.priceHistory.map(({ price, isCurrent }) => [price, isCurrent ?? false]),
  [[200, false], [100, false], [100, true]],
);

assert.equal(
  buildPriceInsightFromRows(
    { ...work, price: 120 },
    rows,
    "2026-08-01T00:00:00.000Z",
    "2026-10-29T00:00:00.000Z",
  ),
  null,
);
