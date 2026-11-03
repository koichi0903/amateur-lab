import { isAffiliatePlacement, type AffiliatePlacement } from "./affiliatePlacements";
import { normalizeAffiliateSource, type AffiliateSource } from "./affiliateTracking";
import { normalizeCtaVariant, type CtaVariant } from "./ctaExperiment";
import { normalizeExternalAttribution, type ExternalAttribution } from "./externalAttribution";

export type AffiliateClickEvent = {
  workId: number;
  placement: AffiliatePlacement;
  sourcePage: AffiliateSource;
  ctaVariant: CtaVariant;
  xPostKey: string | null;
  externalAttribution: ExternalAttribution | null;
};

function getPayloadValue(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object" || !(key in payload)) return null;
  return (payload as Record<string, unknown>)[key];
}

function getXPostKey(payload: unknown): string | null {
  const value = getPayloadValue(payload, "xPostKey");
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

export function parseAffiliateClickPayload(payload: unknown): AffiliateClickEvent | null {
  const workId = Number(getPayloadValue(payload, "workId"));
  const placement = getPayloadValue(payload, "placement");
  const sourceValue = getPayloadValue(payload, "sourcePage");
  const sourcePage = normalizeAffiliateSource(typeof sourceValue === "string" ? sourceValue : null);
  const ctaVariant = normalizeCtaVariant(getPayloadValue(payload, "ctaVariant"));
  const externalAttribution = normalizeExternalAttribution(getPayloadValue(payload, "externalAttribution"));

  if (!Number.isSafeInteger(workId) || workId <= 0 || !isAffiliatePlacement(placement)) return null;

  return {
    workId,
    placement,
    sourcePage,
    ctaVariant,
    xPostKey: getXPostKey(payload),
    externalAttribution,
  };
}
