export const ACTIVE_QUOTE_REFRESH_STATUSES = ["pending", "running", "paused"] as const;
export const TERMINAL_QUOTE_REFRESH_STATUSES = ["completed", "failed", "cancelled"] as const;
export const AUTO_STALE_QUOTE_REFRESH_STATUSES = ["pending", "running"] as const;
export const STALE_QUOTE_REFRESH_AGE_MS = 30 * 60_000;

export type QuoteRefreshLifecycleItem = {
  status: string;
  collection_state?: string | null;
  error?: string | null;
  processed_at?: string | null;
};

export type QuoteRefreshStaleJob = {
  id: number;
  status: string;
  created_at?: string | null;
  started_at?: string | null;
  cursor_before_order?: number | null;
  cursor_after_order?: number | null;
  collection_cycle_no?: number | null;
  cycle_completed?: boolean | null;
  collection_session_id?: string | null;
  collection_run_token?: string | null;
  collector_version?: string | null;
};

export type QuoteRefreshJobLifecycle = {
  status: string;
  collection_session_id?: string | null;
  launch_mode?: string | null;
};

function timestamp(value: unknown) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasQuoteRefreshRunIdentity(job: QuoteRefreshStaleJob) {
  return Boolean(job.collection_session_id && job.collection_run_token && job.collector_version);
}

export function isProtectedQuoteRefreshRun(
  job: QuoteRefreshStaleJob,
  protectedIdentity?: { jobId?: number | null; sessionId?: string | null; runToken?: string | null; collectorVersion?: string | null },
) {
  if (!protectedIdentity) return false;
  if (protectedIdentity.jobId && job.id === protectedIdentity.jobId) return true;
  return Boolean(
    protectedIdentity.sessionId && protectedIdentity.runToken && protectedIdentity.collectorVersion &&
      job.collection_session_id === protectedIdentity.sessionId &&
      job.collection_run_token === protectedIdentity.runToken &&
      job.collector_version === protectedIdentity.collectorVersion,
  );
}

export function quoteRefreshLastActivityAt(job: QuoteRefreshStaleJob, items: readonly QuoteRefreshLifecycleItem[] = []) {
  return Math.max(timestamp(job.started_at), timestamp(job.created_at), ...items.map((item) => timestamp(item.processed_at)));
}

export function isStaleQuoteRefreshJob(
  job: QuoteRefreshStaleJob,
  items: readonly QuoteRefreshLifecycleItem[],
  now = Date.now(),
  protectedIdentity?: { jobId?: number | null; sessionId?: string | null; runToken?: string | null; collectorVersion?: string | null },
) {
  if (!AUTO_STALE_QUOTE_REFRESH_STATUSES.includes(job.status as typeof AUTO_STALE_QUOTE_REFRESH_STATUSES[number]) || !hasQuoteRefreshRunIdentity(job) || isProtectedQuoteRefreshRun(job, protectedIdentity)) return false;
  return now - quoteRefreshLastActivityAt(job, items) >= STALE_QUOTE_REFRESH_AGE_MS;
}

export function staleQuoteRefreshCleanupPreview(job: QuoteRefreshStaleJob, items: readonly QuoteRefreshLifecycleItem[], reason: string) {
  const pendingCount = items.filter((item) => ["pending", "running"].includes(item.status)).length;
  if (!pendingCount || !isActiveQuoteRefreshStatus(job.status)) return { job, items, pendingCount: 0, changed: false, rotationEligibilityPreserved: true };
  return {
    job: { ...job, status: "cancelled", last_error: reason, completed_at: "stale-cleanup" },
    items: items.map((item) => ["pending", "running"].includes(item.status) ? { ...item, status: "skipped", collection_state: "CANCELLED", error: reason } : item),
    pendingCount,
    changed: true,
    rotationEligibilityPreserved: true,
    cursorBeforeOrder: job.cursor_after_order,
    cursorAfterOrder: job.cursor_after_order,
    cycleNo: job.collection_cycle_no,
    cycleCompleted: job.cycle_completed,
  };
}

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
