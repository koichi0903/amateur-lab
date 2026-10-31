import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWorkDetailPricePresentation,
  getPrimaryWorkEntity,
  selectCurrentPriceOffers,
  selectPurchaseAlternatives,
  splitWorkEntities,
  type WorkDetailPriceOffer,
} from "./workDetailViewModel.ts";

const normalOffer: WorkDetailPriceOffer = {
  display_name: "通常版",
  type: "download",
  period: null,
  normal_price: 500,
  sale_price: null,
};

test("作品の属性名を従来の区切り文字で分割する", () => {
  assert.deepEqual(splitWorkEntities("女優A / 女優B、女優C,女優D／女優E"), [
    "女優A",
    "女優B",
    "女優C",
    "女優D",
    "女優E",
  ]);
  assert.deepEqual(splitWorkEntities(null), []);
  assert.equal(getPrimaryWorkEntity(["先頭", "後続"]), "先頭");
  assert.equal(getPrimaryWorkEntity([]), "");
});

test("価格履歴は同一形式の最新行を使い、現在価格があればそちらを優先する", () => {
  const olderOffer = { ...normalOffer, normal_price: 600 };
  const currentOffer = { ...normalOffer, normal_price: 450 };

  assert.deepEqual(
    selectCurrentPriceOffers([currentOffer, olderOffer], []),
    [currentOffer],
  );
  assert.deepEqual(
    selectCurrentPriceOffers([olderOffer], [currentOffer]),
    [currentOffer],
  );
});

test("期限切れセールを通常価格へ戻し、有効セールの割引表示を維持する", () => {
  const now = Date.parse("2026-10-30T00:00:00+09:00");
  const saleOffer = { ...normalOffer, display_name: "セール版", sale_price: 250 };

  const expired = resolveWorkDetailPricePresentation(
    {
      price: 500,
      sale_price: 250,
      discount_rate: 50,
      is_on_sale: true,
      sale_end_at: "2026-10-29T00:00:00+09:00",
    },
    [saleOffer, normalOffer],
    now,
  );
  assert.equal(expired.currentPrice.display_name, "通常版");
  assert.equal(expired.mobileDisplayPrice, 500);
  assert.equal(expired.mobileDisplayDiscountRate, 0);

  const active = resolveWorkDetailPricePresentation(
    {
      price: 500,
      sale_price: 250,
      discount_rate: 50,
      is_on_sale: true,
      sale_end_at: "2026-10-31T00:00:00+09:00",
    },
    [saleOffer, normalOffer],
    now,
  );
  assert.equal(active.currentPrice.display_name, "セール版");
  assert.equal(active.mobileDisplayPrice, 250);
  assert.equal(active.mobileDisplayDiscountRate, 50);
});

test("購入候補は有効価格とレビュー条件を満たす上位3作品に絞る", () => {
  const works = [
    { id: 1, price: 450, sale_price: 200, sale_end_at: "2026-10-29T00:00:00+09:00", review_count: 20, review_average: 4 },
    { id: 2, price: 300, sale_price: 200, sale_end_at: "2026-10-31T00:00:00+09:00", review_count: 20, review_average: 4 },
    { id: 3, price: 300, sale_price: 0, sale_end_at: null, review_count: 9, review_average: 4 },
    { id: 4, price: 400, sale_price: 0, sale_end_at: null, review_count: 20, review_average: 4 },
    { id: 5, price: 350, sale_price: 0, sale_end_at: null, review_count: 20, review_average: 4 },
    { id: 6, price: 360, sale_price: 0, sale_end_at: null, review_count: 20, review_average: 4 },
    { id: 7, price: 370, sale_price: 0, sale_end_at: null, review_count: 20, review_average: 4 },
  ];

  assert.deepEqual(
    selectPurchaseAlternatives(
      works,
      400,
      () => Date.parse("2026-10-30T00:00:00+09:00"),
    )
      .map((work) => work.id),
    [2, 5, 6],
  );
});
