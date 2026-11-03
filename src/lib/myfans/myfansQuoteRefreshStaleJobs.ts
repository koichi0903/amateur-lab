import { auditStaleJobFinalized } from "@/lib/myfans/myfansQuoteRefreshAudit";
import { MYFANS_COLLECTION_KEY } from "@/lib/myfansCollectionRotation";
import {
  isStaleQuoteRefreshJob,
  STALE_QUOTE_REFRESH_ITEM_AGE_MS,
  staleQuoteRefreshCleanupPreview,
  type QuoteRefreshLifecycleItem,
  type QuoteRefreshStaleJob,
} from "@/lib/myfansQuoteRefreshLifecycle";
import {
  buildStaleJobAuditMetadata,
  buildStaleJobCancellationPatch,
  buildStaleJobItemPatch,
  type ProtectedQuoteRefreshRunIdentity,
  type QuoteRefreshCursorSnapshot,
} from "@/lib/myfans/myfansQuoteRefreshStaleJobFinalization";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STALE_JOB_CLEANUP_REASON = "STALE_JOB_FINALIZED: Companion runの進行が長時間更新されなかったためexecution lifecycleのみ終了しました。rotation eligibilityとcursorは保持されています。";
const LEGACY_JOB_RECONCILED_REASON = "LEGACY_JOB_RECONCILED: 旧Companion sessionのjobは自動再開しません。";

async function finalizeStaleActiveJob(
  job: QuoteRefreshStaleJob,
  items: QuoteRefreshLifecycleItem[],
  cursor: QuoteRefreshCursorSnapshot,
  protectedIdentity?: ProtectedQuoteRefreshRunIdentity,
) {
  if (!isStaleQuoteRefreshJob(job, items, Date.now(), protectedIdentity)) return null;
  const preview = staleQuoteRefreshCleanupPreview(job, items, STALE_JOB_CLEANUP_REASON);
  if (!preview.changed) return null;
  const now = new Date().toISOString();
  // Persist the proof before terminalizing the job so an audit failure cannot be reported as a successful cleanup.
  await auditStaleJobFinalized(job.id, buildStaleJobAuditMetadata(job, cursor, preview, STALE_JOB_CLEANUP_REASON, protectedIdentity));
  const itemPatch = buildStaleJobItemPatch(STALE_JOB_CLEANUP_REASON, now);
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
    .update(buildStaleJobCancellationPatch(STALE_JOB_CLEANUP_REASON, now))
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
  protectedIdentity?: ProtectedQuoteRefreshRunIdentity,
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
