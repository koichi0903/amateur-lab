export type MyfansAnalyticsLoadError = { message: string };

export function ignoreUnavailableOptionalMyfansTable(
  error: MyfansAnalyticsLoadError | null | undefined,
) {
  if (!error) return null;
  return /myfans_post_product_linkage_evidence|myfans_permanent_candidate_exclusions|schema cache|does not exist/i.test(error.message)
    ? null
    : error;
}

export function firstMyfansAnalyticsLoadError(
  errors: Array<MyfansAnalyticsLoadError | null | undefined>,
) {
  return errors.find(Boolean) ?? null;
}
