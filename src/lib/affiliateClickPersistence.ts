import type { AffiliatePlacement } from "./affiliatePlacements";
import type { CtaVariant } from "./ctaExperiment";
import type { AffiliateSource } from "./affiliateTracking";
import type { ExternalAttributionChannel } from "./externalAttribution";

export type AffiliateClickInsertRecord = {
  work_id: number;
  placement: AffiliatePlacement;
  source_page: AffiliateSource;
  cta_variant?: CtaVariant | undefined;
  x_post_key?: string | null | undefined;
  external_channel?: ExternalAttributionChannel | undefined;
  external_source?: string | undefined;
  landing_path?: string | undefined;
};

export type AffiliateClickInsertError = {
  code?: string | null;
  message?: string | null;
};

type FallbackStage = "full" | "without_x_post_key" | "without_attribution" | "without_cta_variant";

type NextFallback = {
  record: AffiliateClickInsertRecord;
  stage: FallbackStage;
};

function isMissingCtaVariant(error: AffiliateClickInsertError) {
  return error.code === "PGRST204" || error.message?.includes("cta_variant");
}

function isMissingAttribution(error: AffiliateClickInsertError) {
  return (
    error.code === "PGRST204" ||
    error.message?.includes("external_channel") ||
    error.message?.includes("external_source") ||
    error.message?.includes("landing_path")
  );
}

function isMissingXPostKey(error: AffiliateClickInsertError) {
  return error.code === "PGRST204" || error.message?.includes("x_post_key");
}

function withoutXPostKey(record: AffiliateClickInsertRecord) {
  const fallback = { ...record };
  delete fallback.x_post_key;
  return fallback;
}

function withCoreAndCtaVariant(record: AffiliateClickInsertRecord): AffiliateClickInsertRecord {
  return {
    work_id: record.work_id,
    placement: record.placement,
    source_page: record.source_page,
    cta_variant: record.cta_variant,
  };
}

function withCoreFields(record: AffiliateClickInsertRecord): AffiliateClickInsertRecord {
  return {
    work_id: record.work_id,
    placement: record.placement,
    source_page: record.source_page,
  };
}

function getNextFallback(
  record: AffiliateClickInsertRecord,
  error: AffiliateClickInsertError,
  stage: FallbackStage,
): NextFallback | null {
  if (stage === "without_cta_variant") return null;

  if (stage === "full" && isMissingXPostKey(error)) {
    return { record: withoutXPostKey(record), stage: "without_x_post_key" };
  }

  if (stage !== "without_attribution" && isMissingAttribution(error)) {
    return { record: withCoreAndCtaVariant(record), stage: "without_attribution" };
  }

  if (isMissingCtaVariant(error)) {
    return { record: withCoreFields(record), stage: "without_cta_variant" };
  }

  return null;
}

export async function insertAffiliateClickWithSchemaFallback<TError extends AffiliateClickInsertError>(
  record: AffiliateClickInsertRecord,
  insert: (value: AffiliateClickInsertRecord) => PromiseLike<{ error: TError | null }>,
): Promise<TError | null> {
  let result = await insert(record);
  let stage: FallbackStage = "full";

  while (result.error) {
    const fallback = getNextFallback(record, result.error, stage);
    if (!fallback) break;

    stage = fallback.stage;
    result = await insert(fallback.record);
  }

  return result.error;
}
