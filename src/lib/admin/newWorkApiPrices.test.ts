import assert from "node:assert/strict";
import test from "node:test";
import {
  mapDmmItemPricesToPlans,
  type ExistingPricePlan,
} from "./newWorkApiPrices.ts";
import type { DmmItem } from "@/types/dmm";

const plans: ExistingPricePlan[] = [
  { display_name: "ダウンロード ＋ ストリーミング", period: "無期限" },
  { display_name: "HD版ダウンロード ＋ HD版ストリーミング", period: "無期限" },
  { display_name: "HD版ストリーミング", period: "7日間" },
  { display_name: "4K版ダウンロード ＋ 4K版ストリーミング", period: "無期限" },
];

function makeItem(overrides: Partial<DmmItem> = {}): DmmItem {
  return {
    content_id: "test-product",
    title: "test",
    date: "2026-11-25",
    prices: {
      price: "693",
      list_price: "990",
      deliveries: {
        delivery: [
          { type: "download", price: "1386", list_price: "1980" },
          { type: "hd", price: "1715", list_price: "2450" },
          { type: "stream", price: "693", list_price: "990" },
          { type: "4k", price: "3380", list_price: "3380" },
          { type: "iosdl", price: "1386", list_price: "1980" },
          { type: "androiddl", price: "1386", list_price: "1980" },
        ],
      },
    },
    campaign: {
      title: "セール",
      date_begin: "2026-11-24 00:00:00",
      date_end: "2026-11-30 23:59:59",
    },
    ...overrides,
  };
}

test("maps API prices to all existing plans and preserves their periods", () => {
  const result = mapDmmItemPricesToPlans(
    makeItem(),
    plans,
    new Date("2026-11-25T12:00:00+09:00"),
  );

  assert.equal(result.status, "mapped");
  if (result.status !== "mapped") return;

  assert.deepEqual(
    result.prices.map(({ name, period, normalPrice, salePrice }) => ({
      name,
      period,
      normalPrice,
      salePrice,
    })),
    [
      { name: plans[0].display_name, period: "無期限", normalPrice: 1980, salePrice: 1386 },
      { name: plans[1].display_name, period: "無期限", normalPrice: 2450, salePrice: 1715 },
      { name: plans[2].display_name, period: "7日間", normalPrice: 990, salePrice: 693 },
      { name: plans[3].display_name, period: "無期限", normalPrice: 3380, salePrice: undefined },
    ],
  );
  assert.equal(result.saleEndAt?.toISOString(), "2026-11-30T14:59:59.000Z");
});

test("falls back when an API delivery type is not supported", () => {
  const item = makeItem({
    prices: {
      price: "693",
      list_price: "990",
      deliveries: {
        delivery: [
          { type: "download", price: "1386", list_price: "1980" },
          { type: "hd", price: "1715", list_price: "2450" },
          { type: "stream", price: "693", list_price: "990" },
          { type: "4k", price: "3380", list_price: "3380" },
          { type: "rp", price: "500", list_price: "500" },
        ],
      },
    },
  });

  const result = mapDmmItemPricesToPlans(
    item,
    plans,
    new Date("2026-11-25T12:00:00+09:00"),
  );

  assert.equal(result.status, "fallback");
  if (result.status === "fallback") assert.match(result.reason, /未対応/);
});

test("maps the API hd type to a uniquely labeled HQ plan", () => {
  const item = makeItem({
    prices: {
      price: "911",
      list_price: "1304",
      deliveries: {
        delivery: [
          { type: "8k", price: "1246", list_price: "1780" },
          { type: "hd", price: "911", list_price: "1304" },
          { type: "download", price: "698", list_price: "998" },
        ],
      },
    },
  });
  const hqPlans: ExistingPricePlan[] = [
    { display_name: "8KVR版ダウンロード ＋ 8KVR版ストリーミング", period: "無期限" },
    { display_name: "HQ版ダウンロード ＋ HQ版ストリーミング", period: "無期限" },
    { display_name: "ダウンロード ＋ ストリーミング", period: "無期限" },
  ];

  const result = mapDmmItemPricesToPlans(
    item,
    hqPlans,
    new Date("2026-11-25T12:00:00+09:00"),
  );

  assert.equal(result.status, "mapped");
  if (result.status !== "mapped") return;
  assert.equal(result.prices.find(({ type }) => type === "hd")?.name, hqPlans[1].display_name);
  assert.equal(result.prices.find(({ type }) => type === "hd")?.normalPrice, 1304);
  assert.equal(result.prices.find(({ type }) => type === "hd")?.salePrice, 911);
});

test("falls back when a streaming delivery could match multiple rental periods", () => {
  const result = mapDmmItemPricesToPlans(
    makeItem(),
    [...plans, { display_name: "別のストリーミング", period: "30日間" }],
    new Date("2026-11-25T12:00:00+09:00"),
  );

  assert.equal(result.status, "fallback");
  if (result.status === "fallback") assert.match(result.reason, /一意でない|件数が一致/);
});

test("falls back when discounted API prices have no active sale deadline", () => {
  const item = makeItem({
    campaign: {
      title: "終了済み",
      date_begin: "2026-11-01 00:00:00",
      date_end: "2026-11-10 23:59:59",
    },
  });
  const result = mapDmmItemPricesToPlans(
    item,
    plans,
    new Date("2026-11-25T12:00:00+09:00"),
  );

  assert.equal(result.status, "fallback");
  if (result.status === "fallback") assert.match(result.reason, /期限/);
});
