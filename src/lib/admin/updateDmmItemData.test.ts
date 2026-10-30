import assert from "node:assert/strict";
import test from "node:test";
import type { DmmItem } from "../../types/dmm.ts";
import {
  areDmmSampleImagesDifferent,
  createDmmItemUpdateFacts,
  createDmmWorkUpdatePayload,
  hasDmmActressChange,
  hasDmmWorkMetadataChanges,
  type CurrentDmmWork,
} from "./updateDmmItemData.ts";

const item: DmmItem = {
  content_id: "sample-002",
  title: "作品タイトル",
  date: "2026-10-20",
  URL: "https://video.dmm.co.jp/amateur/content/sample-002/",
  affiliateURL: "https://affiliate.example.test/sample-002",
  prices: { price: "500", list_price: "800" },
  review: { average: "4.5", count: 12 },
  sampleImageURL: { sample_l: { image: ["image-1", "image-2"] } },
  iteminfo: {
    actress: [{ name: "Alice" }],
    maker: [{ name: "Studio" }],
    series: [{ name: "Series" }],
  },
};

const currentWork: CurrentDmmWork = {
  id: 7,
  review_count: 12,
  review_average: 4.5,
  maker: "Studio",
  series: "Series",
  url: "https://video.dmm.co.jp/amateur/content/sample-002/",
  release_date: "2026-10-20",
  actress: "Alice",
};

test("update facts keep release metadata, review growth, affiliate URL fallback, and price math", () => {
  const facts = createDmmItemUpdateFacts(item, { ...currentWork, review_count: 10 });

  assert.equal(facts.previousReviewCount, 10);
  assert.equal(facts.currentReviewCount, 12);
  assert.equal(facts.isReviewGrowth, true);
  assert.equal(facts.nextMaker, "Studio");
  assert.equal(facts.nextSeries, "Series");
  assert.equal(facts.nextUrl, item.URL);
  assert.equal(facts.nextReleaseDate, "2026-10-20");
  assert.equal(facts.nextActress, "Alice");
  assert.equal(facts.apiListPrice, 800);
  assert.equal(facts.apiSalePrice, 500);
  assert.equal(facts.apiDiscountRate, 38);
  assert.deepEqual(facts.sampleImages, ["image-1", "image-2"]);
});

test("catalog update facts preserve sparse metadata fallbacks", () => {
  const sparseItem: DmmItem = {
    ...item,
    date: "",
    URL: "",
    affiliateURL: "",
    sampleImageURL: undefined,
    iteminfo: { actress: [], maker: [], series: [] },
  };

  const facts = createDmmItemUpdateFacts(sparseItem);

  assert.equal(facts.nextMaker, "");
  assert.equal(facts.nextSeries, "");
  assert.equal(facts.nextUrl, "");
  assert.equal(facts.nextReleaseDate, null);
  assert.equal(facts.nextActress, null);
  assert.deepEqual(facts.sampleImages, []);
});

test("sample image comparison ignores empty incoming data and detects length or URL changes", () => {
  assert.equal(areDmmSampleImagesDifferent([{ image_url: "old" }], []), false);
  assert.equal(areDmmSampleImagesDifferent([{ image_url: "one" }], ["one"]), false);
  assert.equal(areDmmSampleImagesDifferent([{ image_url: "one" }], ["one", "two"]), true);
  assert.equal(areDmmSampleImagesDifferent([{ image_url: "old" }], ["new"]), true);
});

test("metadata gates and update-price option preserve update behavior", () => {
  const facts = createDmmItemUpdateFacts(item, currentWork);
  assert.equal(hasDmmWorkMetadataChanges(currentWork, facts), false);
  const changedMetadata: CurrentDmmWork[] = [
    { ...currentWork, review_count: 11 },
    { ...currentWork, review_average: 4.4 },
    { ...currentWork, maker: "Old studio" },
    { ...currentWork, series: "Old series" },
    { ...currentWork, url: "https://example.test/old" },
    { ...currentWork, release_date: "2026-10-19" },
  ];
  for (const changedWork of changedMetadata) {
    assert.equal(hasDmmWorkMetadataChanges(changedWork, facts), true);
  }
  assert.equal(hasDmmWorkMetadataChanges(undefined, facts), true);
  assert.equal(hasDmmActressChange(currentWork, facts.nextActress), false);
  assert.equal(hasDmmActressChange({ ...currentWork, actress: "Old actress" }, facts.nextActress), true);

  const withoutPrices = createDmmWorkUpdatePayload(facts, false, "2026-10-29T00:00:00.000Z");
  assert.equal("price" in withoutPrices, false);
  assert.equal("sale_price" in withoutPrices, false);
  assert.equal(withoutPrices.review_count, 12);
  assert.equal(withoutPrices.url, item.URL);
  assert.equal(withoutPrices.actress, "Alice");
  assert.equal(withoutPrices.last_updated, "2026-10-29T00:00:00.000Z");

  const withPrices = createDmmWorkUpdatePayload(facts, true, "now");
  assert.equal(withPrices.price, 800);
  assert.equal(withPrices.sale_price, 500);
  assert.equal(withPrices.discount_rate, 38);
});
