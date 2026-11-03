export type DecisionType = "RECORD_LOW" | "HIGH_DISCOUNT_NOT_LOW" | "HIDDEN_VALUE" | "UNKNOWN";

export type DecisionFacts = {
  decisionType: DecisionType;
  eligibleDecisionTypes: Exclude<DecisionType, "UNKNOWN">[];
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
  currentRecordedLow: "yes" | "no" | "unknown";
  newRecordedLowToday: "yes" | "no" | "unknown";
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
  newRecordedLowToday?: boolean | null;
};

export type DecisionFactEligibilityReason =
  | "missing_current_price"
  | "missing_recorded_low"
  | "current_is_record_low"
  | "not_on_sale"
  | "discount_below_threshold"
  | "ranking_not_outside"
  | "review_average_below_threshold"
  | "review_count_below_threshold"
  | "higher_priority_decision_type";

type DecisionFactEligibilityInput = Pick<
  DecisionFactInput,
  "currentPrice" | "recordedLowestPrice" | "isOnSale" | "discountRate" | "ranking" | "reviewAverage" | "reviewCount"
>;

type ObservedPriceFacts = {
  comparable: boolean;
  currentPrice: number | null;
  recordedLowestPrice: number | null;
  differenceFromLowest: number | null;
  recordLowStatus: DecisionFacts["recordLow"]["status"];
  recordLow: boolean;
};

function observedPriceFacts(input: DecisionFactInput): ObservedPriceFacts {
  const comparable = Number.isFinite(input.currentPrice) && Number.isFinite(input.recordedLowestPrice);
  const currentPrice = Number.isFinite(input.currentPrice) ? input.currentPrice : null;
  const recordedLowestPrice = Number.isFinite(input.recordedLowestPrice) ? input.recordedLowestPrice : null;
  const differenceFromLowest = currentPrice != null && recordedLowestPrice != null
    ? currentPrice - recordedLowestPrice
    : null;
  const recordLowStatus = currentPrice == null || recordedLowestPrice == null
    ? "unknown"
    : currentPrice === recordedLowestPrice ? "yes" : "no";
  return { comparable, currentPrice, recordedLowestPrice, differenceFromLowest, recordLowStatus, recordLow: recordLowStatus === "yes" };
}

function hiddenValueSignal(input: DecisionFactInput) {
  // HIDDEN_VALUE proves ranking/review/current-price value; it does not need
  // the recorded-low/chart evidence required by the price comparison lanes.
  return input.isOnSale
    && isRankingOutsideOrUnknown(input.ranking)
    && (input.reviewAverage ?? -Infinity) >= HIDDEN_VALUE_MIN_REVIEW_AVERAGE
    && (input.reviewCount ?? -1) >= HIDDEN_VALUE_MIN_REVIEW_COUNT
    && (input.discountRate ?? -1) >= HIDDEN_VALUE_MIN_DISCOUNT;
}

function eligibleDecisionTypesFor(input: DecisionFactInput, price: ObservedPriceFacts, hiddenValue: boolean): Exclude<DecisionType, "UNKNOWN">[] {
  const eligibleDecisionTypes: Exclude<DecisionType, "UNKNOWN">[] = [];
  if (price.recordLow) eligibleDecisionTypes.push("RECORD_LOW");
  if (input.isOnSale && (input.discountRate ?? -1) >= HIGH_DISCOUNT_THRESHOLD && price.differenceFromLowest != null && price.differenceFromLowest > 0) {
    eligibleDecisionTypes.push("HIGH_DISCOUNT_NOT_LOW");
  }
  if (hiddenValue) eligibleDecisionTypes.push("HIDDEN_VALUE");
  return eligibleDecisionTypes;
}

function decisionTypeFor(eligible: Exclude<DecisionType, "UNKNOWN">[], recordLow: boolean): DecisionType {
  if (recordLow) return "RECORD_LOW";
  if (eligible.includes("HIGH_DISCOUNT_NOT_LOW")) return "HIGH_DISCOUNT_NOT_LOW";
  if (eligible.includes("HIDDEN_VALUE")) return "HIDDEN_VALUE";
  return "UNKNOWN";
}

function recordLowEvidence(input: DecisionFactInput, price: ObservedPriceFacts): DecisionFacts["recordLow"] {
  return {
    status: price.recordLowStatus,
    observedAt: price.recordLow ? input.recordedLowestAt ?? null : null,
    coverageStart: input.coverageStart ?? null,
    coverageEnd: input.coverageEnd ?? null,
    scope: price.comparable ? "observed_price_history" : "unknown",
  };
}

function rankingEvidence(input: DecisionFactInput): DecisionFacts["ranking"] {
  return {
    status: input.ranking == null ? "unknown" : isRankingOutsideOrUnknown(input.ranking) ? "outside_or_unknown" : "ranked",
    rank: input.ranking ?? null,
  };
}

