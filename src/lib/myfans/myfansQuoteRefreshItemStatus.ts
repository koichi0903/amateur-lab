export type QuoteRefreshInputStatus = "success" | "failed";
export type QuoteRefreshFinalStatus = QuoteRefreshInputStatus | "skipped" | "pending";

export function resolveQuoteRefreshFinalStatus({
  status,
  errorCode,
  attempts,
  nonRetryableErrors,
}: {
  status: QuoteRefreshInputStatus;
  errorCode: string;
  attempts: number;
  nonRetryableErrors: ReadonlySet<string>;
}) {
  const retryableWithinJob = status === "failed" && errorCode !== "" && attempts < 3;
  const finalStatus: QuoteRefreshFinalStatus = status === "failed" && nonRetryableErrors.has(errorCode)
    ? "skipped"
    : retryableWithinJob
      ? "pending"
      : status;
  return {
    finalStatus,
    terminal: finalStatus === "success" || finalStatus === "failed" || finalStatus === "skipped",
  };
}
