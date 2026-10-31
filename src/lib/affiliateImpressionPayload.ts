import type { AffiliatePlacement } from "./affiliatePlacements";
import { normalizeAffiliateSource, type AffiliateSource } from "./affiliateTracking";
import { normalizeCtaVariant, type CtaVariant } from "./ctaExperiment";

const experimentPlacements = new Set<AffiliatePlacement>(["detail-sidebar", "mobile-sticky"]);

export type AffiliateImpressionEvent = {
  workId: number;
  placement: AffiliatePlacement;
  sourcePage: AffiliateSource;
  ctaVariant: CtaVariant;
  xPostKey: string | null;
};

function getPayloadValue(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object" || !(key in payload)) return null;
  return (payload as Record<string, unknown>)[key];
}

function getOptionalString(payload: unknown, key: string): string | null {
  const value = getPayloadValue(payload, key);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

export function parseAffiliateImpressionPayload(payload: unknown): AffiliateImpressionEvent | null {
  const workId = Number(getPayloadValue(payload, "workId"));
  const placement = getPayloadValue(payload, "placement");
  const sourceValue = getPayloadValue(payload, "sourcePage");
  const sourcePage = normalizeAffiliateSource(typeof sourceValue === "string" ? sourceValue : null);
  const ctaVariant = normalizeCtaVariant(getPayloadValue(payload, "ctaVariant"));
  const xPostKey = getOptionalString(payload, "xPostKey");

  if (
    !Number.isSafeInteger(workId) ||
    workId <= 0 ||
    typeof placement !== "string" ||
    !experimentPlacements.has(placement as AffiliatePlacement)
  ) return null;

  return { workId, placement: placement as AffiliatePlacement, sourcePage, ctaVariant, xPostKey };
}
