import { auditStaleJobFinalized } from "@/lib/myfansQuoteRefreshAudit";
import { MYFANS_COLLECTION_KEY } from "@/lib/myfansCollectionRotation";
import {
  isProtectedQuoteRefreshRun,
  isStaleQuoteRefreshJob,
  STALE_QUOTE_REFRESH_ITEM_AGE_MS,
  staleQuoteRefreshCleanupPreview,
  type QuoteRefreshLifecycleItem,
  type QuoteRefreshStaleJob,
} from "@/lib/myfansQuoteRefreshLifecycle";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STALE_JOB_CLEANUP_REASON = "STALE_JOB_FINALIZED: Companion runの進行が長時間更新されなかったためexecution lifecycleのみ終了しました。rotation eligibilityとcursorは保持されています。";
const LEGACY_JOB_RECONCILED_REASON = "LEGACY_JOB_RECONCILED: 旧Companion sessionのjobは自動再開しません。";
type ProtectedRunIdentity = { jobId?: number | null; sessionId?: string | null; runToken?: string | null; collectorVersion?: string | null };

async function finalizeStaleActiveJob(
  job: QuoteRefreshStaleJob,
  items: QuoteRefreshLifecycleItem[],
  cursor: { cursor_order: number | null; cycle_no: number | null } | null,
  protectedIdentity?: ProtectedRunIdentity,
) {
  if (!isStaleQuoteRefreshJob(job, items, Date.now(), protectedIdentity)) return null;
  const preview = staleQuoteRefreshCleanupPreview(job, items, STALE_JOB_CLEANUP_REASON);
  if (!preview.changed) return null;
  const now = new Date().toISOString();
  const auditMetadata = {
    reason: STALE_JOB_CLEANUP_REASON,
    prior_status: job.status,
    final_status: "cancelled",
    cursor_before_order: cursor?.cursor_order ?? job.cursor_after_order ?? 0,
    cursor_after_order: cursor?.cursor_order ?? job.cursor_after_order ?? 0,
    job_cursor_before_order: job.cursor_before_order ?? null,
    job_cursor_after_order: job.cursor_after_order ?? null,
    cursor_unchanged: true,
    cycle_no: job.collection_cycle_no ?? cursor?.cycle_no ?? 1,
    cycle_completed: job.cycle_completed ?? false,
    pending_count: preview.pendingCount,
    rotation_eligibility_preserved: true,
    protected_run: isProtectedQuoteRefreshRun(job, protectedIdentity),
  };
  // Persist the proof before terminalizing the job so an audit failure cannot be reported as a successful cleanup.
  await auditStaleJobFinalized(job.id, auditMetadata);
  const itemPatch = {
    status: "skipped",
    error: STALE_JOB_CLEANUP_REASON,
    processed_at: now,
    finished_at: now,
    request_type: "quote_scan",
    result_code: "STALE_JOB_CANCELLED",
    http_status: 200,
    diagnostics: { rotation_eligibility_preserved: true },
    collection_state: "CANCELLED",
    collection_evidence: {
      final_collection_state: "CANCELLED",
      final_error: STALE_JOB_CLEANUP_REASON,
      rotation_eligibility_preserved: true,
    },
  };
  const { error: pendingError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update(itemPatch)
    .eq("job_id", job.id)
    .eq("status", "pending");
  if (pendingError) throw pendingError;
  const { error: runningError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update(itemPatch)
    .eq("job_id", job.id)
    .eq("status", "running")
    .lt("processed_at", new Date(Date.now() - STALE_QUOTE_REFRESH_ITEM_AGE_MS).toISOString());
  if (runningError) throw runningError;
  const { data: finalizedJob, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "cancelled", completed_at: now, last_error: STALE_JOB_CLEANUP_REASON })
    .eq("id", job.id)
    .in("status", ["pending", "running"])
    .select("id")
    .maybeSingle();
  if (jobError) throw jobError;
  return finalizedJob ? Number(job.id) : null;
}

export async function reconcileLegacyActiveJobs() {
  const { data: jobs, error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("id")
    .is("collection_session_id", null)
    .in("status", ["pending", "running", "paused"]);
  if (error) throw error;
  for (const job of jobs ?? []) {
    const now = new Date().toISOString();
    const { error: itemError } = await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: LEGACY_JOB_RECONCILED_REASON, processed_at: now })
      .eq("job_id", job.id)
      .in("status", ["pending", "running"]);
    if (itemError) throw itemError;
    const { error: jobError } = await supabaseAdmin
      .from("myfans_quote_refresh_jobs")
      .update({ status: "cancelled", completed_at: now, last_error: LEGACY_JOB_RECONCILED_REASON })
      .eq("id", job.id)
      .in("status", ["pending", "running", "paused"]);
    if (jobError) throw jobError;
  }
}

export async function reconcileStaleActiveJobs(
  protectedIdentity?: ProtectedRunIdentity,
) {
  const { data: jobs, error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .not("collection_session_id", "is", null)
    .not("collection_run_token", "is", null)
    .not("collector_version", "is", null)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!jobs?.length) return [];

  const jobIds = jobs.map((job) => job.id);
  const { data: items, error: itemReadError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,job_id,status,collection_state,error,processed_at")
    .in("job_id", jobIds);
  if (itemReadError) throw itemReadError;
  const itemsByJob = new Map<number, typeof items>();
  for (const item of items ?? []) {
    itemsByJob.set(Number(item.job_id), [...(itemsByJob.get(Number(item.job_id)) ?? []), item]);
  }
  const { data: cursor, error: cursorError } = await supabaseAdmin
    .from("myfans_collection_cursors")
    .select("cursor_order,cycle_no")
    .eq("collector_key", MYFANS_COLLECTION_KEY)
    .maybeSingle();
  if (cursorError) throw cursorError;

  const finalized: number[] = [];
  for (const job of jobs) {
    const jobItems = itemsByJob.get(Number(job.id)) ?? [];
    const finalizedId = await finalizeStaleActiveJob(job, jobItems, cursor, protectedIdentity);
    if (finalizedId !== null) finalized.push(finalizedId);
  }
  return finalized;
}
