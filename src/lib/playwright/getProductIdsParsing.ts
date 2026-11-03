export interface ProductSummary {
  productId: string;
  url: string;
  listPrice: number | null;
  salePrice: number | null;
}

export function parseFanzaTotalPages(pageText: string) {
  return Number(pageText.match(/全(\d+)ページ中/)?.[1] ?? 1);
}

export function parseFanzaProductId(href: string) {
  return href.match(/id=([^&]+)/)?.[1] ?? null;
}

export function parseFanzaPrices(priceText: string) {
  const numbers =
    priceText.match(/\d[\d,]*/g)?.map((value) =>
      Number(value.replace(/,/g, "")),
    ) ?? [];

  if (numbers.length === 1) {
    return { listPrice: numbers[0], salePrice: null };
  }
  if (numbers.length >= 2) {
    return { listPrice: numbers[0], salePrice: numbers[1] };
  }
  return { listPrice: null, salePrice: null };
}
