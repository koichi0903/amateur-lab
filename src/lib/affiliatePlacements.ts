export const AFFILIATE_PLACEMENTS = [
  "listing-card",
  "detail-sidebar",
  "buy-timing-panel",
  "mobile-sticky",
  "compare-card",
  "sample-movie-fallback",
] as const;

export type AffiliatePlacement = (typeof AFFILIATE_PLACEMENTS)[number];

const affiliatePlacementSet = new Set<string>(AFFILIATE_PLACEMENTS);

export function isAffiliatePlacement(value: unknown): value is AffiliatePlacement {
  return typeof value === "string" && affiliatePlacementSet.has(value);
}
