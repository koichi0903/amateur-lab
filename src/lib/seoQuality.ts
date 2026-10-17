// Keep the full catalog available to users, but only expose pages with both
// a demand signal and a concrete purchase-decision signal to search engines.
// Score alone is too volatile to be the only reason a page is indexed.
export const WORK_INDEX_MIN_SCORE = 60;
export const WORK_INDEX_MIN_REVIEW_COUNT = 5;
export const WORK_INDEX_MIN_PRICE = 1;
export const WORK_INDEX_MIN_DISCOUNT_RATE = 50;
export const WORK_INDEX_MAX_RANK = 100;
export const WORK_INDEX_MAX_BOTTOM_PRICE = 2000;
// A single page with verified Search Console demand and strong on-page review
// evidence. This exception is deliberately separate from the site-wide gate.
export const SEARCH_DEMAND_WORK_INDEX_EXCEPTIONS = [
  { id: 39697, minScore: 50, minReviewCount: 10, minReviewAverage: 4.5 },
  { id: 32775, minScore: 49, minReviewCount: 3, minReviewAverage: 5.0 },
] as const;
export const SEARCH_DEMAND_WORK_INDEX_EXCEPTION_IDS = SEARCH_DEMAND_WORK_INDEX_EXCEPTIONS.map(
  ({ id }) => id,
);

export type WorkIndexabilityInput = {
  id?: number | null;
  stage?: string | null;
  score: number | null;
  review_count: number | null;
  review_average?: number | null;
  price: number | null;
  sale_price?: number | null;
  discount_rate?: number | null;
  /** Legacy rental-price threshold; intentionally not a historical-low signal. */
  is_bottom_price?: boolean | null;
  is_lowest_price?: boolean | null;
  ranking?: number | null;
  realtime_rank?: number | null;
  daily_rank?: number | null;
  weekly_rank?: number | null;
  monthly_rank?: number | null;
  long_hit_rank?: number | null;
  image_url: string | null;
  affiliate_url: string | null;
};

function hasValue(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorkIndexable(work: WorkIndexabilityInput): boolean {
  const currentPrice = (work.sale_price ?? 0) > 0 ? work.sale_price ?? 0 : work.price ?? 0;
  const ranks = [
    work.ranking,
    work.realtime_rank,
    work.daily_rank,
    work.weekly_rank,
    work.monthly_rank,
    work.long_hit_rank,
  ].filter((rank): rank is number => typeof rank === "number" && rank > 0);
  const hasStablePurchaseSignal =
    ((work.review_count ?? 0) >= 20 && (work.review_average ?? 0) >= 4.2) ||
    (work.is_lowest_price === true && currentPrice <= WORK_INDEX_MAX_BOTTOM_PRICE) ||
    (work.discount_rate ?? 0) >= WORK_INDEX_MIN_DISCOUNT_RATE ||
    ranks.some((rank) => rank <= WORK_INDEX_MAX_RANK);
  const searchDemandException = SEARCH_DEMAND_WORK_INDEX_EXCEPTIONS.find(
    (exception) => exception.id === work.id,
  );
  const hasSearchDemandEvidence = Boolean(
    searchDemandException &&
      (work.score ?? 0) >= searchDemandException.minScore &&
      (work.review_count ?? 0) >= searchDemandException.minReviewCount &&
      (work.review_average ?? 0) >= searchDemandException.minReviewAverage,
  );

  return (
    work.stage !== "DISCONTINUED" &&
    (work.score ?? 0) >= (searchDemandException?.minScore ?? WORK_INDEX_MIN_SCORE) &&
    (work.review_count ?? 0) >= (searchDemandException?.minReviewCount ?? WORK_INDEX_MIN_REVIEW_COUNT) &&
    (work.price ?? 0) >= WORK_INDEX_MIN_PRICE &&
    hasValue(work.image_url) &&
    hasValue(work.affiliate_url) &&
    (hasStablePurchaseSignal || hasSearchDemandEvidence)
  );
}
