export const FAVORITES_STORAGE_KEY = "hakkutsu-lab:favorites:v1";
export const FAVORITES_CHANGED_EVENT = "hakkutsu-lab:favorites-changed";

export function readFavoriteIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))];
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: number[]) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

export function toggleFavorite(id: number) {
  const ids = readFavoriteIds();
  writeFavoriteIds(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
}
