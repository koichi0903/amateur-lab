export type CompanionErrorInfo = {
  errorCode: string;
  errorMessage: string;
  errorStage: string;
  reason?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

function optionalReason(reason: unknown) {
  const normalizedReason = text(reason);
  return normalizedReason ? { reason: normalizedReason } : {};
}

function normalizeErrorInstance(error: Error, fallbackStage: string): CompanionErrorInfo {
  const structured = error as Error & { code?: unknown; errorCode?: unknown; errorStage?: unknown; reason?: unknown };
  return {
    errorCode: text(structured.errorCode || structured.code) || "UNKNOWN_ERROR",
    errorMessage: text(structured.message) || "不明なエラーです。",
    errorStage: text(structured.errorStage) || fallbackStage,
    ...optionalReason(structured.reason),
  };
}

function structuredErrorMessage(error: Record<string, unknown>) {
  return text(error.errorMessage || error.message || error.details || error.hint)
    || "構造化されたエラーが返されました。";
}

function normalizeErrorObject(error: Record<string, unknown>, fallbackStage: string): CompanionErrorInfo {
  return {
    errorCode: text(error.errorCode || error.code) || "UNKNOWN_ERROR",
    errorMessage: structuredErrorMessage(error),
    errorStage: text(error.errorStage || error.stage) || fallbackStage,
    ...optionalReason(error.reason),
  };
}

function normalizePrimitiveError(error: unknown, errorStage: string): CompanionErrorInfo {
  return {
    errorCode: "UNKNOWN_ERROR",
    errorMessage: text(error) || "不明なエラーです。",
    errorStage,
  };
}

export function normalizeCompanionError(error: unknown, errorStage: string): CompanionErrorInfo {
  if (error instanceof Error) return normalizeErrorInstance(error, errorStage);
  if (error && typeof error === "object") {
    return normalizeErrorObject(error as Record<string, unknown>, errorStage);
  }
  return normalizePrimitiveError(error, errorStage);
}

export function companionPersistenceError(error: unknown, errorStage: string, reason?: string) {
  const normalized = normalizeCompanionError(error, errorStage);
  const wrapped = new Error(normalized.errorMessage);
  Object.assign(wrapped, { ...normalized, reason: reason || normalized.reason });
  return wrapped;
}
