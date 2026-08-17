export const COMPARISON_STORAGE_KEY = "hakkutsu-lab-comparison-v1";
export const COMPARISON_CHANGED_EVENT = "hakkutsu-lab-comparison-changed";
export const MAX_COMPARISON_ITEMS = 4;

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function subscribeComparison(callback: () => void) {
  subscribers.add(callback);
  if (subscribers.size === 1 && typeof window !== "undefined") {
    window.addEventListener(COMPARISON_CHANGED_EVENT, notifySubscribers);
    window.addEventListener("storage", notifySubscribers);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && typeof window !== "undefined") {
      window.removeEventListener(COMPARISON_CHANGED_EVENT, notifySubscribers);
      window.removeEventListener("storage", notifySubscribers);
    }
  };
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))]
    .slice(0, MAX_COMPARISON_ITEMS);
}

export function readComparisonIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeIds(JSON.parse(window.localStorage.getItem(COMPARISON_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeComparisonIds(ids: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(normalizeIds(ids)));
  window.dispatchEvent(new Event(COMPARISON_CHANGED_EVENT));
}

export function toggleComparison(workId: number): { added: boolean; full: boolean } {
  const ids = readComparisonIds();
  if (ids.includes(workId)) {
    writeComparisonIds(ids.filter((id) => id !== workId));
    return { added: false, full: false };
  }
  if (ids.length >= MAX_COMPARISON_ITEMS) return { added: false, full: true };
  writeComparisonIds([...ids, workId]);
  return { added: true, full: false };
}

export function removeComparison(workId: number) {
  writeComparisonIds(readComparisonIds().filter((id) => id !== workId));
}

export function clearComparison() {
  writeComparisonIds([]);
}
