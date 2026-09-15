function readStringField(value: object, field: string): string | null {
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

export function formatUnknownError(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();

  if (error instanceof Error) {
    const ownMessage = error.message.trim();
    const causeMessage = error.cause ? formatUnknownError(error.cause) : null;
    if (ownMessage && causeMessage && causeMessage !== ownMessage) {
      return `${ownMessage} (${causeMessage})`;
    }
    if (ownMessage) return ownMessage;
    if (causeMessage) return causeMessage;
    return error.name || "不明なエラー";
  }

  if (typeof error === "object" && error !== null) {
    const fields = ["message", "details", "hint", "code"]
      .map((field) => readStringField(error, field))
      .filter((value): value is string => Boolean(value));
    const cause = (error as { cause?: unknown }).cause;
    if (cause) fields.push(formatUnknownError(cause));
    if (fields.length > 0) return [...new Set(fields)].join(" | ");

    try {
      const meaningfulEntries = Object.entries(error).filter(([, value]) =>
        value !== null && value !== undefined && value !== "",
      );
      const serialized = JSON.stringify(Object.fromEntries(meaningfulEntries));
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Circular error objects fall through to the stable fallback below.
    }

    return "詳細のない通信エラー";
  }

  return String(error ?? "不明なエラー");
}
