export const WORK_INDEX_MIN_SCORE = 1;
export const WORK_INDEX_MIN_PRICE = 1;

export type WorkIndexabilityInput = {
  score: number | null;
  price: number | null;
  image_url: string | null;
  affiliate_url: string | null;
};

function hasValue(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorkIndexable(work: WorkIndexabilityInput): boolean {
  return (
    (work.score ?? 0) >= WORK_INDEX_MIN_SCORE &&
    (work.price ?? 0) >= WORK_INDEX_MIN_PRICE &&
    hasValue(work.image_url) &&
    hasValue(work.affiliate_url)
  );
}
