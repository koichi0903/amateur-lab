import assert from "node:assert/strict";
import test from "node:test";
import { getPriceTypeRowPresentation } from "./priceTypeDisplay.ts";

test("uses price metadata and index to build a stable sale row", () => {
  assert.deepEqual(
    getPriceTypeRowPresentation(
      {
        id: 4,
        display_name: "HD",
        type: "download",
        period: "7日間",
        price_kind: null,
        normal_price: 2200,
        sale_price: 1100,
        effectivePrice: 1100,
      },
      0,
    ),
    {
      key: 4,
      label: "HD",
      isSale: true,
      isCheapest: true,
      showNormalPrice: true,
    },
  );
});

test("honors an explicit regular kind and preserves fallback labels and keys", () => {
  assert.deepEqual(
    getPriceTypeRowPresentation(
      {
        display_name: null,
        type: null,
        period: null,
        price_kind: "regular",
        normal_price: 2200,
        sale_price: 1100,
        effectivePrice: 1100,
      },
      2,
    ),
    {
      key: "-2-",
      label: "販売価格",
      isSale: false,
      isCheapest: false,
      showNormalPrice: true,
    },
  );
});

test("keeps the original truthy-price rule for the normal-price strike-through", () => {
  assert.equal(
    getPriceTypeRowPresentation(
      {
        display_name: "HD",
        normal_price: 2200,
        sale_price: 0,
        effectivePrice: 2200,
      },
      1,
    ).showNormalPrice,
    false,
  );
});
