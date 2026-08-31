export function parseDatabaseDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatJapanDateTime(value: string | null | undefined) {
  const date = parseDatabaseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}
