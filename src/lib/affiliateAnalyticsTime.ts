import { AFFILIATE_ANALYTICS_DAY_MS } from "./affiliateAnalyticsInsights";

type ClickedAtRow = { clicked_at: string };

export function affiliateAnalyticsJstDayKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildAffiliateClickTimeMetrics(rows: ClickedAtRow[], now: Date) {
  const todayKey = affiliateAnalyticsJstDayKey(now);
  const sevenDayCutoff = now.getTime() - 7 * AFFILIATE_ANALYTICS_DAY_MS;
  const previousSevenDayCutoff = now.getTime() - 14 * AFFILIATE_ANALYTICS_DAY_MS;
  const today = rows.filter(
    (row) => affiliateAnalyticsJstDayKey(new Date(row.clicked_at)) === todayKey,
  ).length;
  const lastSevenDays = rows.filter(
    (row) => new Date(row.clicked_at).getTime() >= sevenDayCutoff,
  ).length;
  const previousSevenDays = rows.filter((row) => {
    const time = new Date(row.clicked_at).getTime();
    return time >= previousSevenDayCutoff && time < sevenDayCutoff;
  }).length;
  const growthRate = previousSevenDays > 0
    ? Math.round(((lastSevenDays - previousSevenDays) / previousSevenDays) * 100)
    : null;

  return {
    todayKey,
    sevenDayCutoff,
    previousSevenDayCutoff,
    today,
    lastSevenDays,
    previousSevenDays,
    growthRate,
  };
}

export function buildAffiliateDailyClickCounts(rows: ClickedAtRow[], now: Date, days = 14) {
  const keys = Array.from({ length: days }, (_, index) =>
    affiliateAnalyticsJstDayKey(
      new Date(now.getTime() - (days - 1 - index) * AFFILIATE_ANALYTICS_DAY_MS),
    ),
  );
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const row of rows) {
    const key = affiliateAnalyticsJstDayKey(new Date(row.clicked_at));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}
