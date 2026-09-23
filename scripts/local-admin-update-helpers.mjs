export function summarizeResponseBody(body, maxLength = 240) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "(空の応答)";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function describeReadinessFailure({ phase, status, body, error, timeoutMs }) {
  const details = [`phase=${phase}`];
  if (status != null) details.push(`HTTP ${status}`);
  if (body != null) details.push(`body=${summarizeResponseBody(body)}`);
  if (error) details.push(`error=${error instanceof Error ? error.message : String(error)}`);
  if (timeoutMs != null) details.push(`timeout=${timeoutMs}ms`);
  return details.join(" ");
}
