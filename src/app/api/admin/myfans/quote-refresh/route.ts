import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { summarizeMyfansQuoteRefreshItems } from "@/lib/myfansQuoteRefreshSummary";
import { auditContinuation } from "@/lib/myfansQuoteRefreshAudit";
import { reconcileLegacyActiveJobs, reconcileStaleActiveJobs } from "@/lib/myfansQuoteRefreshStaleJobs";
import { buildTargetedCreatorRecommendations } from "@/lib/myfansTargetedCreatorRecommendations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MAX_MYFANS_ACCOUNTS_PER_RUN, MYFANS_COLLECTION_KEY } from "@/lib/myfansCollectionRotation";
import { isTerminalQuoteRefreshStatus, recomputeQuoteRefreshStatus, STALE_QUOTE_REFRESH_ITEM_AGE_MS } from "@/lib/myfansQuoteRefreshLifecycle";
import { classifyQuoteRefreshNextItemGate, type QuoteRefreshNextItemGate } from "@/lib/myfansQuoteRefreshNextItemGate";
import { buildQuoteRefreshCollectionSelection, buildQuoteRefreshCreatorStates, orderQuoteRefreshCreators } from "@/lib/myfansQuoteRefreshPreparation";
import { summarizeMyfansQuoteRefreshJobItems } from "@/lib/myfansQuoteRefreshJobCounts";
import { summarizeMyfansQuoteRefreshEvidence } from "@/lib/myfansQuoteRefreshEvidenceCounts";
import { buildMyfansQuoteRefreshProgressSummary } from "@/lib/myfansQuoteRefreshProgressSummary";
import { cleanText, normalizeQuoteRefreshCreateRequest, normalizeTargetedCreatorIds, numberValue } from "@/lib/myfansQuoteRefreshRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const CANCELLED_BY_USER = "CANCELLED_BY_USER: ユーザーが一括更新を中止しました。";

function errorCodeFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/DB_PREFLIGHT_FAILED/i.test(message)) return "DB_PREFLIGHT_FAILED";
  if (/check constraint|violates check constraint/i.test(message)) return "DB_CONSTRAINT_MISMATCH";
  if (/fetch failed|eacces|network|connect|timeout/i.test(message)) return "DB_PREFLIGHT_FAILED";
  return "QUOTE_REFRESH_OPERATION_FAILED";
}

async function targetedCreatorRecommendations(approvedMediaId: number | null) {
  let productsQuery = supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,title,source_x_url,creator_x_url")
    .not("creator_id", "is", null)
    .limit(1000);
  if (approvedMediaId) productsQuery = productsQuery.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data: products, error: productsError } = await productsQuery;
  if (productsError) throw productsError;
  const productRows = (products ?? []).filter((row) => Number.isSafeInteger(row.creator_id));
  const creatorIds = [...new Set(productRows.map((row) => Number(row.creator_id)))];
  if (!creatorIds.length) return { candidates: [], reason: "eligible creator/product linkageなし" };
  const [{ data: creators, error: creatorsError }, { data: quotes, error: quotesError }] = await Promise.all([
    supabaseAdmin.from("myfans_creators").select("id,display_name,creator_x_url,is_active").in("id", creatorIds).eq("is_active", true),
    supabaseAdmin.from("myfans_quote_candidates").select("id,creator_id,text_excerpt,posted_at,collected_at,media_type,media_permalink,quote_visual_ready,visual_analysis_status,views,likes,reposts,replies,is_repost,is_reply,is_quote,last_used_at,cooldown_until").in("creator_id", creatorIds).order("collected_at", { ascending: false }).limit(5000),
  ]);
  if (creatorsError) throw creatorsError;
  if (quotesError) throw quotesError;
  const { data: collectionStates, error: collectionStateError } = await supabaseAdmin
    .from("myfans_creator_collection_state")
    .select("creator_id,last_processed_at,state,collection_enabled")
    .in("creator_id", creatorIds);
  if (collectionStateError) throw collectionStateError;
  return buildTargetedCreatorRecommendations({
    products: productRows,
    creators: creators ?? [],
    quotes: quotes ?? [],
    collectionStates: collectionStates ?? [],
  });
}

