import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentWorkPriceOffers,
  getWorkDetailPricePresentation,
  selectPurchaseAlternatives,
  type WorkPriceOption,
} from "./workDetailPricing.ts";

const offer = (overrides: Partial<WorkPriceOption> = {}): WorkPriceOption => ({
  display_name: "HD",
  type: "download",
  period: null,
  normal_price: 1000,
  sale_price: null,
  ...overrides,
});

const work = {
  price: 1000,
  sale_price: 800,
  sale_end_at: "2026-11-02T00:00:00+09:00",
  is_on_sale: true,
  discount_rate: 20,
};

test("現在価格があれば価格履歴から終了済み価格を復活させない", () => {
  const current = [offer({ sale_price: 1000 })];
  const history = [offer({ sale_price: 800 }), offer({ display_name: "SD", sale_price: 500 })];

  assert.deepEqual(getCurrentWorkPriceOffers(history, current), current);
});

test("現行価格がない場合は履歴から同一プランの最新レコードだけを残す", () => {
  const newest = offer({ sale_price: 800 });
  const history = [newest, offer({ sale_price: 700 }), offer({ display_name: "SD", period: "7days" })];

  assert.deepEqual(getCurrentWorkPriceOffers(history, []), [newest, history[2]]);
});

test("有効なセールでは代表価格に一致する価格と割引率を表示する", () => {
  const result = getWorkDetailPricePresentation(work, [offer({ sale_price: 800 })], Date.parse("2026-10-30T00:00:00+09:00"));

  assert.equal(result.currentPrice.sale_price, 800);
  assert.equal(result.mobileDisplayPrice, 800);
  assert.equal(result.mobileDisplayDiscountRate, 20);
});

test("期限切れセールは通常価格へ戻し割引表示しない", () => {
  const expired = { ...work, sale_end_at: "2026-10-01T00:00:00+09:00" };
  const result = getWorkDetailPricePresentation(expired, [offer()], Date.parse("2026-10-30T00:00:00+09:00"));

  assert.equal(result.currentPrice.sale_price, null);
  assert.equal(result.mobileDisplayPrice, 1000);
  assert.equal(result.mobileDisplayDiscountRate, 0);
});

test("購入候補はより安くレビュー条件を満たす作品を3件まで選ぶ", () => {
  const now = Date.parse("2026-10-30T00:00:00+09:00");
  const candidates = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    price: 900 - index * 100,
    sale_price: 0,
    sale_end_at: null,
    review_count: 10,
    review_average: 4,
  }));
  const result = selectPurchaseAlternatives(candidates, 1000, () => now);

  assert.deepEqual(result.map((candidate) => candidate.id), [1, 2, 3]);
});

test("期限切れ割引を使わず通常価格で購入候補を判定する", () => {
  const now = Date.parse("2026-10-30T00:00:00+09:00");
  const candidates = [{
    id: 1,
    price: 1200,
    sale_price: 500,
    sale_end_at: "2026-10-01T00:00:00+09:00",
    review_count: 12,
    review_average: 4,
  }];

  assert.deepEqual(selectPurchaseAlternatives(candidates, 1000, () => now), []);
});
