import assert from "node:assert/strict";
import test from "node:test";
import {
  getSeoIndexedWorkIds,
  getSeoPilotDefaultPriceSeries,
  isSeoPreservedWorkId,
  isWorkIndexable,
} from "./seoQuality.ts";
import {
  SEO_PRESERVED_WORK_IDS,
  SEO_PRICE_HISTORY_PILOT_SERIES,
} from "./seoIndexPilotManifest.ts";

const work = {
  id: 10001,
  stage: null,
  score: 0,
  review_count: 0,
  review_average: 0,
  price: 500,
  discount_rate: 0,
  image_url: "https://example.com/image.jpg",
  affiliate_url: "https://example.com/product",
};

test("既存の検索対象1,952件を保護し、300件の固定試験群を追加する", () => {
  const ids = getSeoIndexedWorkIds();
  assert.equal(SEO_PRESERVED_WORK_IDS.size, 1952);
  assert.equal(SEO_PRICE_HISTORY_PILOT_SERIES.size, 300);
  assert.equal(ids.length, 2252);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok([...SEO_PRICE_HISTORY_PILOT_SERIES.keys()].every((id) => id % 10 === 7));
  assert.ok([...SEO_PRICE_HISTORY_PILOT_SERIES.keys()].every((id) => !isSeoPreservedWorkId(id)));
});

test("試験作品の価格系列をチャート初期選択として返す", () => {
  const [id, series] = SEO_PRICE_HISTORY_PILOT_SERIES.entries().next().value!;
  assert.deepEqual(getSeoPilotDefaultPriceSeries(id), series);
  assert.equal(getSeoPilotDefaultPriceSeries(999999999), null);
});

test("固定された対象はランキング・セール・レビュー数・スコアの変動で外れない", () => {
  const preservedId = [...SEO_PRESERVED_WORK_IDS][0];
  assert.equal(isWorkIndexable({ ...work, id: preservedId }), true);
  assert.equal(
    isWorkIndexable({
      ...work,
      id: preservedId,
      score: -100,
      review_count: 0,
      discount_rate: 0,
      ranking: 99999,
    }),
    true,
  );
});

test("固定対象でも販売停止や購入情報の技術的不備があれば対象外にする", () => {
  const id = [...SEO_PRESERVED_WORK_IDS][0];
  for (const candidate of [
    { ...work, id, stage: "DISCONTINUED" },
    { ...work, id, price: 0 },
    { ...work, id, image_url: null },
    { ...work, id, affiliate_url: " " },
  ]) {
    assert.equal(isWorkIndexable(candidate), false);
  }
});

test("固定対象外の作品は高スコアやレビューだけで自動追加しない", () => {
  assert.equal(
    isWorkIndexable({ ...work, id: 10000, score: 100, review_count: 999 }),
    false,
  );
});

test("以前の個別例外作品は保護対象に含まれる", () => {
  assert.equal(isSeoPreservedWorkId(39697), true);
  assert.equal(isSeoPreservedWorkId(32775), true);
  assert.equal(isWorkIndexable({ ...work, id: 39697 }), true);
  assert.equal(isWorkIndexable({ ...work, id: 32775 }), true);
});
