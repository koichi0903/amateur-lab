export const DAY_MS = 86_400_000;

export function tokyoDate(daysOffset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + daysOffset * DAY_MS));
}

export function daysSince(value: string | null) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / DAY_MS) : Infinity;
}

export function hoursUntil(value: string | null) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? (time - Date.now()) / 3_600_000 : Infinity;
}

