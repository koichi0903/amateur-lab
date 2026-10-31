import type { PriceHistoryItem } from "@/types/price";
import { parseDatabaseDate } from "@/lib/dateTime";

export function parsePriceHistoryDate(value: string) {
  return parseDatabaseDate(value) ?? new Date(value);
}

function effectiveHistoryPrice(item: PriceHistoryItem) {
  if (item.sale_price != null && item.sale_price > 0) return item.sale_price;
  if (item.normal_price != null && item.normal_price > 0) return item.normal_price;
  return 0;
}

function isSalePriceHistoryItem(item: PriceHistoryItem) {
  return item.price_kind === "sale" ||
    (item.price_kind == null &&
      item.sale_price != null &&
      item.normal_price != null &&
      item.sale_price < item.normal_price);
}

export function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, "").trim();
}

export function formatDisplayName(name: string) {
  return normalizeDisplayName(name).replace(/\+/g, " ＋ ");
}

export type PriceSeries = { displayName: string; period: string | null };

export function priceSeriesKey(series: PriceSeries) {
  return JSON.stringify([series.displayName, series.period]);
}

export function getPriceSeries(history: PriceHistoryItem[]): PriceSeries[] {
  return Array.from(
    new Map(
      history.map((item) => {
        const series = { displayName: normalizeDisplayName(item.display_name), period: item.period ?? null };
        return [priceSeriesKey(series), series] as const;
      }),
    ).values(),
  ).sort((a, b) => a.displayName.localeCompare(b.displayName) || (a.period ?? "").localeCompare(b.period ?? ""));
}

export function getDefaultPriceSeriesKey(history: PriceHistoryItem[]) {
  const defaultSale = [...history]
    .filter((item) => item.sale_price != null && item.sale_price > 0)
    .sort((a, b) => (a.sale_price ?? a.normal_price ?? 999999) - (b.sale_price ?? b.normal_price ?? 999999))[0];

  if (defaultSale) {
    return priceSeriesKey({ displayName: normalizeDisplayName(defaultSale.display_name), period: defaultSale.period ?? null });
  }

  const firstSeries = getPriceSeries(history)[0];
  return firstSeries ? priceSeriesKey(firstSeries) : "";
}

export function getPriceSeriesSummary(history: PriceHistoryItem[], selectedKey: string) {
  const series = getPriceSeries(history).find((candidate) => priceSeriesKey(candidate) === selectedKey);
  if (!series) return null;

  const entries = history
    .filter((item) => normalizeDisplayName(item.display_name) === series.displayName && (item.period ?? null) === series.period)
    .map((item) => ({ item, date: parsePriceHistoryDate(item.changed_at), price: effectiveHistoryPrice(item), isSale: isSalePriceHistoryItem(item) }))
    .filter(({ date, price }) => Number.isFinite(date.getTime()) && price > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (entries.length === 0) return null;

  const first = entries[0];
  const latest = entries[entries.length - 1];
  return {
    series,
    latest,
    lowestPrice: Math.min(...entries.map((entry) => entry.price)),
    recordCount: entries.length,
    firstDate: first.date,
    lastDate: latest.date,
  };
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
      price: effectiveHistoryPrice(item),
    }))
    .filter((item) => item.price > 0)
    .sort(
      (a, b) =>
        parsePriceHistoryDate(a.changed_at).getTime() -
        parsePriceHistoryDate(b.changed_at).getTime()
    );
}
