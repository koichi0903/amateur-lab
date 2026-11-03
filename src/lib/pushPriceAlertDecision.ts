export type PriceAlertDecision = "initialize" | "advance_baseline" | "unchanged" | "notify";

export function decidePriceAlert(currentPrice: number, lastNotifiedPrice: number | null): PriceAlertDecision {
  if (lastNotifiedPrice === null) return "initialize";
  if (currentPrice === lastNotifiedPrice) return "unchanged";
  return currentPrice > lastNotifiedPrice ? "advance_baseline" : "notify";
}

export function isGonePushEndpointError(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}
