// Eligibility is based on whether the live work page can serve a purchase
// decision. A frozen pilot ID list must not exclude otherwise complete pages.
export const WORK_INDEX_MIN_PRICE = 1;
import {
  SEO_PRESERVED_WORK_IDS,
  SEO_PRICE_HISTORY_PILOT_SERIES,
} from "./seoIndexPilotManifest.ts";

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
  // Retained for historical pilot reporting only, never page eligibility.
  return [...SEO_PRESERVED_WORK_IDS, ...SEO_PRICE_HISTORY_PILOT_SERIES.keys()]
    .sort((a, b) => a - b);
}

export function isSeoPreservedWorkId(workId: number): boolean {
  return SEO_PRESERVED_WORK_IDS.has(workId);
}
