export type MyfansQuoteRefreshItemSummary = {
  status: string;
  error?: string | null;
};

const BLOCKED_CODES = new Set(["LOGIN_OR_CHALLENGE", "PROFILE_NOT_FOUND/SUSPENDED", "SENSITIVE_CONTENT_GATE"]);

function errorCode(error: string | null | undefined) {
  return String(error ?? "").match(/^([A-Z_/]+):\s*/)?.[1] ?? "";
}

export function summarizeMyfansQuoteRefreshItems(items: MyfansQuoteRefreshItemSummary[]) {
  let success = 0;
  let failed = 0;
  let blocked = 0;
  let skipped = 0;
  for (const item of items) {
    if (item.status === "success") success += 1;
    else if (item.status === "failed") {
      if (BLOCKED_CODES.has(errorCode(item.error))) blocked += 1;
      else failed += 1;
    } else if (item.status === "skipped") {
      if (BLOCKED_CODES.has(errorCode(item.error))) blocked += 1;
      else skipped += 1;
    }
  }
  return { processed: success + failed + blocked + skipped, success, failed, blocked, skipped };
}
