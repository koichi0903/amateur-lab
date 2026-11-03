import type { PriceInfo } from "./parser";

export function validatePriceData(productId: string, prices: PriceInfo[]): void {
  const invalidPrices = prices.filter(
    (price) =>
      !price.name.trim() ||
      !price.period ||
      !Number.isSafeInteger(price.normalPrice) ||
      (price.normalPrice ?? 0) <= 0 ||
      (price.salePrice != null &&
        (!Number.isSafeInteger(price.salePrice) ||
          price.salePrice <= 0 ||
          price.salePrice >= (price.normalPrice ?? 0))),
  );

  if (invalidPrices.length > 0) {
    throw new Error(
      `Invalid FANZA price data (${productId}): ${invalidPrices
        .map(
          (price) =>
            `${price.name || "(no name)"}/${price.period ?? "no period"}=` +
            `${price.normalPrice ?? "null"}/${price.salePrice ?? "null"}`,
        )
        .join(", ")}`,
    );
  }

  const duplicatedPriceNames = prices
    .map((price) => `${price.name}\u0000${price.period ?? ""}`)
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicatedPriceNames.length > 0) {
    throw new Error(
      `work_prices保存前重複 (${productId}): ${[
        ...new Set(duplicatedPriceNames),
      ].join(", ")}`,
    );
  }
}

export function getPriceKind(price: PriceInfo): "sale" | "regular" {
  return price.salePrice != null &&
    price.normalPrice != null &&
    price.salePrice > 0 &&
    price.salePrice < price.normalPrice
    ? "sale"
    : "regular";
}

function getMaximumDiscountRate(prices: PriceInfo[]) {
  let maxDiscountRate = 0;

  for (const price of prices) {
    if (
      price.normalPrice != null &&
      price.salePrice != null &&
      price.salePrice < price.normalPrice
    ) {
      const rate = Math.round(
        ((price.normalPrice - price.salePrice) / price.normalPrice) * 100,
      );
      if (rate > maxDiscountRate) maxDiscountRate = rate;
    }
  }

  return maxDiscountRate;
}

function getActiveSaleSummary(
  mainPrice: PriceInfo | undefined,
  requestedSaleEndAt: Date | null,
) {
  if (
    !requestedSaleEndAt ||
    !mainPrice?.salePrice ||
    !mainPrice.normalPrice ||
    mainPrice.salePrice >= mainPrice.normalPrice
  ) {
    return {
      salePrice: null,
      discountRate: 0,
      isOnSale: false,
      saleEndAt: null,
    };
  }

  return {
    salePrice: mainPrice.salePrice,
    discountRate: Math.round(
      ((mainPrice.normalPrice - mainPrice.salePrice) / mainPrice.normalPrice) * 100,
    ),
    isOnSale: true,
    saleEndAt: requestedSaleEndAt,
  };
}

export function deriveWorkPriceSummary(
  prices: PriceInfo[],
  requestedSaleEndAt: Date | null,
) {
  const mainPrice = prices
    .filter((price) => price.normalPrice != null)
    .sort((a, b) => a.normalPrice! - b.normalPrice!)[0];

  const rentalPrice = prices.find(
    (price) => price.period === "7日間" && price.normalPrice != null,
  );
  const isBottomPrice = (rentalPrice?.normalPrice ?? Infinity) <= 300;
  const price = mainPrice?.normalPrice ?? mainPrice?.salePrice ?? null;
  const maxDiscountRate = getMaximumDiscountRate(prices);
  const sale = getActiveSaleSummary(mainPrice, requestedSaleEndAt);

  return {
    mainPrice,
    isBottomPrice,
    price,
    ...sale,
    maxDiscountRate,
  };
}
