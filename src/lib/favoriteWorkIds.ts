export function parseFavoriteWorkIds(body: unknown): number[] {
  const rawIds = body && typeof body === "object" && "ids" in body
    ? (body as { ids?: unknown }).ids
    : null;

  return Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 200)
    : [];
}