async function refreshJobCounts(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status,collected_count,collection_state,collection_evidence")
    .eq("job_id", jobId);
  if (error) throw error;

  const counts = summarizeMyfansQuoteRefreshJobItems(items ?? []);
  const currentJob = await getJob(jobId);
  const currentStatus = String(currentJob?.status ?? "pending");
  const status = recomputeQuoteRefreshStatus(currentStatus, counts.runningItems, counts.pendingItems);
  const completedAt = isTerminalQuoteRefreshStatus(currentStatus)
    ? currentJob?.completed_at ?? null
    : status === "completed" ? new Date().toISOString() : null;
  const statusScope = isTerminalQuoteRefreshStatus(currentStatus)
    ? [currentStatus]
    : ["pending", "running", "paused"];

  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      status,
      processed_creators: counts.processed,
      success_creators: counts.success,
      failed_creators: counts.failed,
      accounts_processed: counts.processed,
      complete_threads_found: counts.completeThreadsFound,
      candidates_saved: counts.candidatesSaved,
      no_match: counts.noMatch,
      excluded_no_posts: counts.excludedNoPosts,
      excluded_private: counts.excludedPrivate,
      retryable_errors: counts.retryableErrors,
      completed_at: completedAt,
    })
    .eq("id", jobId)
    .in("status", statusScope);
  if (updateError) throw updateError;
}

