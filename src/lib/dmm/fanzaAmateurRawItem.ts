function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function priceDigits(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.match(/[0-9][0-9,]*/)?.[0]?.replaceAll(",", "") ?? null;
  return null;
}

export function getFanzaAmateurPriceFromRawItem(rawItem: unknown): number | null {
  if (!isRecord(rawItem)) return null;
  const prices = rawItem.prices;
  if (!isRecord(prices)) return null;

  for (const value of [prices.price, prices.list_price]) {
    const digits = priceDigits(value);
    const price = digits ? Number(digits) : NaN;
    if (Number.isSafeInteger(price) && price > 0) return price;
  }
  return null;
}
