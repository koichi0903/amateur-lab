import type { DmmItem } from "@/types/dmm";
import type { RankingProduct } from "@/lib/playwright/getRankingProducts";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RANKING_DETAIL_REFRESH_DAYS = 7;

export type RankingWorkSnapshot = {
  product_id: string;
  price: number | null;
  list_price: number | null;
  sale_price: number | null;
  url: string | null;
  playwright_status: string | null;
  updated_at: string | null;
};

export type RankingPlaywrightReason =
  | "PENDING"
  | "UNAVAILABLE"
  | "MISSING_DATA"
  | "PRICE_CHANGED"
  | "WEEKLY_REFRESH";

export type RankingPlaywrightTarget = {
  item: DmmItem;
  listPrice: number | null;
  reasons: RankingPlaywrightReason[];
  captureSampleMovie?: boolean;
};

function isRefreshDue(updatedAt: string | null, now: number): boolean {
  if (!updatedAt) return true;
  const updatedAtMs = Date.parse(updatedAt);
  return (
    !Number.isFinite(updatedAtMs) ||
    now - updatedAtMs >= RANKING_DETAIL_REFRESH_DAYS * DAY_MS
  );
}

function isPriceChanged(
  work: RankingWorkSnapshot,
  listing: RankingProduct | undefined,
): boolean {
  if (!listing || listing.listPrice == null) return false;

  if (work.list_price !== listing.listPrice) return true;

  return listing.salePrice == null
    ? work.sale_price != null
    : work.sale_price !== listing.salePrice;
}

function hasRequiredDataMissing(work: RankingWorkSnapshot): boolean {
  return (
    !work.url ||
    work.price == null ||
    work.list_price == null ||
    !work.playwright_status
  );
}

export function selectRankingPlaywrightTargets(
  rankingItems: DmmItem[],
  worksByProductId: ReadonlyMap<string, RankingWorkSnapshot>,
  listingByProductId: ReadonlyMap<string, RankingProduct>,
  now = Date.now(),
): RankingPlaywrightTarget[] {
  const targets: RankingPlaywrightTarget[] = [];

  for (const item of rankingItems) {
    const work = worksByProductId.get(item.content_id);
    const listing = listingByProductId.get(item.content_id);

    // Missing rows are normally registered before this selection. Keep this
    // fallback so a partial registration can still be repaired by Playwright.
    if (!work) {
      targets.push({
        item,
        listPrice: listing?.listPrice ?? null,
        reasons: ["MISSING_DATA"],
      });
      continue;
    }

    const reasons: RankingPlaywrightReason[] = [];
    if (work.playwright_status === "PENDING") reasons.push("PENDING");
    if (work.playwright_status?.startsWith("UNAVAILABLE_")) {
      reasons.push("UNAVAILABLE");
    }
    if (hasRequiredDataMissing(work)) reasons.push("MISSING_DATA");
    if (isPriceChanged(work, listing)) reasons.push("PRICE_CHANGED");
    if (isRefreshDue(work.updated_at, now)) reasons.push("WEEKLY_REFRESH");

    if (reasons.length > 0) {
      targets.push({
        item,
        listPrice: listing?.listPrice ?? null,
        reasons: [...new Set(reasons)],
      });
    }
  }

  return targets;
}
