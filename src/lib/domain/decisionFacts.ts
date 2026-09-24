export type DecisionType = "RECORD_LOW" | "HIGH_DISCOUNT_NOT_LOW" | "HIDDEN_VALUE" | "UNKNOWN";

export type DecisionFacts = {
  decisionType: DecisionType;
  currentPrice: number | null;
  recordedLowestPrice: number | null;
  differenceFromLowest: number | null;
  discountRate: number | null;
  recordLow: {
    status: "yes" | "no" | "unknown";
    observedAt: string | null;
    coverageStart: string | null;
    coverageEnd: string | null;
    scope: "observed_price_history" | "unknown";
  };
  ranking: { status: "ranked" | "outside_or_unknown" | "unknown"; rank: number | null };
  review: { average: number | null; count: number | null };
  evidence: {
    sources: string[];
    priceSeries: { displayName: string | null; period: string | null };
  };
};

export const HIGH_DISCOUNT_THRESHOLD = 30;
export const HIDDEN_VALUE_MIN_REVIEW_AVERAGE = 4;
export const HIDDEN_VALUE_MIN_REVIEW_COUNT = 5;
export const HIDDEN_VALUE_MIN_DISCOUNT = 20;

export function isRankingOutsideOrUnknown(ranking: number | null | undefined) {
  return ranking == null || ranking >= 9999;
}

type DecisionFactInput = {
  currentPrice: number | null;
  recordedLowestPrice: number | null;
  discountRate: number | null;
  isOnSale: boolean;
  ranking: number | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  recordedLowestAt?: string | null;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  priceSeries?: { displayName?: string | null; period?: string | null };
};

export function buildDecisionFacts(input: DecisionFactInput): DecisionFacts {
  const comparable = Number.isFinite(input.currentPrice) && Number.isFinite(input.recordedLowestPrice);
  const currentPrice = comparable ? input.currentPrice : null;
  const recordedLowestPrice = comparable ? input.recordedLowestPrice : null;
  const differenceFromLowest = currentPrice != null && recordedLowestPrice != null
    ? currentPrice - recordedLowestPrice
    : null;
  const recordLowStatus = currentPrice == null || recordedLowestPrice == null
    ? "unknown"
    : currentPrice === recordedLowestPrice ? "yes" : "no";
  const recordLow = recordLowStatus === "yes";
  const hiddenValue = !recordLow
    && input.isOnSale
    && isRankingOutsideOrUnknown(input.ranking)
    && (input.reviewAverage ?? -Infinity) >= HIDDEN_VALUE_MIN_REVIEW_AVERAGE
    && (input.reviewCount ?? -1) >= HIDDEN_VALUE_MIN_REVIEW_COUNT
    && (input.discountRate ?? -1) >= HIDDEN_VALUE_MIN_DISCOUNT;

  let decisionType: DecisionType = "UNKNOWN";
  if (recordLow) decisionType = "RECORD_LOW";
  else if (input.isOnSale && (input.discountRate ?? -1) >= HIGH_DISCOUNT_THRESHOLD && differenceFromLowest != null && differenceFromLowest > 0) {
    decisionType = "HIGH_DISCOUNT_NOT_LOW";
  } else if (hiddenValue) {
    decisionType = "HIDDEN_VALUE";
  }

  return {
    decisionType,
    currentPrice,
    recordedLowestPrice,
    differenceFromLowest,
    discountRate: Number.isFinite(input.discountRate) ? input.discountRate : null,
    recordLow: {
      status: recordLowStatus,
      observedAt: recordLow ? input.recordedLowestAt ?? null : null,
      coverageStart: input.coverageStart ?? null,
      coverageEnd: input.coverageEnd ?? null,
      scope: comparable ? "observed_price_history" : "unknown",
    },
    ranking: {
      status: input.ranking == null ? "unknown" : isRankingOutsideOrUnknown(input.ranking) ? "outside_or_unknown" : "ranked",
      rank: input.ranking ?? null,
    },
    review: { average: input.reviewAverage ?? null, count: input.reviewCount ?? null },
    evidence: {
      sources: comparable ? ["works", "price_history"] : ["works"],
      priceSeries: { displayName: input.priceSeries?.displayName ?? null, period: input.priceSeries?.period ?? null },
    },
  };
}

export function decisionFactProofLine(facts: DecisionFacts) {
  const yen = (value: number | null) => value == null ? null : `${value.toLocaleString("ja-JP")}円`;
  if (facts.decisionType === "RECORD_LOW" && facts.currentPrice != null) {
    const discount = facts.discountRate != null && facts.discountRate > 0 ? ` / ${facts.discountRate}%OFF` : "";
    return `発掘LABの記録上の最安値。現在${yen(facts.currentPrice)}${discount}`;
  }
  if (facts.decisionType === "HIGH_DISCOUNT_NOT_LOW" && facts.currentPrice != null && facts.recordedLowestPrice != null && facts.differenceFromLowest != null) {
    return `${facts.discountRate ?? 0}%OFFでも記録上の最安値ではありません。現在${yen(facts.currentPrice)}、記録最安${yen(facts.recordedLowestPrice)}より${yen(facts.differenceFromLowest)}高い`;
  }
  if (facts.decisionType === "HIDDEN_VALUE" && facts.currentPrice != null && facts.review.average != null && facts.review.count != null) {
    const discount = facts.discountRate != null && facts.discountRate > 0 ? ` / ${facts.discountRate}%OFF` : "";
    return `ランキング外。評価${facts.review.average.toFixed(1)} / レビュー${facts.review.count}件 / 現在${yen(facts.currentPrice)}${discount}`;
  }
  return "";
}