async function getJob(jobId: number) {
  const { data: job, error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return job;
}

async function getStaleRunningItems(jobId: number) {
  const { data } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id")
    .eq("job_id", jobId)
    .eq("status", "running")
    .lt("processed_at", new Date(Date.now() - STALE_QUOTE_REFRESH_ITEM_AGE_MS).toISOString());
  return data;
}

function quoteRefreshNextItemGateResponse<T extends { status: string }>(gate: QuoteRefreshNextItemGate, job: T) {
  switch (gate) {
    case "identity_mismatch":
      return NextResponse.json({ error: "JOB_IDENTITY_MISMATCH: Companion runとDB jobのidentityが一致しません。", errorCode: "JOB_IDENTITY_MISMATCH", job }, { status: 409 });
    case "paused":
      return NextResponse.json({ paused: true, job });
    case "cancelled":
    case "inactive":
      return NextResponse.json({ done: true, job });
    case "session_mismatch":
      return NextResponse.json({ done: true, job, reason: "session_mismatch" });
    default:
      return null;
  }
}

async function progress(jobId: number) {
  await refreshJobCounts(jobId);
  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,creator_id,creator_x_url,status,attempts,collected_count,top_score,error,processed_at,started_at,finished_at,request_type,result_code,http_status,diagnostics,collection_state,collection_evidence,myfans_creators(display_name)")
    .eq("job_id", jobId)
    .order("id", { ascending: true });
  if (itemsError) throw itemsError;
  const skipped = (items ?? []).filter((item) => item.status === "skipped").length;
  const summary = summarizeMyfansQuoteRefreshItems(items ?? []);
  const evidenceCounts = summarizeMyfansQuoteRefreshEvidence(items ?? []);
  return { job, items: items ?? [], skippedCreators: skipped, summary: buildMyfansQuoteRefreshProgressSummary(job, summary, evidenceCounts) };
}

async function getCurrentSessionJob(approvedMediaId: number | null, sessionId: string) {
  let query = supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("collection_session_id", sessionId)
    .in("status", ["pending", "running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (approvedMediaId === null) query = query.is("approved_media_id", null);
  else if (approvedMediaId) query = query.eq("approved_media_id", approvedMediaId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function prepareQuoteRefreshSelection(targetedCreatorIds: number[], queueLimit: number) {
  const { data: creators, error } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,display_name,creator_x_url,is_active")
    .eq("is_active", true)
    .not("creator_x_url", "is", null)
    .neq("creator_x_url", "")
    .limit(1000);
  if (error) throw error;

  const orderedCreators = orderQuoteRefreshCreators(creators ?? [], targetedCreatorIds);
  if (targetedCreatorIds.length && !orderedCreators.length) {
    return { response: NextResponse.json({ error: "指定されたtarget creatorに有効なXプロフィールがありません。" }, { status: 400 }) };
  }
  const { data: existingStates, error: stateError } = await supabaseAdmin
    .from("myfans_creator_collection_state")
    .select("creator_id,rotation_order,collection_enabled")
    .in("creator_id", orderedCreators.map((creator) => creator.id));
  if (stateError) throw stateError;
  const { stateByCreator, missingStates } = buildQuoteRefreshCreatorStates(orderedCreators, existingStates ?? []);
  if (missingStates.length) {
    const { error: insertStateError } = await supabaseAdmin.from("myfans_creator_collection_state").insert(missingStates);
    if (insertStateError) throw insertStateError;
    for (const state of missingStates) stateByCreator.set(state.creator_id, state);
  }
  const { data: cursor, error: cursorError } = await supabaseAdmin
    .from("myfans_collection_cursors")
    .select("cursor_order,cycle_no")
    .eq("collector_key", MYFANS_COLLECTION_KEY)
    .maybeSingle();
  if (cursorError) throw cursorError;
  const selection = buildQuoteRefreshCollectionSelection({
    creators: orderedCreators,
    stateByCreator,
    cursor,
    targetedCreatorCount: targetedCreatorIds.length,
    queueLimit,
  });
  if (targetedCreatorIds.length && !selection.prioritized.length) {
    return { response: NextResponse.json({ error: "指定されたtarget creatorは収集対象外です。" }, { status: 400 }) };
  }
  return { selection: { cursor, ...selection } };
}

type QuoteRefreshSelection = ReturnType<typeof buildQuoteRefreshCollectionSelection>;

async function persistQuoteRefreshJob(jobInput: Record<string, unknown>, prioritized: QuoteRefreshSelection["prioritized"], approvedMediaId: number | null, sessionId: string, selectionNote: string, collectionRotation: QuoteRefreshSelection["collectionRotation"]) {
  let created: Awaited<ReturnType<typeof createJobAndItemsAtomically>>;
  try {
    created = await createJobAndItemsAtomically(jobInput, prioritized);
  } catch (error) {
    if (/duplicate key|unique constraint/i.test(error instanceof Error ? error.message : String(error))) {
      const concurrent = await getCurrentSessionJob(approvedMediaId, sessionId);
      if (concurrent) return NextResponse.json({ ...(await progress(concurrent.id)), reused: true, reason: "IDEMPOTENT_ACTIVE_SESSION" });
    }
    throw error;
  }
  const { job } = created;
  if (created.reused) return NextResponse.json({ ...(await progress(job.id)), reused: true, reason: "IDEMPOTENT_ACTIVE_SESSION" });

  // The persistent cursor advances only when an item reaches a terminal outcome.
  return NextResponse.json({ ...(await progress(job.id)), rotation: { ...collectionRotation, note: selectionNote, maxAccountsPerRun: MAX_MYFANS_ACCOUNTS_PER_RUN } });
}

async function createJob(payload: Record<string, unknown>) {
  await assertDatabaseReady();
  const { approvedMediaId, batchSize, queueLimit, sessionId, runToken, collectorVersion } = normalizeQuoteRefreshCreateRequest(payload, MAX_MYFANS_ACCOUNTS_PER_RUN, randomUUID);
  const existingForSession = await getCurrentSessionJob(approvedMediaId, sessionId);
  if (existingForSession) {
    return NextResponse.json({ ...(await progress(existingForSession.id)), reused: true, reason: "IDEMPOTENT_ACTIVE_SESSION" });
  }
  await reconcileLegacyActiveJobs();
  await reconcileStaleActiveJobs({ sessionId, runToken, collectorVersion });
  const targetedCreatorIds = normalizeTargetedCreatorIds(payload.targetedCreatorIds);
  const prepared = await prepareQuoteRefreshSelection(targetedCreatorIds, queueLimit);
  if ("response" in prepared) return prepared.response;
  const { cursor, collectionRotation, prioritized } = prepared.selection;

  const selectionNote = `低負荷のため1run最大${MAX_MYFANS_ACCOUNTS_PER_RUN}アカウント。固定creatorではなくcursorから次回は別creatorを選び、terminal処理時だけcursorを進め、retryableは次回も再訪する。run間隔は運用側で空ける。`;

  const jobInput = {
    approved_media_id: approvedMediaId,
    status: "pending",
    total_creators: prioritized.length,
    batch_size: batchSize,
    rotation_cooldown_days: 1,
    minimum_rotation_cooldown_days: 1,
    eligible_creators: collectionRotation.eligibleCount,
    cooldown_excluded_creators: 0,
    selection_mode: "strict",
    selection_note: selectionNote,
    collection_cycle_no: Number(cursor?.cycle_no ?? 1),
    cursor_before_order: Number(cursor?.cursor_order ?? 0),
    cursor_after_order: Number(cursor?.cursor_order ?? 0),
    cycle_completed: false,
    sensitive_gate_streak_limit: 3,
    sensitive_gate_streak: 0,
    collection_session_id: sessionId,
    collection_run_token: runToken,
    launch_mode: "new",
    collector_version: collectorVersion,
  };

  return persistQuoteRefreshJob(jobInput, prioritized, approvedMediaId, sessionId, selectionNote, collectionRotation);
}

async function preflightDatabase() {
  const startedAt = Date.now();
  const { error } = await supabaseAdmin.from("myfans_quote_refresh_jobs").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, errorCode: "DB_PREFLIGHT_FAILED", error: error.message, diagnostics: { elapsedMs: Date.now() - startedAt, readOnly: true } }, { status: 503 });
  }
  return NextResponse.json({ ok: true, diagnostics: { elapsedMs: Date.now() - startedAt, readOnly: true, runtimeRole: "myfans-integration", expectedPort: 3000 } });
}

async function assertDatabaseReady() {
  const { error } = await supabaseAdmin.from("myfans_quote_refresh_jobs").select("id").limit(1);
  if (error) {
    const wrapped = new Error(`DB_PREFLIGHT_FAILED: ${error.message}`);
    wrapped.name = "DB_PREFLIGHT_FAILED";
    throw wrapped;
  }
}

async function compensateCreateFailure(jobId: number, reason: string) {
  const now = new Date().toISOString();
  const itemError = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({ status: "skipped", error: `CREATE_COMPENSATED: ${reason}`, processed_at: now, finished_at: now, result_code: "CREATE_COMPENSATED", http_status: 500, diagnostics: { phase: "job_items_create", compensated: true } })
    .eq("job_id", jobId)
    .in("status", ["pending", "running"]);
  const jobError = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "failed", completed_at: now, last_error: `CREATE_COMPENSATED: ${reason}` })
    .eq("id", jobId)
    .in("status", ["pending", "running"]);
  if (itemError.error || jobError.error) {
    throw new Error(`CREATE_COMPENSATION_FAILED: ${itemError.error?.message ?? jobError.error?.message ?? "unknown error"}`);
  }
}

