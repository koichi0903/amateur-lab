import type { PriceHistoryItem } from "@/types/price";

export function parsePriceHistoryDate(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);

  return new Date(hasTimeZone ? value : `${value}Z`);
}

export function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, "").trim();
}

export function formatDisplayName(name: string) {
  return normalizeDisplayName(name).replace(/\+/g, " ＋ ");
}

export function createChartData(
  history: PriceHistoryItem[],
  displayName: string,
  period: string | null = null,
) {
  const target = normalizeDisplayName(displayName);

  return history
    .filter(
      (item) =>
        normalizeDisplayName(item.display_name) === target &&
        (item.period ?? null) === period
    )
    .map((item) => ({
      changed_at: item.changed_at,
      date: parsePriceHistoryDate(item.changed_at).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      price: item.sale_price ?? item.normal_price ?? 0,
    }))
    .sort(
      (a, b) =>
        parsePriceHistoryDate(a.changed_at).getTime() -
        parsePriceHistoryDate(b.changed_at).getTime()
    );
}
