// The current indexable cohort is frozen for the pilot so volatile sales,
// rankings, review counts, and aggregate scores cannot eject pages day to day.
export const WORK_INDEX_MIN_PRICE = 1;
import {
  SEO_INDEXED_WORK_IDS,
  SEO_PRESERVED_WORK_IDS,
  SEO_PRICE_HISTORY_PILOT_SERIES,
} from "./seoIndexPilotManifest.ts";

const indexedWorkIdSet = new Set<number>(SEO_INDEXED_WORK_IDS);

export type WorkIndexabilityInput = {
  id?: number | null;
  stage?: string | null;
  price: number | null;
  image_url: string | null;
  affiliate_url: string | null;
  // Legacy signals remain accepted as input for call-site compatibility only.
  score?: number | null;
  review_count?: number | null;
  review_average?: number | null;
  sale_price?: number | null;
  discount_rate?: number | null;
  ranking?: number | null;
  realtime_rank?: number | null;
  daily_rank?: number | null;
  weekly_rank?: number | null;
  monthly_rank?: number | null;
  long_hit_rank?: number | null;
};

function hasValue(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorkIndexable(work: WorkIndexabilityInput): boolean {
  return (
    typeof work.id === "number" &&
    indexedWorkIdSet.has(work.id) &&
    work.stage !== "DISCONTINUED" &&
    (work.price ?? 0) >= WORK_INDEX_MIN_PRICE &&
    hasValue(work.image_url) &&
    hasValue(work.affiliate_url)
  );
}

export function getSeoPilotDefaultPriceSeries(workId: number) {
  return SEO_PRICE_HISTORY_PILOT_SERIES.get(workId) ?? null;
}

export function getSeoIndexedWorkIds(): number[] {
  return [...indexedWorkIdSet].sort((a, b) => a - b);
}

export function isSeoPreservedWorkId(workId: number): boolean {
  return SEO_PRESERVED_WORK_IDS.has(workId);
}
