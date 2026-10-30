import assert from "node:assert/strict";
import test from "node:test";
import type { DmmItem } from "../../types/dmm.ts";
import {
  createDmmItemInsertRecord,
  scoreDmmItemEntities,
  type DmmItemRankingData,
  type DmmItemScore,
} from "./saveDmmItemData.ts";

const item: DmmItem = {
  content_id: "sample-001",
  title: "作品タイトル",
  date: "2026-10-01",
  URL: "https://video.dmm.co.jp/amateur/content/sample-001/",
  affiliateURL: "https://al.fanza.co.jp/?af_id=example",
  imageURL: { large: "https://example.test/large.jpg", list: "https://example.test/list.jpg" },
  prices: { price: "400", list_price: "800" },
  review: { average: "4.4", count: 12 },
  iteminfo: {
    actress: ["Alice", "Beth", "Cate", "Dora"].map((name) => ({ name })),
    genre: ["ドラマ", "独占配信", "人妻", "女教師", "女子校生", "企画"].map((name) => ({ name })),
    maker: [{ name: "Studio" }],
    series: [{ name: "Series" }],
  },
};

test("entity scores preserve first substring match and maximum matching rank", () => {
  const rankings: DmmItemRankingData = {
    actressRanking: [
      { name: "Alice", original_rank: 7, fanza_rank: null },
      { name: "Alice Sato", original_rank: 1, fanza_rank: null },
      { name: "Beth", original_rank: 40, fanza_rank: null },
    ],
    genreRanking: [{ name: "ドラマ", rank: 5, score: 0 }],
    makerRanking: [{ name: "Studio", rank: 10, score: 0 }],
    seriesRanking: [{ name: "Series", original_rank: 3, fanza_rank: 20 }],
  };

  assert.deepEqual(scoreDmmItemEntities(item, rankings), {
    actressScore: 19,
    genreScore: 9,
    makerScore: 9,
    seriesScore: 10,
  });
});

test("insert record preserves genre filtering, display text, score fields, and prices", () => {
  const entityScores = { actressScore: 19, genreScore: 9, makerScore: 9, seriesScore: 10 };
  const score: DmmItemScore = {
    score: 80,
    actressPoint: 19,
    genrePoint: 9,
    reviewPoint: 10.2,
    reviewCountPoint: 4.8,
    discountPoint: 7.5,
    popularityPoint: 9.6,
    makerPoint: 9,
    seriesPoint: 10,
    newReleaseBonus: 2,
    longHitPoint: 0,
    decisionSupportPoint: 0,
  };

  const record = createDmmItemInsertRecord(item, "OLD", entityScores, score);

  assert.equal(record.actress, "Alice / Beth / Cate / Dora");
  assert.equal(record.genre, "ドラマ / 人妻 / 女教師 / 女子校生 / 企画");
  assert.equal(record.memo, "Alice・Beth・Cate出演作品。\n\nドラマ・人妻・女教師・女子校生を楽しめる作品。\n\n発掘スコア80の注目作品。");
  assert.equal(record.score, 80);
  assert.equal(record.actress_score, 19);
  assert.equal(record.review_score, 10);
  assert.equal(record.review_count_score, 5);
  assert.equal(record.discount_score, 8);
  assert.equal(record.ranking_score, 10);
  assert.equal(record.price, 800);
  assert.equal(record.sale_price, 400);
  assert.equal(record.list_price, 800);
  assert.equal(record.discount_rate, 50);
  assert.equal(record.title, "作品タイトル");
  assert.equal(record.product_id, "sample-001");
  assert.equal(record.release_date, "2026-10-01");
  assert.equal(record.image_url, "https://example.test/large.jpg");
  assert.equal(record.affiliate_url, "https://al.fanza.co.jp/?af_id=example");
  assert.equal(record.url, "https://video.dmm.co.jp/amateur/content/sample-001/");
  assert.equal(record.maker, "Studio");
  assert.equal(record.series, "Series");
  assert.equal(record.stage, "OLD");
});

test("insert record preserves identity fallbacks for sparse source data", () => {
  const sparseItem: DmmItem = {
    ...item,
    content_id: "",
    date: "",
    URL: "",
    affiliateURL: "",
    imageURL: { list: "https://example.test/list-only.jpg" },
    iteminfo: {
      actress: [],
      genre: [],
      maker: [],
      series: [],
    },
  };
  const entityScores = { actressScore: 0, genreScore: 0, makerScore: 0, seriesScore: 0 };
  const score: DmmItemScore = {
    score: 0,
    actressPoint: 0,
    genrePoint: 0,
    reviewPoint: 0,
    reviewCountPoint: 0,
    discountPoint: 0,
    popularityPoint: 0,
    makerPoint: 0,
    seriesPoint: 0,
    newReleaseBonus: 0,
    longHitPoint: 0,
    decisionSupportPoint: 0,
  };

  const record = createDmmItemInsertRecord(sparseItem, "OLD", entityScores, score);

  assert.equal(record.actress, "");
  assert.equal(record.image_url, "https://example.test/list-only.jpg");
  assert.equal(record.affiliate_url, "");
  assert.equal(record.url, "");
  assert.equal(record.product_id, "");
  assert.equal(record.release_date, null);
  assert.equal(record.maker, "");
  assert.equal(record.series, "");
});
