export function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBatchSize(value: unknown, maxAccountsPerRun: number) {
  return Math.min(maxAccountsPerRun, Math.max(1, Math.round(numberValue(value, maxAccountsPerRun))));
}

export function normalizeQueueLimit(value: unknown) {
  const parsed = Math.round(numberValue(value, 0));
  return parsed > 0 ? Math.min(1000, parsed) : null;
}

export function normalizeTargetedCreatorIds(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return [...new Set(value.map((item) => Math.round(Number(item))).filter((item) => Number.isSafeInteger(item) && item > 0))].slice(0, 5);
}

export function normalizeQuoteRefreshCreateRequest(
  payload: Record<string, unknown>,
  maxAccountsPerRun: number,
  createId: () => string,
) {
  const batchSize = normalizeBatchSize(payload.batchSize, maxAccountsPerRun);
  return {
    approvedMediaId: numberValue(payload.approvedMediaId, 0) || null,
    batchSize,
    queueLimit: Math.min(maxAccountsPerRun, normalizeQueueLimit(payload.queueLimit) ?? batchSize),
    sessionId: cleanText(payload.sessionId) || createId(),
    runToken: cleanText(payload.runToken) || createId(),
    collectorVersion: cleanText(payload.collectorVersion) || null,
  };
}