async function createJobAndItemsAtomically(jobInput: Record<string, unknown>, prioritized: Array<{ id: number; creator_x_url: string }>) {
  const rpc = await supabaseAdmin.rpc("create_myfans_quote_refresh_job", {
    p_job: jobInput,
    p_items: prioritized.map((creator) => ({ creator_id: creator.id, creator_x_url: creator.creator_x_url })),
  });
  if (!rpc.error) {
    const result = rpc.data as { job_id?: number; reused?: boolean } | null;
    if (!result?.job_id) throw new Error("ATOMIC_CREATE_INVALID_RESPONSE: job_idが返されませんでした。");
    const job = await getJob(Number(result.job_id));
    if (!job) throw new Error("ATOMIC_CREATE_JOB_NOT_FOUND: transaction後のjobを取得できませんでした。");
    return { job, reused: result.reused === true, atomic: true };
  }

  // The RPC is intentionally the normal path. This compatibility path is only
  // for a database where the not-yet-applied migration has no function.
  if (!/function .*create_myfans_quote_refresh_job|PGRST202|does not exist/i.test(rpc.error.message)) throw rpc.error;

  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .insert(jobInput)
    .select("*")
    .single();
  if (jobError) throw jobError;
  try {
    if (prioritized.length) {
      const { error: itemError } = await supabaseAdmin.from("myfans_quote_refresh_job_items").insert(
        prioritized.map((creator) => ({ job_id: job.id, creator_id: creator.id, creator_x_url: creator.creator_x_url })),
      );
      if (itemError) throw itemError;
    }
  } catch (error) {
    await compensateCreateFailure(job.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
  return { job, reused: false, atomic: false };
}

async function nextItem(payload: Record<string, unknown>) {
  const requestedJobId = numberValue(payload.jobId, 0);
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const sessionId = cleanText(payload.sessionId);
  const runToken = cleanText(payload.runToken);
  const collectorVersion = cleanText(payload.collectorVersion);
  const activeJob = requestedJobId ? await getJob(requestedJobId) : sessionId ? await getCurrentSessionJob(approvedMediaId, sessionId) : null;
  if (!activeJob) return NextResponse.json({ done: true, message: "実行中の更新キューはありません。" });
  const gate = classifyQuoteRefreshNextItemGate({ job: activeJob, sessionId, runToken, collectorVersion });
  const gateResponse = quoteRefreshNextItemGateResponse(gate, activeJob);
  if (gateResponse) return gateResponse;

  await auditContinuation(activeJob.id, "NEXT_REQUESTED", "次のbatch itemを要求", {
    sessionId,
    runTokenPresent: Boolean(runToken),
    collectorVersion,
    requestedJobId: requestedJobId || null,
  });

  await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: activeJob.started_at ?? new Date().toISOString() })
    .eq("id", activeJob.id);

  const stale = await getStaleRunningItems(activeJob.id);
  if (stale?.length) return NextResponse.json({ done: true, stale: true, needsUserAction: true, job: activeJob, staleItemIds: stale.map((item) => item.id), message: "staleな実行項目があります。明示的なresume操作が必要です。" });

  const { data: activeItems, error: activeItemsError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id")
    .eq("job_id", activeJob.id)
    .eq("status", "running")
    .limit(1);
  if (activeItemsError) throw activeItemsError;
  if (activeItems?.length) return NextResponse.json({ done: false, busy: true, jobId: activeJob.id, job: activeJob, message: "別のitemが処理中のためclaimを保留しました。" });

  const { data: item, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .eq("job_id", activeJob.id)
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!item) {
    await refreshJobCounts(activeJob.id);
    return NextResponse.json({ done: true, ...(await progress(activeJob.id)) });
  }

  const { data: running, error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({ status: "running", attempts: item.attempts + 1, processed_at: new Date().toISOString(), started_at: new Date().toISOString(), finished_at: null, request_type: "quote_scan", result_code: null, http_status: null, diagnostics: {}, error: null })
    .eq("id", item.id)
    .eq("status", "pending")
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .maybeSingle();
  if (updateError) throw updateError;

  if (!running) {
    await auditContinuation(activeJob.id, "NEXT_CLAIM_SKIPPED", "競合中のclaimを破棄", { itemId: item.id, reason: "claim_lost" });
    return NextResponse.json({ done: false, claimed: false, duplicate: true, jobId: activeJob.id, job: activeJob });
  }

  await auditContinuation(activeJob.id, "NEXT_CLAIMED", "次のbatch itemをclaim", { itemId: running.id, creatorId: running.creator_id, attempts: running.attempts });

  return NextResponse.json({ done: false, jobId: activeJob.id, batchSize: activeJob.batch_size, item: running });
}

async function auditContinuationAction(payload: Record<string, unknown>) {
  const jobId = numberValue(payload.jobId, 0);
  const sessionId = cleanText(payload.sessionId);
  const runToken = cleanText(payload.runToken);
  const collectorVersion = cleanText(payload.collectorVersion);
  const job = jobId ? await getJob(jobId) : null;
  if (!job || !sessionId || !runToken || job.collection_session_id !== sessionId || job.collection_run_token !== runToken || job.collector_version !== collectorVersion) {
    return NextResponse.json({ error: "JOB_IDENTITY_MISMATCH: continuation auditのidentityが一致しません。", errorCode: "JOB_IDENTITY_MISMATCH" }, { status: 409 });
  }
  const action = cleanText(payload.continuationAction);
  if (!["ITEM_SAVED", "ITEM_TERMINAL", "CONTINUE_DIRECT", "WATCHDOG_FIRED", "DB_RUNNING_CONFIRMED", "RESUME_REQUESTED", "RESUME_CLAIMED", "CONTINUATION_STOPPED"].includes(action)) return NextResponse.json({ error: "未対応のcontinuation auditです。" }, { status: 400 });
  await auditContinuation(job.id, action, cleanText(payload.summary) || action, typeof payload.metadata === "object" && payload.metadata ? payload.metadata as Record<string, unknown> : {});
  return NextResponse.json({ ok: true });
}

async function startJob(payload: Record<string, unknown>) {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "更新キューが見つかりません。" }, { status: 404 });
  if (!["pending", "paused", "running"].includes(job.status)) return NextResponse.json(await progress(jobId));
  const sessionId = cleanText(payload.sessionId);
  const runToken = cleanText(payload.runToken);
  const collectorVersion = cleanText(payload.collectorVersion);
  if (!sessionId || !runToken || job.collection_session_id !== sessionId || job.collection_run_token !== runToken || job.collector_version !== collectorVersion) return NextResponse.json({ error: "JOB_IDENTITY_MISMATCH: 同一run identityのjobだけ再開できます。", errorCode: "JOB_IDENTITY_MISMATCH", job }, { status: 409 });
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: job.started_at ?? new Date().toISOString(), last_error: null, launch_mode: job.launch_mode === "new" ? "new" : "resumed", collector_version: cleanText(payload.collectorVersion) || job.collector_version || null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

async function updateJobStatus(payload: Record<string, unknown>, status: "paused" | "running" | "cancelled") {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  if (status === "cancelled") {
    const { error: itemError } = await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: CANCELLED_BY_USER, processed_at: new Date().toISOString(), finished_at: new Date().toISOString(), request_type: "quote_scan", result_code: "CANCELLED", http_status: 200, diagnostics: {}, collection_state: "CANCELLED", collection_evidence: { final_collection_state: "CANCELLED", final_error: CANCELLED_BY_USER } })
      .eq("job_id", jobId)
      .in("status", ["pending", "running"]);
    if (itemError) throw itemError;
  }
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status, completed_at: status === "cancelled" ? new Date().toISOString() : null, last_error: status === "cancelled" ? CANCELLED_BY_USER : null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = numberValue(url.searchParams.get("jobId"), 0);
    if (!jobId && !url.searchParams.get("sessionId")) await reconcileLegacyActiveJobs();
    const requestedSessionId = cleanText(url.searchParams.get("sessionId"));
    const approvedMediaId = numberValue(url.searchParams.get("approvedMediaId"), 0) || null;
    const requestedJob = jobId ? await getJob(jobId) : requestedSessionId ? await getCurrentSessionJob(approvedMediaId, requestedSessionId) : null;
    await reconcileStaleActiveJobs({
      jobId: jobId || null,
      sessionId: requestedSessionId || null,
      runToken: requestedJob?.collection_run_token ?? null,
      collectorVersion: requestedJob?.collector_version ?? null,
    });
    if (url.searchParams.get("targeted") === "1") return NextResponse.json(await targetedCreatorRecommendations(approvedMediaId));
    const job = requestedJob;
    if (!job) return NextResponse.json({ job: null, items: [] });
    return NextResponse.json(await progress(job.id));
  } catch (error) {
    return NextResponse.json({
      job: null,
      items: [],
      warning: error instanceof Error ? error.message : "進捗を取得できませんでした。",
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const action = cleanText(payload.action || "create");
    if (action === "preflight") return await preflightDatabase();
    if (action === "create") return await createJob(payload);
    if (action === "start") return await startJob(payload);
    if (action === "next") return await nextItem(payload);
    if (action === "audit") return await auditContinuationAction(payload);
    if (action === "pause") return await updateJobStatus(payload, "paused");
    if (action === "resume") return await updateJobStatus(payload, "running");
    if (action === "cancel") return await updateJobStatus(payload, "cancelled");
    return NextResponse.json({ error: "未対応の操作です。" }, { status: 400 });
  } catch (error) {
    const errorCode = errorCodeFor(error);
    return NextResponse.json({ errorCode, error: error instanceof Error ? error.message : "更新キュー操作に失敗しました。" }, { status: errorCode === "DB_PREFLIGHT_FAILED" ? 503 : 500 });
  }
}
