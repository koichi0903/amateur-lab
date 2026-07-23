import type { PriceHistoryItem } from "@/types/price";

export function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, "").trim();
}

export function formatDisplayName(name: string) {
  return normalizeDisplayName(name).replace(/\+/g, " ＋ ");
}

export function createChartData(
  history: PriceHistoryItem[],
  displayName: string
) {
  const target = normalizeDisplayName(displayName);

  return history
    .filter(
      (item) =>
        normalizeDisplayName(item.display_name) === target
    )
    .map((item) => ({
      changed_at: item.changed_at,
      date: new Date(item.changed_at).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      price: item.sale_price ?? item.normal_price ?? 0,
    }))
    .sort(
      (a, b) =>
        new Date(a.changed_at).getTime() -
        new Date(b.changed_at).getTime()
    );
}