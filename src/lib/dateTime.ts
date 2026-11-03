export function parseDatabaseDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const JAPAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

/** Formats an ISO timestamp using the same Date parsing semantics as the UI call sites. */
export function formatJstDateTime(value: string) {
  return JAPAN_DATE_TIME_FORMATTER.format(new Date(value));
}

export function formatJapanDateTime(value: string | null | undefined) {
  const date = parseDatabaseDate(value);
  if (!date) return null;

  return JAPAN_DATE_TIME_FORMATTER.format(date);
}
