import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";

const affiliateBuilder = (canonicalUrl: string) => `https://affiliate.example.test/?target=${encodeURIComponent(canonicalUrl)}`;

test("catalog normalization rejects non-records and entries without required identifiers", () => {
  assert.equal(normalizeFanzaAmateurCatalogItem(null, affiliateBuilder), null);
  assert.equal(normalizeFanzaAmateurCatalogItem([], affiliateBuilder), null);
  assert.equal(normalizeFanzaAmateurCatalogItem({ content_id: "cid", title: "title" }, affiliateBuilder), null);
  assert.equal(normalizeFanzaAmateurCatalogItem({ content_id: "cid", URL: "https://video.dmm.co.jp/amateur/content/cid/" }, affiliateBuilder), null);
});

test("catalog normalization maps details and keeps only approved DMM sample movie URLs", () => {
  let affiliateCalls = 0;
  const item = normalizeFanzaAmateurCatalogItem({
    content_id: "cid-1",
    title: " 作品名 ",
    URL: "https://video.dmm.co.jp/amateur/content/cid-1/",
    product_id: " product-1 ",
    date: " 2026-10-28 ",
    imageURL: { large: "", small: "https://pics.dmm.co.jp/small.jpg", list: "https://pics.dmm.co.jp/list.jpg" },
    sampleMovieURL: {
      size_476_306: "https://www.dmm.co.jp/litevideo/cid=cid-1/size=476_306/",
      size_560_360: "http://www.dmm.co.jp/litevideo/cid=cid-1/size=560_360/",
      size_644_414: "https://example.test/litevideo/cid=cid-1/size=644_414/",
      size_720_480: "https://www.dmm.co.jp/litevideo/cid=cid-1/size=720_480/",
    },
    prices: {
      price: "1590",
      list_price: "2980",
      deliveries: {
        delivery: [
          { type: "download", price: "1590", list_price: "2980" },
          { type: "stream", price: "invalid", list_price: null },
          { price: "500" },
          null,
        ],
      },
    },
    review: { average: "4.7" },
    iteminfo: {
      actress: [{ id: "1", name: "出演者" }],
      genre: [{ id: "2", name: "ジャンル" }],
      maker: [{ id: "3", name: "メーカー" }],
      series: [{ id: "4", name: "シリーズ" }],
    },
    campaign: [
      { title: "割引", date_begin: "2026-10-01", date_end: "2026-10-31" },
      null,
    ],
  }, (canonicalUrl) => {
    affiliateCalls += 1;
    return affiliateBuilder(canonicalUrl);
  });

  assert.ok(item);
  assert.equal(item.content_id, "cid-1");
  assert.equal(item.title, "作品名");
  assert.equal(item.product_id, "product-1");
  assert.equal(item.date, "2026-10-28");
  assert.equal(item.affiliateURL, affiliateBuilder("https://video.dmm.co.jp/amateur/content/cid-1/"));
  assert.equal(affiliateCalls, 1);
  assert.equal(item.imageUrl, "https://pics.dmm.co.jp/small.jpg");
  assert.equal(item.currentPrice, 1590);
  assert.equal(item.reviewAverage, 4.7);
  assert.deepEqual(item.prices.deliveries?.delivery, [
    { type: "download", price: "1590", list_price: "2980" },
    { type: "stream", price: "invalid", list_price: "" },
  ]);
  assert.deepEqual(Object.keys(item.sampleMovieURL ?? {}), ["size_476_306", "size_720_480"]);
  assert.deepEqual(item.campaigns, [{ title: "割引", dateBegin: "2026-10-01", dateEnd: "2026-10-31" }]);
  assert.equal(item.iteminfo?.actress?.[0]?.name, "出演者");
});

test("catalog normalization preserves an API-provided affiliate URL", () => {
  let affiliateCalls = 0;
  const item = normalizeFanzaAmateurCatalogItem({
    content_id: "cid-2",
    title: "別作品",
    URL: "https://video.dmm.co.jp/amateur/content/cid-2/",
    affiliateURL: "https://affiliate.example.test/prebuilt",
  }, () => {
    affiliateCalls += 1;
    return "unused";
  });

  assert.equal(item?.affiliateURL, "https://affiliate.example.test/prebuilt");
  assert.equal(affiliateCalls, 0);
});

test("catalog normalization accepts a single campaign object and falls back to list price", () => {
  const item = normalizeFanzaAmateurCatalogItem({
    content_id: "cid-3",
    title: "単一キャンペーン",
    URL: "https://video.dmm.co.jp/amateur/content/cid-3/",
    prices: { price: "invalid", list_price: "1200円" },
    campaign: { title: "単一割引", date_begin: "2026-10-01", date_end: "2026-10-31" },
  }, affiliateBuilder);

  assert.equal(item?.currentPrice, 1200);
  assert.deepEqual(item?.campaigns, [{ title: "単一割引", dateBegin: "2026-10-01", dateEnd: "2026-10-31" }]);
});
