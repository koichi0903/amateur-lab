export type CompanionErrorInfo = {
  errorCode: string;
  errorMessage: string;
  errorStage: string;
  reason?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

export function normalizeCompanionError(error: unknown, errorStage: string): CompanionErrorInfo {
  if (error instanceof Error) {
    const structured = error as Error & { code?: unknown; errorCode?: unknown; errorStage?: unknown; reason?: unknown };
    return {
      errorCode: text(structured.errorCode || structured.code) || "UNKNOWN_ERROR",
      errorMessage: text(structured.message) || "不明なエラーです。",
      errorStage: text(structured.errorStage) || errorStage,
      ...(text(structured.reason) ? { reason: text(structured.reason) } : {}),
    };
  }
  if (error && typeof error === "object") {
    const structured = error as Record<string, unknown>;
    return {
      errorCode: text(structured.errorCode || structured.code) || "UNKNOWN_ERROR",
      errorMessage: text(structured.errorMessage || structured.message || structured.details || structured.hint) || "構造化されたエラーが返されました。",
      errorStage: text(structured.errorStage || structured.stage) || errorStage,
      ...(text(structured.reason) ? { reason: text(structured.reason) } : {}),
    };
  }
  return { errorCode: "UNKNOWN_ERROR", errorMessage: text(error) || "不明なエラーです。", errorStage };
}

export function companionPersistenceError(error: unknown, errorStage: string, reason?: string) {
  const normalized = normalizeCompanionError(error, errorStage);
  const wrapped = new Error(normalized.errorMessage);
  Object.assign(wrapped, { ...normalized, reason: reason || normalized.reason });
  return wrapped;
}
