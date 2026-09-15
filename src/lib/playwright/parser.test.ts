import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePricePeriod,
  parseCurrencyAmount,
  parsePriceOptionFields,
} from "./parser";

test("currency parser never treats the 8 in 8KVR as a price", () => {
  assert.equal(parseCurrencyAmount("8KVR版ダウンロード"), null);
  assert.equal(parseCurrencyAmount("8"), null);
  assert.equal(parseCurrencyAmount("1,580円"), 1580);
  assert.equal(parseCurrencyAmount("¥509"), 509);
});

test("periods keep 7-day and unlimited variants separate", () => {
  assert.equal(normalizePricePeriod("7日"), "7日間");
  assert.equal(normalizePricePeriod("7日間"), "7日間");
  assert.equal(normalizePricePeriod("無期限"), "無期限");
});

test("regular 8K option uses the explicit currency element", () => {
  assert.deepEqual(
    parsePriceOptionFields({
      name: "8KVR版ダウンロード ＋ 8KVR版ストリーミング",
      period: "無期限",
      priceTexts: ["1,580円"],
    }),
    {
      type: "",
      name: "8KVR版ダウンロード ＋ 8KVR版ストリーミング",
      period: "無期限",
      normalPrice: 1580,
      salePrice: undefined,
    },
  );
});

test("sale option keeps normal and sale prices in DOM order", () => {
  assert.deepEqual(
    parsePriceOptionFields({
      name: "HQ版ダウンロード ＋ HQ版ストリーミング",
      period: "7日間",
      priceTexts: ["500円", "250円"],
    }),
    {
      type: "",
      name: "HQ版ダウンロード ＋ HQ版ストリーミング",
      period: "7日間",
      normalPrice: 500,
      salePrice: 250,
    },
  );
});
