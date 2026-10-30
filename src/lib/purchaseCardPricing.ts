import { parseDatabaseDate } from "@/lib/dateTime";

export type PurchasePriceOffer = {
  display_name: string | null;
  type: string | null;
  period?: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

export type PurchasePriceWork = {
  sale_price: number | null;
  price: number | null;
  list_price: number | null;
  discount_rate: number | null;
  lowest_price: number | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
};

export type PricedPurchaseOffer = PurchasePriceOffer & {
  effectivePrice: number;
};

export type PurchaseCardPricing = {
  sortedOffers: PricedPurchaseOffer[];
  bestOffer: PricedPurchaseOffer | null;
  currentPrice: number | null;
  regularPrice: number | null;
  calculatedDiscount: number;
  discountRate: number;
  isLowestPrice: boolean;
};

const effectivePrice = (offer: PurchasePriceOffer) =>
  offer.sale_price && offer.sale_price > 0
    ? offer.sale_price
    : offer.normal_price && offer.normal_price > 0
      ? offer.normal_price
      : null;

const isSaleActive = (work: PurchasePriceWork, now: number) =>
  !work.sale_end_at || (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) > now;

const hasSaleEvidence = (work: PurchasePriceWork, now: number) =>
  isSaleActive(work, now) &&
  (work.is_on_sale ||
    (work.sale_price != null && work.sale_price > 0) ||
    (work.discount_rate != null && work.discount_rate > 0));

const getRepresentativePrice = (
  work: PurchasePriceWork,
  saleEvidence: boolean,
) =>
  saleEvidence && work.sale_price && work.sale_price > 0
    ? work.sale_price
    : work.price;

const getRegularPrice = (
  work: PurchasePriceWork,
  saleEvidence: boolean,
  bestOffer: PricedPurchaseOffer | null,
  currentPrice: number | null,
) => {
  if (!saleEvidence || !currentPrice) return null;

  if (bestOffer?.normal_price && bestOffer.normal_price > currentPrice) {
    return bestOffer.normal_price;
  }
  if (work.list_price && work.list_price > currentPrice) return work.list_price;
  if (work.price && work.price > currentPrice) return work.price;
  return null;
};

const getCalculatedDiscount = (
  work: PurchasePriceWork,
  saleEvidence: boolean,
  regularPrice: number | null,
  currentPrice: number | null,
) => {
  if (
    !saleEvidence ||
    !work.sale_price ||
    work.sale_price <= 0 ||
    !regularPrice ||
    !currentPrice
  ) {
    return 0;
  }

  return Math.round((1 - currentPrice / regularPrice) * 100);
};

export function calculatePurchaseCardPricing(
  work: PurchasePriceWork,
  offers: PurchasePriceOffer[],
  now = Date.now(),
): PurchaseCardPricing {
  const sortedOffers = offers
    .map((offer) => ({ ...offer, effectivePrice: effectivePrice(offer) }))
    .filter((offer): offer is PricedPurchaseOffer => offer.effectivePrice !== null)
    .sort((a, b) => a.effectivePrice - b.effectivePrice);
  const saleEvidence = hasSaleEvidence(work, now);
  const representativePrice = getRepresentativePrice(work, saleEvidence);
  const bestOffer =
    sortedOffers.find((offer) => offer.effectivePrice === representativePrice) ?? null;
  const currentPrice = representativePrice ?? sortedOffers[0]?.effectivePrice ?? null;
  const regularPrice = getRegularPrice(work, saleEvidence, bestOffer, currentPrice);
  const calculatedDiscount = getCalculatedDiscount(
    work,
    saleEvidence,
    regularPrice,
    currentPrice,
  );

  return {
    sortedOffers,
    bestOffer,
    currentPrice,
    regularPrice,
    calculatedDiscount,
    discountRate: Math.max(work.discount_rate ?? 0, calculatedDiscount),
    isLowestPrice: !!currentPrice && !!work.lowest_price && currentPrice <= work.lowest_price,
  };
}
