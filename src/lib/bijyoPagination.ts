export const BIJYO_MANUAL_PAGE_SIZE = 20;
export const BIJYO_RESERVED_PAGE_SIZE = 20;

export function offsetPageBounds(page: number, pageSize: number, maxPage = 100_000) {
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, maxPage) : 1;
  return { page: safePage, offset: (safePage - 1) * pageSize, limit: pageSize };
}

export function appendUniqueById<T extends { id: number }>(current: T[], next: T[]) {
  const seen = new Set(current.map((item) => item.id));
  const combined = [...current];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    combined.push(item);
  }
  return combined;
}
