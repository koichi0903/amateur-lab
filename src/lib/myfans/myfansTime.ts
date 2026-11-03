export function cutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function inPeriod(value: string | null | undefined, days: number) {
  return Boolean(value && value >= cutoffIso(days));
}

export function daysBetweenDates(laterDate: string, earlierDate: string) {
  const later = new Date(`${laterDate}T00:00:00+09:00`).getTime();
  const earlier = new Date(`${earlierDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.floor((later - earlier) / 86_400_000);
}

export function daysSinceIso(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}
