export const EXTERNAL_ATTRIBUTION_CHANNELS = [
  "direct",
  "organic_search",
  "social",
  "referral",
  "internal",
] as const;

export type ExternalAttributionChannel =
  (typeof EXTERNAL_ATTRIBUTION_CHANNELS)[number];

export type ExternalAttribution = {
  channel: ExternalAttributionChannel;
  source: string;
  landingPath: string;
};

const channelSet = new Set<string>(EXTERNAL_ATTRIBUTION_CHANNELS);

export function normalizeExternalAttribution(
  value: unknown,
): ExternalAttribution | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<Record<keyof ExternalAttribution, unknown>>;
  const channel =
    typeof candidate.channel === "string" && channelSet.has(candidate.channel)
      ? (candidate.channel as ExternalAttributionChannel)
      : null;
  const source =
    typeof candidate.source === "string" ? sanitizeAttributionValue(candidate.source) : "";
  const landingPath =
    typeof candidate.landingPath === "string"
      ? sanitizeLandingPath(candidate.landingPath)
      : "";

  if (!channel || !source || !landingPath) return null;

  return {
    channel,
    source,
    landingPath,
  };
}

function sanitizeAttributionValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function sanitizeLandingPath(value: string) {
  const path = value.startsWith("/") ? value : "/";
  return path.split("#")[0].slice(0, 255);
}
