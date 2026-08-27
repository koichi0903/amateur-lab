import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCatalogIntent, type CatalogIntentWork } from "./catalogIntentAnalyzer.ts";

const works: CatalogIntentWork[] = [
  { id: 1, title: "作品A", score: 82, review_average: 4.4, review_count: 20, price: 2000, sale_price: 900, discount_rate: 55, actress: "女優A", genre: "ドラマ / 単体作品", maker: "メーカーA", series: "シリーズA" },
  { id: 2, title: "作品B", score: 70, review_average: 4.8, review_count: 3, price: 700, sale_price: 0, discount_rate: 0, actress: "女優B", genre: "ドラマ", maker: "メーカーA", series: null },
  { id: 3, title: "作品C", score: 65, review_average: 4.2, review_count: 30, price: 1200, sale_price: 0, discount_rate: 0, actress: "女優A", genre: "ドラマ", maker: "メーカーB", series: "シリーズA" },
];

test("builds evidence-backed highlights and selection counts", () => {
  const result = analyzeCatalogIntent({ kind: "genre", name: "ドラマ", works });

  assert.equal(result.highlights[0]?.workId, 1);
  assert.equal(result.highlights[1]?.workId, 1);
  assert.equal(result.highlights[2]?.value, "¥700");
  assert.ok(result.selectionPoints.includes("発掘スコア70点以上は2作品です。"));
  assert.ok(result.selectionPoints.includes("レビュー10件以上の判断材料がある作品は2作品です。"));
});

test("creates internal links from recurring related entities", () => {
  const result = analyzeCatalogIntent({ kind: "genre", name: "ドラマ", works });

  assert.deepEqual(result.related.find((item) => item.kind === "maker"), {
    kind: "maker",
    label: "メーカー",
    name: "メーカーA",
    count: 2,
  });
  assert.ok(result.related.some((item) => item.kind === "actress" && item.name === "女優A" && item.count === 2));
});
