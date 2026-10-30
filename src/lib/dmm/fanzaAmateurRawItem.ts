export function getFanzaAmateurPriceFromRawItem(rawItem: unknown): number | null {
  if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return null;
  const prices = (rawItem as Record<string, unknown>).prices;
  if (typeof prices !== "object" || prices === null || Array.isArray(prices)) return null;

  const rawPrice = (prices as Record<string, unknown>).price;
  const digits = typeof rawPrice === "number"
    ? String(rawPrice)
    : typeof rawPrice === "string"
      ? rawPrice.match(/[0-9]+/)?.[0]
      : null;
  const price = digits ? Number(digits) : NaN;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}
