import { formatJapanDateTime, parseDatabaseDate } from "@/lib/dateTime";
import type { DealWork } from "./DealWorkCard";

export type DealWorkCardPresentation = {
  isSale: boolean;
  currentPrice: number;
  isRecordedLow: boolean;
  regularPrice: number | null;
  discountRate: number;
  saleEnd: string | null;
  purchaseReasons: string[];
};

function formatSaleEnd(value: string | null, now: number) {
  const date = parseDatabaseDate(value);
  if (!date || date.getTime() <= now) return null;
  return formatJapanDateTime(value);
}

export function buildDealWorkCardPresentation(work: DealWork, now = Date.now()): DealWorkCardPresentation {
  const hasSalePrice = work.sale_price > 0;
  const hasDiscountRate = work.discount_rate > 0;
  const isSale = work.is_on_sale || hasSalePrice || hasDiscountRate;
  const currentPrice = hasSalePrice ? work.sale_price : work.price;
  const isRecordedLow = work.is_lowest_price === true;
  const regularPrice = isSale && work.list_price && work.list_price > currentPrice
    ? work.list_price
    : null;
  const discountRate = isSale && hasDiscountRate
    ? Math.round(work.discount_rate)
    : hasSalePrice && regularPrice && currentPrice > 0
      ? Math.round((1 - currentPrice / regularPrice) * 100)
      : 0;
  const saleEnd = formatSaleEnd(work.sale_end_at, now);
  const purchaseReasons = [
    isRecordedLow ? "取得期間内の最安" : null,
    discountRate >= 50 ? "半額以上" : null,
    work.review_average >= 4 && work.review_count >= 20 ? "レビュー根拠あり" : null,
    work.sample_movie_url ? "購入前にサンプル可" : null,
    saleEnd ? "終了予定を確認" : null,
  ].filter((reason): reason is string => Boolean(reason)).slice(0, 2);

  return { isSale, currentPrice, isRecordedLow, regularPrice, discountRate, saleEnd, purchaseReasons };
}
