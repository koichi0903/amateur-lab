export type AffiliateClickColumnAvailability = {
  sourceAttributionEnabled: boolean;
  ctaExperimentEnabled: boolean;
  externalAttributionEnabled: boolean;
};

type FallbackFlag = keyof AffiliateClickColumnAvailability;

const FALLBACK_COLUMNS = [
  { flag: "ctaExperimentEnabled", columns: ["cta_variant"] },
  { flag: "sourceAttributionEnabled", columns: ["source_page"] },
  {
    flag: "externalAttributionEnabled",
    columns: ["external_channel", "external_source", "landing_path"],
  },
] as const satisfies ReadonlyArray<{
  flag: FallbackFlag;
  columns: readonly string[];
}>;

export function nextAffiliateClickFallback(
  errorMessage: string | null,
  availability: AffiliateClickColumnAvailability,
): FallbackFlag | null {
  if (!errorMessage) return null;

  return (
    FALLBACK_COLUMNS.find(
      ({ flag, columns }) =>
        availability[flag] &&
        columns.some((column) => errorMessage.includes(column)),
    )?.flag ?? null
  );
}
