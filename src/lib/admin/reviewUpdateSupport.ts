const RETRYABLE_CODES = new Set([
  "57014",
  "PGRST000",
  "PGRST001",
  "PGRST002",
  "PGRST003",
]);

const RETRYABLE_MESSAGE = /timeout|timed out|fetch failed|connect|network|socket/i;

function errorFields(error: unknown) {
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === "string" ? candidate.code.trim() : "",
    message:
      typeof candidate.message === "string" ? candidate.message.trim() : "",
    details:
      typeof candidate.details === "string" ? candidate.details.trim() : "",
    hint: typeof candidate.hint === "string" ? candidate.hint.trim() : "",
  };
}

export function describeReviewUpdateError(error: unknown): string {
  const fields = errorFields(error);
  if (fields) {
    const parts = [
      fields.code ? `code=${fields.code}` : "",
      fields.message,
      fields.details ? `details=${fields.details}` : "",
      fields.hint ? `hint=${fields.hint}` : "",
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");

    try {
      const meaningfulEntries = Object.entries(
        error as Record<string, unknown>,
      ).filter(([, value]) =>
        value !== null && value !== undefined && value !== ""
      );
      const serialized = meaningfulEntries.length > 0
        ? JSON.stringify(Object.fromEntries(meaningfulEntries))
        : "";
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to a stable message.
    }
  }

  if (typeof error === "string" && error.trim()) return error.trim();
  return "詳細のないデータベースエラー";
}

export function isRetryableReviewUpdateError(error: unknown): boolean {
  const fields = errorFields(error);
  if (!fields) return false;

  return (
    RETRYABLE_CODES.has(fields.code) ||
    RETRYABLE_MESSAGE.test(
      [fields.message, fields.details, fields.hint].filter(Boolean).join(" "),
    )
  );
}

export async function withReviewDatabaseRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = Math.max(0, options.delayMs ?? 750);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetryableReviewUpdateError(error)) {
        throw error;
      }

      const waitMs = delayMs * attempt;
      console.warn(
        `[review-update] ${label}を再試行します (${attempt}/${attempts}, ${waitMs}ms): ${describeReviewUpdateError(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error(`${label}の再試行回数を使い切りました。`);
}
