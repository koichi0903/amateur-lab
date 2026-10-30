export type SemiNewWorkRefreshAssessmentInput = {
  dbPrice: number | null;
  latestPrice: number | null;
  isPending: boolean;
  isUnavailable: boolean;
  isMissingData: boolean;
  captureSampleMovie: boolean;
};

export function assessSemiNewWorkRefresh(input: SemiNewWorkRefreshAssessmentInput) {
  const isPriceChanged = input.latestPrice != null && input.dbPrice !== input.latestPrice;
  const shouldSkip =
    !input.isPending &&
    !input.isUnavailable &&
    !input.isMissingData &&
    input.dbPrice != null &&
    input.latestPrice != null &&
    !isPriceChanged &&
    !input.captureSampleMovie;
  const reasons = [
    input.isPending ? "PENDING" : null,
    input.isUnavailable ? "UNAVAILABLE" : null,
    input.isMissingData ? "MISSING_DATA" : null,
    isPriceChanged ? "PRICE_CHANGED" : null,
    input.latestPrice == null ? "LIST_PRICE_MISSING" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return { shouldSkip, reasons };
}
