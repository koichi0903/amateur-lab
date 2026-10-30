export function parseRuntimeMinutes(duration: number | string | null): number | null {
  if (typeof duration === "number") return Number.isFinite(duration) ? duration : null;
  if (!duration) return null;
  const hours = duration.match(/(\d+)\s*時間/);
  const minutes = duration.match(/(\d+)\s*分/);
  if (hours || minutes) return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  const numeric = Number(duration.match(/\d+/)?.[0]);
  return Number.isFinite(numeric) ? numeric : null;
}
