import { parseDatabaseDate } from "@/lib/dateTime";
import type { Work } from "@/types/work";

export type WorkDetailPriceOffer = {
  display_name: string | null;
  type: string | null;
  period?: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

export type WorkDetailPricePresentation = {
  currentPrice: WorkDetailPriceOffer;
  mobileDisplayPrice: number | null;
  mobileDisplayDiscountRate: number;
};

type PriceRelevantWork = Pick<
  Work,
  "price" | "sale_price" | "discount_rate" | "is_on_sale" | "sale_end_at"
>;

type PurchaseAlternative = Pick<
  Work,
  "id" | "price" | "sale_price" | "sale_end_at" | "review_count" | "review_average"
>;

export function splitWorkEntities(value: string | null): string[] {
  return value?.split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).filter(Boolean) ?? [];
}

export function getPrimaryWorkEntity(entities: string[]): string {
  return entities[0] ?? "";
}

export function selectCurrentPriceOffers<T extends WorkDetailPriceOffer>(
  priceHistory: T[],
  workPrices: T[],
): T[] {
  const latestOffers = new Map<string, T>();
  for (const offer of priceHistory) {
    const key = `${offer.display_name ?? offer.type ?? ""}\u0000${offer.period ?? ""}`;
    if (!latestOffers.has(key)) latestOffers.set(key, offer);
  }

  // Current offers are authoritative. History can contain plans that ended,
  // so deriving the purchase list from it can resurrect stale price options.
  return workPrices.length ? workPrices : [...latestOffers.values()];
}

function hasSaleEvidence(work: PriceRelevantWork, now: number): boolean {
  const saleActive = !work.sale_end_at || Date.parse(work.sale_end_at) > now;
  return saleActive && (
    work.is_on_sale ||
    (work.sale_price != null && work.sale_price > 0) ||
    (work.discount_rate != null && work.discount_rate > 0)
  );
}

function getCurrentOffer<T extends WorkDetailPriceOffer>(
  work: PriceRelevantWork,
  currentOffers: T[],
  saleEvidence: boolean,
): WorkDetailPriceOffer {
  const representativePrice = saleEvidence && work.sale_price > 0
    ? work.sale_price
    : work.price;
  return currentOffers.find((offer) =>
    (offer.sale_price ?? offer.normal_price ?? 0) === representativePrice
  ) ?? {
    display_name: "代表価格",
    type: null,
    period: null,
    normal_price: work.price,
    sale_price: saleEvidence ? work.sale_price || null : null,
  };
}

function getMobileDisplayPrice(
  currentPrice: WorkDetailPriceOffer,
  saleEvidence: boolean,
): number | null {
  return saleEvidence && currentPrice.sale_price && currentPrice.sale_price > 0
    ? currentPrice.sale_price
    : currentPrice.normal_price;
}

function hasOfferDiscount(
  currentPrice: WorkDetailPriceOffer,
  mobileDisplayPrice: number | null,
  saleEvidence: boolean,
): mobileDisplayPrice is number {
  return Boolean(
    saleEvidence &&
    currentPrice.sale_price &&
    currentPrice.normal_price &&
    mobileDisplayPrice &&
    currentPrice.normal_price > mobileDisplayPrice,
  );
}

function getMobileDisplayDiscountRate(
  work: PriceRelevantWork,
  currentPrice: WorkDetailPriceOffer,
  mobileDisplayPrice: number | null,
  saleEvidence: boolean,
): number {
  if (hasOfferDiscount(currentPrice, mobileDisplayPrice, saleEvidence)) {
    return Math.round((1 - mobileDisplayPrice / currentPrice.normal_price!) * 100);
  }
  return saleEvidence ? work.discount_rate : 0;
}

export function resolveWorkDetailPricePresentation<T extends WorkDetailPriceOffer>(
  work: PriceRelevantWork,
  currentOffers: T[],
  now = Date.now(),
): WorkDetailPricePresentation {
  const saleEvidence = hasSaleEvidence(work, now);
  const currentPrice = getCurrentOffer(work, currentOffers, saleEvidence);
  const mobileDisplayPrice = getMobileDisplayPrice(currentPrice, saleEvidence);
  const mobileDisplayDiscountRate = getMobileDisplayDiscountRate(
    work,
    currentPrice,
    mobileDisplayPrice,
    saleEvidence,
  );

  return { currentPrice, mobileDisplayPrice, mobileDisplayDiscountRate };
}

function isExpiredAlternativeSale(candidate: PurchaseAlternative, now: () => number): boolean {
  if (candidate.sale_price <= 0 || !candidate.sale_end_at) return false;
  const saleEnd = parseDatabaseDate(candidate.sale_end_at)?.getTime();
  return saleEnd == null || saleEnd <= now();
}

function getAlternativePrice(candidate: PurchaseAlternative, now: () => number): number {
  const saleExpired = isExpiredAlternativeSale(candidate, now);
  return !saleExpired && candidate.sale_price > 0 && candidate.sale_price < candidate.price
    ? candidate.sale_price
    : candidate.price;
}

function isPurchaseAlternative(
  candidate: PurchaseAlternative,
  mobileDisplayPrice: number | null | undefined,
  now: () => number,
): boolean {
  const price = getAlternativePrice(candidate, now);
  return Boolean(
    mobileDisplayPrice &&
    price > 0 &&
    price < mobileDisplayPrice &&
    candidate.review_count >= 10 &&
    candidate.review_average > 0,
  );
}

export function selectPurchaseAlternatives<T extends PurchaseAlternative>(
  relatedWorks: T[],
  mobileDisplayPrice: number | null | undefined,
  now: () => number = Date.now,
): T[] {
  return relatedWorks.filter((candidate) =>
    isPurchaseAlternative(candidate, mobileDisplayPrice, now)
  ).slice(0, 3);
}