export function decisionFactEligibilityReason(
  input: DecisionFactEligibilityInput,
  decisionType: Exclude<DecisionType, "UNKNOWN">,
): DecisionFactEligibilityReason | null {
  if (input.currentPrice == null) return "missing_current_price";
  if (decisionType === "RECORD_LOW") return recordLowEligibilityReason(input, input.currentPrice);
  if (!input.isOnSale) return "not_on_sale";
  if (decisionType === "HIGH_DISCOUNT_NOT_LOW") return highDiscountEligibilityReason(input, input.currentPrice);
  return hiddenValueEligibilityReason(input);
}

function recordLowEligibilityReason(input: DecisionFactEligibilityInput, currentPrice: number) {
  if (input.recordedLowestPrice == null || input.recordedLowestPrice <= 0) return "missing_recorded_low";
  return currentPrice === input.recordedLowestPrice ? null : "current_is_record_low";
}

function highDiscountEligibilityReason(input: DecisionFactEligibilityInput, currentPrice: number) {
  if ((input.discountRate ?? -1) < HIGH_DISCOUNT_THRESHOLD) return "discount_below_threshold";
  if (input.recordedLowestPrice == null || input.recordedLowestPrice <= 0) return "missing_recorded_low";
  return currentPrice > input.recordedLowestPrice ? null : "current_is_record_low";
}

function hiddenValueEligibilityReason(input: DecisionFactEligibilityInput) {
  if ((input.discountRate ?? -1) < HIDDEN_VALUE_MIN_DISCOUNT) return "discount_below_threshold";
  if (!isRankingOutsideOrUnknown(input.ranking)) return "ranking_not_outside";
  if ((input.reviewAverage ?? -Infinity) < HIDDEN_VALUE_MIN_REVIEW_AVERAGE) return "review_average_below_threshold";
  if ((input.reviewCount ?? -1) < HIDDEN_VALUE_MIN_REVIEW_COUNT) return "review_count_below_threshold";
  // HIDDEN_VALUE proves ranking/review/current-price value; it does not need
  // the recorded-low/chart evidence required by the price comparison lanes.
  return null;
}

export function buildDecisionFacts(input: DecisionFactInput): DecisionFacts {
  const price = observedPriceFacts(input);
  const eligibleDecisionTypes = eligibleDecisionTypesFor(input, price, hiddenValueSignal(input));

  return {
    decisionType: decisionTypeFor(eligibleDecisionTypes, price.recordLow),
    eligibleDecisionTypes,
    currentPrice: price.currentPrice,
    recordedLowestPrice: price.recordedLowestPrice,
    differenceFromLowest: price.differenceFromLowest,
    discountRate: Number.isFinite(input.discountRate) ? input.discountRate : null,
    recordLow: recordLowEvidence(input, price),
    currentRecordedLow: price.recordLowStatus,
    newRecordedLowToday: input.newRecordedLowToday == null ? "unknown" : input.newRecordedLowToday ? "yes" : "no",
    ranking: rankingEvidence(input),
    review: { average: input.reviewAverage ?? null, count: input.reviewCount ?? null },
    evidence: {
      sources: price.comparable ? ["works", "price_history"] : ["works"],
      priceSeries: { displayName: input.priceSeries?.displayName ?? null, period: input.priceSeries?.period ?? null },
    },
  };
}

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function recordLowProofLine(facts: DecisionFacts) {
  if (facts.currentPrice == null) return "";
  const discount = facts.discountRate != null && facts.discountRate > 0 ? ` / ${facts.discountRate}%OFF` : "";
  return `発掘LABの記録上の最安値。現在${formatYen(facts.currentPrice)}${discount}`;
}

function highDiscountProofLine(facts: DecisionFacts) {
  const { currentPrice, recordedLowestPrice, differenceFromLowest } = facts;
  if (currentPrice == null || recordedLowestPrice == null || differenceFromLowest == null) return "";
  return `${facts.discountRate ?? 0}%OFFでも記録上の最安値ではありません。現在${formatYen(currentPrice)}、記録最安${formatYen(recordedLowestPrice)}より${formatYen(differenceFromLowest)}高い`;
}

function hiddenValueProofLine(facts: DecisionFacts) {
  const { currentPrice, review } = facts;
  if (currentPrice == null || review.average == null || review.count == null) return "";
  const discount = facts.discountRate != null && facts.discountRate > 0 ? ` / ${facts.discountRate}%OFF` : "";
  return `ランキング外。評価${review.average.toFixed(1)} / レビュー${review.count}件 / 現在${formatYen(currentPrice)}${discount}`;
}

export function decisionFactProofLine(facts: DecisionFacts) {
  if (facts.decisionType === "RECORD_LOW") return recordLowProofLine(facts);
  if (facts.decisionType === "HIGH_DISCOUNT_NOT_LOW") return highDiscountProofLine(facts);
  if (facts.decisionType === "HIDDEN_VALUE") return hiddenValueProofLine(facts);
  return "";
}
