export type PriceItem = {
  id?: number;
  display_name: string | null;
  type?: string | null;
  period?: string | null;
  price_kind?: "regular" | "sale" | null;
  normal_price: number | null;
  sale_price: number | null;
};

export type PricedPriceItem = PriceItem & { effectivePrice: number };

export type PriceTypeRowPresentation = {
  key: number | string;
  label: string;
  isSale: boolean;
  isCheapest: boolean;
  showNormalPrice: boolean;
};

function getPriceTypeRowKey(item: PricedPriceItem, index: number) {
  return (
    item.id ??
    `${item.type ?? ""}-${item.display_name ?? index}-${item.period ?? ""}`
  );
}

function hasDiscountedPrice(item: PricedPriceItem) {
  return (
    item.sale_price != null &&
    item.normal_price != null &&
    item.sale_price < item.normal_price
  );
}

function shouldShowNormalPrice(item: PricedPriceItem) {
  return Boolean(
    item.sale_price &&
      item.normal_price &&
      item.sale_price < item.normal_price,
  );
}

export function getPriceTypeRowPresentation(
  item: PricedPriceItem,
  index: number,
): PriceTypeRowPresentation {
  return {
    key: getPriceTypeRowKey(item, index),
    label: item.display_name ?? item.type ?? "販売価格",
    isSale:
      (item.price_kind ??
        (hasDiscountedPrice(item) ? "sale" : "regular")) === "sale",
    isCheapest: index === 0,
    showNormalPrice: shouldShowNormalPrice(item),
  };
}
