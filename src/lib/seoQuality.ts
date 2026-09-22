// Keep the full catalog available to users, but only expose pages with a
// meaningful editorial signal to search engines.
export const WORK_INDEX_MIN_SCORE = 60;
export const WORK_INDEX_MIN_REVIEW_COUNT = 1;
export const WORK_INDEX_MIN_PRICE = 1;

export type WorkIndexabilityInput = {
  stage?: string | null;
  score: number | null;
  review_count: number | null;
  price: number | null;
  image_url: string | null;
  affiliate_url: string | null;
};

function hasValue(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorkIndexable(work: WorkIndexabilityInput): boolean {
  return (
    work.stage !== "DISCONTINUED" &&
    (work.score ?? 0) >= WORK_INDEX_MIN_SCORE &&
    (work.review_count ?? 0) >= WORK_INDEX_MIN_REVIEW_COUNT &&
    (work.price ?? 0) >= WORK_INDEX_MIN_PRICE &&
    hasValue(work.image_url) &&
    hasValue(work.affiliate_url)
  );
}
