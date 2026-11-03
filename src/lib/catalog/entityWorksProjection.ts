export function preserveWorkOrderByIds<T extends { id: number }>(ids: readonly number[], works: readonly T[]): T[] {
  const worksById = new Map(works.map((work) => [work.id, work]));
  return ids.flatMap((id) => {
    const work = worksById.get(id);
    return work ? [work] : [];
  });
}

export type PriceWorkRow = { id: number; price: number | null; sale_price: number | null };
export type PriceWorkSort = "price-asc" | "price-desc";

export function priceSortedWorkIds(rows: readonly PriceWorkRow[], sort: PriceWorkSort, offset: number, limit: number) {
  const currentPrice = (row: PriceWorkRow) => row.sale_price != null && row.sale_price > 0 ? row.sale_price : row.price ?? 0;
  const sorted = [...rows].sort((a, b) => sort === "price-asc"
    ? currentPrice(a) - currentPrice(b) || b.id - a.id
    : currentPrice(b) - currentPrice(a) || b.id - a.id);
  return sorted.slice(offset, offset + limit).map((row) => row.id);
}
