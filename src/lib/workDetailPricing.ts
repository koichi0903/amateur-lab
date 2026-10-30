import { parseDatabaseDate } from "@/lib/dateTime";
import type { Work } from "@/types/work";

export type WorkPriceOption = {
  display_name: string | null;
  type: string | null;
  period?: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

type WorkPriceFacts = Pick<Work, "price" | "sale_price" | "sale_end_at" | "is_on_sale" | "discount_rate">;

type PurchaseAlternative = Pick<Work, "id" | "price" | "sale_price" | "sale_end_at" | "review_count" | "review_average">;

export function getCurrentWorkPriceOffers(
  priceHistory: readonly WorkPriceOption[],
  workPrices: readonly WorkPriceOption[] | null | undefined,
): WorkPriceOption[] {
  const latestOffers = new Map<string, WorkPriceOption>();
  for (const offer of priceHistory) {
    const key = `${offer.display_name ?? offer.type ?? ""}\u0000${offer.period ?? ""}`;
    if (!latestOffers.has(key)) latestOffers.set(key, offer);
  }

  // Current offers are authoritative. History can contain plans that ended,
  // so deriving the purchase list from it can resurrect stale price options.
  return workPrices?.length ? [...workPrices] : [...latestOffers.values()];
}

function hasActiveSaleEvidence(work: WorkPriceFacts, nowMs: number): boolean {
  const saleActive = !work.sale_end_at || Date.parse(work.sale_end_at) > nowMs;
  return saleActive && (
    work.is_on_sale ||
    (work.sale_price != null && work.sale_price > 0) ||
    (work.discount_rate != null && work.discount_rate > 0)
  );
}

function getRepresentativePriceOption(
  work: WorkPriceFacts,
  offers: readonly WorkPriceOption[],
  hasSaleEvidence: boolean,
): WorkPriceOption {
  const representativePrice = hasSaleEvidence && work.sale_price > 0 ? work.sale_price : work.price;
  return offers.find((offer) =>
    (offer.sale_price ?? offer.normal_price ?? 0) === representativePrice
  ) ?? {
    display_name: "代表価格",
    type: null,
    period: null,
    normal_price: work.price,
    sale_price: hasSaleEvidence ? work.sale_price || null : null,
  };
}

function getMobileDisplayPrice(hasSaleEvidence: boolean, currentPrice: WorkPriceOption) {
  return hasSaleEvidence && currentPrice.sale_price && currentPrice.sale_price > 0
    ? currentPrice.sale_price
    : currentPrice.normal_price;
}

function getMobileDisplayDiscountRate(
  work: WorkPriceFacts,
  hasSaleEvidence: boolean,
  currentPrice: WorkPriceOption,
  mobileDisplayPrice: number | null,
): number {
  return hasSaleEvidence &&
    currentPrice.sale_price &&
    currentPrice.normal_price &&
    mobileDisplayPrice &&
    currentPrice.normal_price > mobileDisplayPrice
      ? Math.round((1 - mobileDisplayPrice / currentPrice.normal_price) * 100)
      : hasSaleEvidence ? work.discount_rate : 0;
}

export function getWorkDetailPricePresentation(
  work: WorkPriceFacts,
  offers: readonly WorkPriceOption[],
  nowMs: number,
) {
  const hasSaleEvidence = hasActiveSaleEvidence(work, nowMs);
  const currentPrice = getRepresentativePriceOption(work, offers, hasSaleEvidence);
  const mobileDisplayPrice = getMobileDisplayPrice(hasSaleEvidence, currentPrice);
  const mobileDisplayDiscountRate = getMobileDisplayDiscountRate(
    work,
    hasSaleEvidence,
    currentPrice,
    mobileDisplayPrice,
  );

  return { currentPrice, mobileDisplayPrice, mobileDisplayDiscountRate };
}

export function selectPurchaseAlternatives<T extends PurchaseAlternative>(
  relatedWorks: readonly T[],
  mobileDisplayPrice: number | null | undefined,
  nowMs: () => number,
): T[] {
  return relatedWorks.filter((candidate) => {
    const saleEnd = parseDatabaseDate(candidate.sale_end_at)?.getTime();
    const saleExpired = candidate.sale_price > 0 &&
      Boolean(candidate.sale_end_at) &&
      (saleEnd == null || saleEnd <= nowMs());
    const price = !saleExpired && candidate.sale_price > 0 && candidate.sale_price < candidate.price
      ? candidate.sale_price
      : candidate.price;
    return Boolean(
      mobileDisplayPrice &&
      price > 0 &&
      price < mobileDisplayPrice &&
      candidate.review_count >= 10 &&
      candidate.review_average > 0,
    );
  }).slice(0, 3);
}
