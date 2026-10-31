export type FanzaAmateurApiPageItem = Record<string, unknown> & { content_id?: unknown };

export type CatalogItemPrice = { currentPrice: number | null };

export function countInvalidCatalogContentIds(items: FanzaAmateurApiPageItem[]) {
  return items.filter((item) => typeof item?.content_id !== "string" || !item.content_id.trim()).length;
}

export function catalogContentIds(items: FanzaAmateurApiPageItem[]) {
  return items.map((item) => String(item.content_id).trim());
}

export function collectCatalogItemKeyPaths(value: unknown, prefix = "", paths = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    const arrayPath = `${prefix}[]`;
    paths.add(arrayPath);
    for (const entry of value) collectCatalogItemKeyPaths(entry, arrayPath, paths);
    return paths;
  }
  if (value && typeof value === "object") {
    if (prefix) paths.add(prefix);
    for (const [key, entry] of Object.entries(value)) {
      collectCatalogItemKeyPaths(entry, prefix ? `${prefix}.${key}` : key, paths);
    }
    return paths;
  }
  if (prefix) paths.add(prefix);
  return paths;
}

export function observedCatalogItemKeyPaths(previous: string[], items: FanzaAmateurApiPageItem[]) {
  const paths = new Set(previous);
  for (const item of items) {
    for (const path of collectCatalogItemKeyPaths(item)) paths.add(path);
  }
  return [...paths].sort();
}

export function catalogItemChangeIds(
  items: FanzaAmateurApiPageItem[],
  existingById: Map<string, unknown>,
  normalizeItem: (value: unknown) => CatalogItemPrice | null,
) {
  const newContentIds: string[] = [];
  const changedPriceContentIds: string[] = [];
  for (const item of items) {
    const contentId = String(item.content_id).trim();
    if (!existingById.has(contentId)) {
      newContentIds.push(contentId);
      continue;
    }
    const previousItem = normalizeItem(existingById.get(contentId));
    const incomingItem = normalizeItem(item);
    if (previousItem?.currentPrice != null && incomingItem?.currentPrice != null && previousItem.currentPrice !== incomingItem.currentPrice) {
      changedPriceContentIds.push(contentId);
    }
  }
  return { newContentIds, changedPriceContentIds };
}
