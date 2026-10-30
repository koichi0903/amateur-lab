import { normalizeDisplayName } from "@/lib/createChartData";
import { parseDatabaseDate } from "@/lib/dateTime";
import type { PriceHistoryRow } from "./xPostPlannerData";

export type XChartPoint = { changedAt: string; price: number };

export type XPostPriceChart = {
  points: XChartPoint[];
  previousPrice: number | null;
  hadPriceDrop: boolean;
  seriesName: string;
  seriesPeriod: string | null;
  seriesMinimumPrice: number;
  seriesMaximumPrice: number;
  seriesObservationCount: number;
  seriesStartedAt: string | null;
  seriesLowestAt: string | null;
  newRecordedLowToday: boolean | null;
  isNinetyDayLow: boolean;
  checkedAt: string;
};

const databaseDateTime = (value: string) => parseDatabaseDate(value)?.getTime() ?? Number.NaN;

function effectivePrice(row: PriceHistoryRow) {
  return row.sale_price && row.sale_price > 0
    ? row.sale_price
    : row.normal_price && row.normal_price > 0 ? row.normal_price : null;
}

function todayKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function newRecordedLowToday(
  series: Array<PriceHistoryRow & { value: number }>,
  livePrice: number,
  now: Date,
) {
  if (series.length < 2 || series.at(-1)?.value !== livePrice) return null;
  const latest = series.at(-1)!;
  const latestJst = todayKey(new Date(latest.changed_at));
  if (latestJst !== todayKey(now)) return false;
  const previous = series.slice(0, -1).map((row) => row.value);
  return previous.length ? livePrice < Math.min(...previous) : null;
}

export function buildXPostPriceChart(livePrice: number | null, rows: PriceHistoryRow[], now = new Date()): XPostPriceChart | null {
  if (!livePrice) return null;
  const sorted = rows
    .map((row) => ({ ...row, value: effectivePrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => row.value !== null)
    .sort((a, b) => databaseDateTime(b.changed_at) - databaseDateTime(a.changed_at));
  const latestMatching = sorted.find((row) => row.value === livePrice);
  if (!latestMatching) return null;
  const seriesName = normalizeDisplayName(latestMatching.display_name);
  const seriesPeriod = latestMatching.period ?? null;
  const series = sorted
    .filter((row) => normalizeDisplayName(row.display_name) === seriesName && (row.period ?? null) === seriesPeriod)
    .sort((a, b) => databaseDateTime(a.changed_at) - databaseDateTime(b.changed_at));
  if (!series.length || series.at(-1)?.value !== livePrice) return null;

  const previousPrice = [...series].reverse().find((row) => row.value !== livePrice)?.value ?? null;
  const checkedAt = series.at(-1)?.changed_at ?? new Date().toISOString();
  const seriesPrices = series.map((row) => row.value);
  const seriesMinimumPrice = Math.min(...seriesPrices);
  const seriesMaximumPrice = Math.max(...seriesPrices);
  const seriesLowestAt = series.find((row) => row.value === seriesMinimumPrice)?.changed_at ?? null;
  // Keep the same observations as the work-detail chart. Collapsing equal prices
  // changes the horizontal proportions and can make the mini chart tell a
  // different story even when both charts use the same price series.
  const points = series.slice(-8).map((row) => ({ changedAt: row.changed_at, price: row.value }));
  return {
    points: points.length >= 2 ? points : [
      { changedAt: checkedAt, price: livePrice },
      { changedAt: checkedAt, price: livePrice },
    ],
    previousPrice,
    hadPriceDrop: Boolean(previousPrice && previousPrice > livePrice),
    seriesName: latestMatching.display_name,
    seriesPeriod,
    seriesMinimumPrice,
    seriesMaximumPrice,
    seriesObservationCount: series.length,
    seriesStartedAt: series.at(0)?.changed_at ?? null,
    seriesLowestAt,
    newRecordedLowToday: newRecordedLowToday(series, livePrice, now),
    isNinetyDayLow: seriesMinimumPrice === livePrice && series.some((row) => row.value > livePrice),
    checkedAt,
  };
}
