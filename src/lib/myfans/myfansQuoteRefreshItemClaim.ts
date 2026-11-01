export function buildQuoteRefreshItemClaim(
  attempts: number,
  processedAt: string,
  startedAt: string,
) {
  return {
    status: "running",
    attempts: attempts + 1,
    processed_at: processedAt,
    started_at: startedAt,
    finished_at: null,
    request_type: "quote_scan",
    result_code: null,
    http_status: null,
    diagnostics: {},
    error: null,
  };
}
