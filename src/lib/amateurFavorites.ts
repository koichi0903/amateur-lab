export const AMATEUR_FAVORITES_STORAGE_KEY = "fanza-amateur-favorites";
export const AMATEUR_FAVORITES_CHANGED_EVENT = "hakkutsu-lab:amateur-favorites-changed";

export function readAmateurFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(AMATEUR_FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))];
  } catch {
    return [];
  }
}

export function toggleAmateurFavorite(contentId: string) {
  const ids = readAmateurFavoriteIds();
  const next = ids.includes(contentId) ? ids.filter((id) => id !== contentId) : [...ids, contentId];
  window.localStorage.setItem(AMATEUR_FAVORITES_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(AMATEUR_FAVORITES_CHANGED_EVENT));
}
