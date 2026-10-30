import type { PriceHistoryItem } from "@/types/price";
import { getPriceSeriesSummary } from "@/lib/createChartData";

type PriceSeriesSummary = NonNullable<ReturnType<typeof getPriceSeriesSummary>>;

function formatSummaryDate(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function buildWorkDetailPriceFacts({
  displayPrice,
  regularPrice,
  discountRate,
  history,
  selectedSummary,
  durationLabel,
}: {
  displayPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
  history: PriceHistoryItem[];
  selectedSummary: PriceSeriesSummary | null;
  durationLabel: string | null;
}) {
  const workSummary = [
    buildPriceStatus(displayPrice, regularPrice, discountRate),
    `発掘LABでの価格取得日：${resolvePriceCheckedAt(selectedSummary, history)}`,
    buildLowestPriceStatus(selectedSummary),
    buildDurationStatus(durationLabel),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    currentLabel: buildCurrentPriceLabel(displayPrice),
    hasDiscount: hasDiscount(displayPrice, regularPrice),
    workSummary,
  };
}

function buildCurrentPriceLabel(displayPrice: number | null) {
  return displayPrice != null && displayPrice > 0
    ? `¥${displayPrice.toLocaleString("ja-JP")}`
    : "価格未取得";
}

function hasDiscount(displayPrice: number | null, regularPrice: number | null) {
  return Boolean(displayPrice && regularPrice && regularPrice > displayPrice);
}

function resolvePriceCheckedAt(selectedSummary: PriceSeriesSummary | null, history: PriceHistoryItem[]) {
  return selectedSummary
    ? formatSummaryDate(selectedSummary.lastDate)
    : history[0]?.changed_at
      ? history[0].changed_at.slice(0, 10).replace(/-/g, "/")
      : "—";
}

function buildPriceStatus(displayPrice: number | null, regularPrice: number | null, discountRate: number) {
  const discounted = hasDiscount(displayPrice, regularPrice);
  if (discounted) {
    return `現在の代表価格はセール中：通常${regularPrice?.toLocaleString("ja-JP")}円が${displayPrice?.toLocaleString("ja-JP")}円（${discountRate}%OFF）`;
  }
  return displayPrice && displayPrice > 0
    ? `現在の代表価格：${displayPrice.toLocaleString("ja-JP")}円`
    : "代表価格は未取得です";
}

function buildLowestPriceStatus(selectedSummary: PriceSeriesSummary | null) {
  return selectedSummary
    ? `選択中の価格系列で、記録上の最安値は${selectedSummary.lowestPrice.toLocaleString("ja-JP")}円です。`
    : "価格履歴から最安値を確認できません。";
}

function buildDurationStatus(durationLabel: string | null) {
  return durationLabel ? `収録時間は${durationLabel}。` : null;
}
