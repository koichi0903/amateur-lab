import assert from "node:assert/strict";
import test from "node:test";
import { buildFanzaAmateurDetailEntityProjection, buildFanzaAmateurDetailPriceProjection, formatFanzaAmateurPriceType, mergeCatalogDetailPriceHistory, mergeStoredCatalogMedia } from "./fanzaAmateurCatalogDetailProjection";

test("stored FANZA media overrides normalized values and keeps normalized fallbacks", () => {
  const item = {
    imageURL: { large: "normalized-large", small: "normalized-small", list: "normalized-list" },
    sampleImageURL: { sample_l: { image: ["normalized-sample-large"] }, sample_s: { image: ["normalized-sample-small"] } },
  };
  const result = mergeStoredCatalogMedia(item, { large: "stored-large", list: " " }, {
    sample_l: { image: ["stored-large-sample", 1, "stored-large-sample-2"] },
    sample_s: { image: [] },
  });

  assert.deepEqual(result, {
    imageURL: { large: "stored-large", small: "normalized-small", list: "normalized-list" },
    sampleImageURL: { sample_l: { image: ["stored-large-sample", "stored-large-sample-2"] }, sample_s: { image: ["normalized-sample-small"] } },
  });
});

test("detail history prefers direct observations for duplicate keys and sorts newest first", () => {
  const weekly = [
    { observed_at: "2026-10-20", price_type: "campaign", price: "500" },
    { observed_at: "2026-10-10", price_type: "regular", price: "700" },
  ];
  const direct = [
    { observed_at: "2026-10-20", price_type: "campaign", price: "450" },
  ];
  const result = mergeCatalogDetailPriceHistory(direct, [{ id: "snapshot" }], () => weekly);

  assert.deepEqual(result, [
    { observed_at: "2026-10-20", price_type: "campaign", price: "450" },
    { observed_at: "2026-10-10", price_type: "regular", price: "700" },
  ]);
});

test("detail price projection selects the current delivery and adds a current chart point", () => {
  const priceHistory = [
    { observed_at: "2026-10-20T00:00:00+09:00", price_type: "download", price: "900円", list_price: "1,000円" },
    { observed_at: "2026-10-10T00:00:00+09:00", price_type: "stream", price: "1200円", list_price: "1500円" },
    { observed_at: "2026-10-20T00:00:00+09:00", price_type: "stream", price: "1000円", list_price: "1500円" },
    { observed_at: "2026-10-20T00:00:00+09:00", price_type: "summary", price: "900円", list_price: "1500円" },
  ];
  const projection = buildFanzaAmateurDetailPriceProjection({
    priceHistory,
    currentPrice: 800,
    listPrice: "1500円",
    deliveries: [
      { type: "download", price: "900円", list_price: "1,000円" },
      { type: "stream", price: "800円", list_price: "1,500円" },
    ],
    selectedPriceType: "",
    fetchedAt: "2026-10-30T12:00:00+09:00",
  });

  assert.deepEqual(projection.priceTypes, ["stream", "download"]);
  assert.equal(projection.activePriceType, "stream");
  assert.equal(projection.listPrice, 1_500);
  assert.equal(projection.discount, 47);
  assert.equal(projection.lowestPrice, 1_000);
  assert.equal(projection.chartHistory.at(-1)?.price, 800);
  assert.equal(projection.chartHistory.length, 3);
  assert.equal(formatFanzaAmateurPriceType("stream"), "ストリーミング");
  assert.equal(formatFanzaAmateurPriceType("rental"), "rental");
});

test("detail price projection replaces a history point fetched at the current timestamp", () => {
  const priceHistory = [
    { observed_at: "2026-10-30T12:00:00+09:00", price_type: "stream", price: "900円", list_price: "1,000円" },
  ];
  const projection = buildFanzaAmateurDetailPriceProjection({
    priceHistory,
    currentPrice: 800,
    listPrice: "1000円",
    deliveries: [{ type: "stream", price: "800円", list_price: "1,000円" }],
    selectedPriceType: "stream",
    fetchedAt: "2026-10-30T12:00:00+09:00",
  });

  assert.equal(projection.activeHistory.length, 1);
  assert.equal(projection.chartHistory.length, 1);
  assert.equal(projection.chartHistory[0].price, 800);
});

test("detail entity projection preserves cover priority and filters display labels", () => {
  const projection = buildFanzaAmateurDetailEntityProjection({
    imageURL: { large: "", small: "small.jpg", list: "list.jpg" },
    imageUrl: "fallback.jpg",
    confirmedPerformers: ["performer"],
    iteminfo: {
      maker: [{ name: "maker" }, { name: "" }],
      series: [{ name: "series" }],
      genre: [{ name: "genre" }],
    },
  });

  assert.equal(projection.coverUrl, "small.jpg");
  assert.deepEqual(projection.performers, ["performer"]);
  assert.deepEqual(projection.makers, ["maker"]);
  assert.deepEqual(projection.seriesList, ["series"]);
  assert.deepEqual(projection.genres, ["genre"]);
});
