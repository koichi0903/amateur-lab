import { isProtectedQuoteRefreshRun, type QuoteRefreshStaleJob } from "../myfansQuoteRefreshLifecycle";
import type { staleQuoteRefreshCleanupPreview } from "../myfansQuoteRefreshLifecycle";

export type ProtectedQuoteRefreshRunIdentity = {
  jobId?: number | null;
  sessionId?: string | null;
  runToken?: string | null;
  collectorVersion?: string | null;
};

export type QuoteRefreshCursorSnapshot = { cursor_order: number | null; cycle_no: number | null } | null;
type StaleCleanupPreview = Pick<ReturnType<typeof staleQuoteRefreshCleanupPreview>, "pendingCount">;

function buildCursorAuditFields(job: QuoteRefreshStaleJob, cursor: QuoteRefreshCursorSnapshot) {
  const unchangedCursorOrder = cursor?.cursor_order ?? job.cursor_after_order ?? 0;
  return {
    cursor_before_order: unchangedCursorOrder,
    cursor_after_order: unchangedCursorOrder,
    job_cursor_before_order: job.cursor_before_order ?? null,
    job_cursor_after_order: job.cursor_after_order ?? null,
    cursor_unchanged: true,
  };
}

function buildCycleAuditFields(job: QuoteRefreshStaleJob, cursor: QuoteRefreshCursorSnapshot) {
  return {
    cycle_no: job.collection_cycle_no ?? cursor?.cycle_no ?? 1,
    cycle_completed: job.cycle_completed ?? false,
  };
}

export function buildStaleJobAuditMetadata(
  job: QuoteRefreshStaleJob,
  cursor: QuoteRefreshCursorSnapshot,
  preview: StaleCleanupPreview,
  cleanupReason: string,
  protectedIdentity?: ProtectedQuoteRefreshRunIdentity,
) {
  return {
    reason: cleanupReason,
    prior_status: job.status,
    final_status: "cancelled",
    ...buildCursorAuditFields(job, cursor),
    ...buildCycleAuditFields(job, cursor),
    pending_count: preview.pendingCount,
    rotation_eligibility_preserved: true,
    protected_run: isProtectedQuoteRefreshRun(job, protectedIdentity),
  };
}

export function buildStaleJobItemPatch(cleanupReason: string, now: string) {
  return {
    status: "skipped",
    error: cleanupReason,
    processed_at: now,
    finished_at: now,
    request_type: "quote_scan",
    result_code: "STALE_JOB_CANCELLED",
    http_status: 200,
    diagnostics: { rotation_eligibility_preserved: true },
    collection_state: "CANCELLED",
    collection_evidence: {
      final_collection_state: "CANCELLED",
      final_error: cleanupReason,
      rotation_eligibility_preserved: true,
    },
  };
}

export function buildStaleJobCancellationPatch(cleanupReason: string, now: string) {
  return { status: "cancelled", completed_at: now, last_error: cleanupReason };
}
