export const ACTIVE_QUOTE_REFRESH_STATUSES = ["pending", "running", "paused"] as const;
export const TERMINAL_QUOTE_REFRESH_STATUSES = ["completed", "failed", "cancelled"] as const;

export type QuoteRefreshJobLifecycle = {
  status: string;
  collection_session_id?: string | null;
  launch_mode?: string | null;
};

export function isActiveQuoteRefreshStatus(status: unknown): boolean {
  return ACTIVE_QUOTE_REFRESH_STATUSES.includes(String(status) as typeof ACTIVE_QUOTE_REFRESH_STATUSES[number]);
}

export function mayAutoContinueQuoteRefresh(job: QuoteRefreshJobLifecycle | null | undefined, sessionId: string | null | undefined) {
  return Boolean(job && isActiveQuoteRefreshStatus(job.status) && sessionId && job.collection_session_id === sessionId);
}

export function classifyQuoteRefreshLaunch(input: { explicitNew: boolean; sameSession: boolean; active: boolean }) {
  if (input.explicitNew) return "new" as const;
  if (input.sameSession && input.active) return "resumed" as const;
  return "legacy" as const;
}

export function cursorMayAdvanceForItem(status: string, cancelledByUser = false) {
  return !cancelledByUser && ["success", "failed", "skipped"].includes(status);
}
