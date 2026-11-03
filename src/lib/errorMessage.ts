function readStringField(value: object, field: string): string | null {
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

export function simpleErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

function formatNativeError(error: Error): string {
  const ownMessage = error.message.trim();
  const causeMessage = error.cause ? formatUnknownError(error.cause) : null;
  if (ownMessage && causeMessage && causeMessage !== ownMessage) {
    return `${ownMessage} (${causeMessage})`;
  }
  if (ownMessage) return ownMessage;
  if (causeMessage) return causeMessage;
  return error.name || "不明なエラー";
}

function structuredErrorFields(error: object) {
  const fields = ["message", "details", "hint", "code"]
    .map((field) => readStringField(error, field))
    .filter((value): value is string => Boolean(value));
  const cause = (error as { cause?: unknown }).cause;
  if (cause) fields.push(formatUnknownError(cause));
  return fields;
}

function serializedErrorDetails(error: object): string | null {
  try {
    const meaningfulEntries = Object.entries(error).filter(([, value]) =>
      value !== null && value !== undefined && value !== "",
    );
    const serialized = JSON.stringify(Object.fromEntries(meaningfulEntries));
    return serialized && serialized !== "{}" ? serialized : null;
  } catch {
    // Circular error objects fall through to the stable fallback below.
    return null;
  }
}

function formatErrorObject(error: object): string {
  const fields = structuredErrorFields(error);
  if (fields.length > 0) return [...new Set(fields)].join(" | ");
  return serializedErrorDetails(error) ?? "詳細のない通信エラー";
}

export function formatUnknownError(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();

  if (error instanceof Error) return formatNativeError(error);
  if (typeof error === "object" && error !== null) return formatErrorObject(error);

  return String(error ?? "不明なエラー");
}
