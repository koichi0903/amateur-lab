const DAY_MS = 24 * 60 * 60 * 1000;

export function jstDateDaysAgo(daysAgo: number, now = new Date()) {
  const localToday = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo",
  }).format(now);
  return new Date(Date.parse(`${localToday}T00:00:00+09:00`) - daysAgo * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
