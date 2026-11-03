export interface RankingProduct {
  productId: string;
  ranking: number;
  listPrice: number | null;
  salePrice: number | null;
}

export function parseRankingProductId(href: string | null | undefined) {
  return href?.match(/id=([^&]+)/)?.[1] ?? null;
}

function parseCardPrices(priceText: string) {
  const numbers =
    priceText.match(/\d[\d,]*/g)?.map((value) =>
      Number(value.replace(/,/g, "")),
    ) ?? [];

  if (numbers.length >= 2) {
    return { listPrice: numbers[0], salePrice: numbers[1] };
  }

  return {
    listPrice: numbers[0] ?? null,
    salePrice: null,
  };
}

export function buildRankingProduct(
  productId: string,
  ranking: number,
  priceText: string,
): RankingProduct {
  return {
    productId,
    ranking,
    ...parseCardPrices(priceText),
  };
}
