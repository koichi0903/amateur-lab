import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { summarizeMyfansQuoteRefreshItems } from "@/lib/myfansQuoteRefreshSummary";
import { evaluateMyfansSourceValue } from "@/lib/myfansSourceValue";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MAX_MYFANS_ACCOUNTS_PER_RUN, MYFANS_COLLECTION_KEY, selectCollectionAccounts } from "@/lib/myfansCollectionRotation";
import { isActiveQuoteRefreshStatus, isProtectedQuoteRefreshRun, isStaleQuoteRefreshJob, isTerminalQuoteRefreshStatus, recomputeQuoteRefreshStatus, staleQuoteRefreshCleanupPreview } from "@/lib/myfansQuoteRefreshLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const CANCELLED_BY_USER = "CANCELLED_BY_USER: ユーザーが一括更新を中止しました。";
const STALE_ITEM_AGE_MS = 5 * 60_000;
const STALE_JOB_CLEANUP_REASON = "STALE_JOB_FINALIZED: Companion runの進行が長時間更新されなかったためexecution lifecycleのみ終了しました。rotation eligibilityとcursorは保持されています。";

function errorCodeFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/DB_PREFLIGHT_FAILED/i.test(message)) return "DB_PREFLIGHT_FAILED";
  if (/check constraint|violates check constraint/i.test(message)) return "DB_CONSTRAINT_MISMATCH";
  if (/fetch failed|eacces|network|connect|timeout/i.test(message)) return "DB_PREFLIGHT_FAILED";
  return "QUOTE_REFRESH_OPERATION_FAILED";
}

async function auditContinuation(jobId: number, action: string, summary: string, metadata: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "quote_refresh_job",
    entity_id: jobId,
    action,
    summary,
    metadata: { source: "myfans_companion_batch", ...metadata },
  });
  if (!error) return { persisted: true, compatibilityFallback: false };

  // Older production schemas still restrict entity_type to the original audit values.
  // Do not let an audit-only incompatibility stop the collection state machine.
  if (/check constraint|violates check constraint/i.test(error.message)) {
    const fallback = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: jobId,
      action: `QUOTE_REFRESH_${action}`,
      summary,
      metadata: { source: "myfans_companion_batch", compatibility_fallback: true, original_entity_type: "quote_refresh_job", ...metadata },
    });
    if (!fallback.error) return { persisted: true, compatibilityFallback: true };
  }
  throw new Error(`myfans quote refresh continuation audit failed: ${error.message}`);
}

async function auditStaleJobFinalized(jobId: number, metadata: Record<string, unknown>) {
  const existing = await supabaseAdmin
    .from("myfans_audit_logs")
    .select("id")
    .eq("entity_type", "quote_refresh_job")
    .eq("entity_id", jobId)
    .eq("action", "STALE_JOB_FINALIZED")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`stale job audit lookup failed: ${existing.error.message}`);
  if (existing.data) return;

  const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "quote_refresh_job",
    entity_id: jobId,
    action: "STALE_JOB_FINALIZED",
    summary: "stale jobをexecution lifecycleのみterminalizeしました。",
    metadata: { source: "myfans_companion_batch", ...metadata },
  });
  if (!error) return;

  // A concurrent cleanup may have won the unique audit insert. Treat that as idempotent success;
  // every other persistence failure must remain visible to the caller.
  if (/duplicate key|unique constraint/i.test(error.message)) {
    const retry = await supabaseAdmin
      .from("myfans_audit_logs")
      .select("id")
      .eq("entity_type", "quote_refresh_job")
      .eq("entity_id", jobId)
      .eq("action", "STALE_JOB_FINALIZED")
      .limit(1)
      .maybeSingle();
    if (!retry.error && retry.data) return;
    if (retry.error) throw new Error(`stale job audit confirmation failed: ${retry.error.message}`);
  }
  throw new Error(`stale job audit persistence failed: ${error.message}`);
}

async function reconcileLegacyActiveJobs() {
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
      .update({ status: "skipped", error: "LEGACY_JOB_RECONCILED: 旧Companion sessionのjobは自動再開しません。", processed_at: now })
      .eq("job_id", job.id)
      .in("status", ["pending", "running"]);
    if (itemError) throw itemError;
    const { error: jobError } = await supabaseAdmin
      .from("myfans_quote_refresh_jobs")
      .update({ status: "cancelled", completed_at: now, last_error: "LEGACY_JOB_RECONCILED: 旧Companion sessionのjobは自動再開しません。" })
      .eq("id", job.id)
      .in("status", ["pending", "running", "paused"]);
    if (jobError) throw jobError;
  }
}

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBatchSize(value: unknown) {
  return Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, Math.max(1, Math.round(numberValue(value, MAX_MYFANS_ACCOUNTS_PER_RUN))));
}

function normalizeQueueLimit(value: unknown) {
  const parsed = Math.round(numberValue(value, 0));
  return parsed > 0 ? Math.min(1000, parsed) : null;
}

function normalizeXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/?$/);
  return match ? `https://x.com/${match[1]}` : "";
}

function normalizeTargetedCreatorIds(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return [...new Set(value.map((item) => Math.round(Number(item))).filter((item) => Number.isSafeInteger(item) && item > 0))].slice(0, 5);
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
  const productCount = new Map<number, number>();
  for (const product of productRows) productCount.set(Number(product.creator_id), (productCount.get(Number(product.creator_id)) ?? 0) + 1);
  const freshPassCreators = new Set<number>();
  for (const quote of quotes ?? []) {
    const ageSource = quote.posted_at ?? quote.collected_at;
    const age = ageSource ? (Date.now() - new Date(ageSource).getTime()) / 86_400_000 : null;
    const source = evaluateMyfansSourceValue({ text: quote.text_excerpt ?? "", postedAt: quote.posted_at, collectedAt: quote.collected_at, mediaType: quote.media_type, mediaPermalink: quote.media_permalink, quoteVisualReady: quote.quote_visual_ready, visualAnalysisStatus: quote.visual_analysis_status, views: quote.views, likes: quote.likes, reposts: quote.reposts, replies: quote.replies, isRepost: quote.is_repost, isReply: quote.is_reply, isQuote: quote.is_quote });
    if (!quote.is_repost && !quote.last_used_at && !quote.cooldown_until && age !== null && age <= 14 && source.verdict === "PASS") freshPassCreators.add(Number(quote.creator_id));
  }
  const latestCollectedAt = new Map<number, string>();
  for (const quote of quotes ?? []) {
    const creatorId = Number(quote.creator_id);
    const current = latestCollectedAt.get(creatorId);
    if (!current || String(quote.collected_at) > current) latestCollectedAt.set(creatorId, String(quote.collected_at));
  }
  const stateByCreator = new Map((collectionStates ?? []).map((state) => [Number(state.creator_id), state]));
  const ageDays = (value: string | null | undefined) => value ? Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000) : null;
  const candidates = (creators ?? [])
    .map((creator) => ({
      creatorId: creator.id,
      displayName: creator.display_name,
      creatorXUrl: normalizeXProfileUrl(creator.creator_x_url),
      productCount: productCount.get(creator.id) ?? 0,
      need: freshPassCreators.has(creator.id) ? "既存fresh sourceあり。再収集不要" : "既存productにfresh Source Value PASSなし",
      eligible: !freshPassCreators.has(creator.id),
      lastCollectedAt: latestCollectedAt.get(creator.id) ?? null,
      lastProcessedAt: stateByCreator.get(creator.id)?.last_processed_at ?? null,
      collectionState: stateByCreator.get(creator.id)?.state ?? "ELIGIBLE",
    }))
    .filter((row) => row.creatorXUrl && row.eligible && row.collectionState !== "PRIVATE" && row.collectionState !== "NO_POSTS")
    .sort((a, b) => {
      const priority = (row: typeof a) => {
        const age = ageDays(row.lastCollectedAt) ?? ageDays(row.lastProcessedAt);
        if (age === null) return 3000;
        if (age >= 14) return 2500 + age;
        if (age >= 3) return 2000 + age;
        if (row.collectionState === "TEMP_ERROR" || row.collectionState === "THREAD_INCOMPLETE") return 1800 + age;
        return 1000 + age;
      };
      return priority(b) - priority(a) || b.productCount - a.productCount || a.creatorId - b.creatorId;
    })
    .slice(0, 5);
  return { candidates, reason: candidates.length ? "既存productにfresh sourceがないcreatorを最大5件選定" : "既存productにfresh source不足の対象なし" };
}

async function refreshJobCounts(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status,collected_count,collection_state,collection_evidence")
    .eq("job_id", jobId);
  if (error) throw error;

  const processed = (items ?? []).filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const success = (items ?? []).filter((item) => item.status === "success").length;
  const failed = (items ?? []).filter((item) => item.status === "failed").length;
  const completeThreadsFound = (items ?? []).filter((item) => Number(item.collected_count ?? 0) > 0).length;
  const noMatch = (items ?? []).filter((item) => item.collection_state === "NO_MATCH_THIS_RUN").length;
  const excludedNoPosts = (items ?? []).filter((item) => item.collection_state === "NO_POSTS").length;
  const excludedPrivate = (items ?? []).filter((item) => item.collection_state === "PRIVATE").length;
  const retryableErrors = (items ?? []).filter((item) => ["TEMP_ERROR", "THREAD_INCOMPLETE"].includes(item.collection_state)).length;
  const candidatesSaved = (items ?? []).reduce((total, item) => total + Number(item.collected_count ?? 0), 0);
  const runningItems = (items ?? []).some((item) => item.status === "running");
  const pendingItems = (items ?? []).some((item) => item.status === "pending");
  const currentJob = await getJob(jobId);
  const currentStatus = String(currentJob?.status ?? "pending");
  const status = recomputeQuoteRefreshStatus(currentStatus, runningItems, pendingItems);
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
      processed_creators: processed,
      success_creators: success,
      failed_creators: failed,
      accounts_processed: processed,
      complete_threads_found: completeThreadsFound,
      candidates_saved: candidatesSaved,
      no_match: noMatch,
      excluded_no_posts: excludedNoPosts,
      excluded_private: excludedPrivate,
      retryable_errors: retryableErrors,
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
  const evidenceRows = (items ?? []).map((item) => item.collection_evidence && typeof item.collection_evidence === "object" ? item.collection_evidence as Record<string, unknown> : {});
  const statusCounts = evidenceRows.reduce<{ navigationAttempted: number; threadsObserved: number; fullyObserved: number; authorReplies: number; threadLinks: number }>((total, evidence) => {
    const counts = evidence.statusCounts && typeof evidence.statusCounts === "object" ? evidence.statusCounts as Record<string, unknown> : {};
    total.navigationAttempted += Number(counts.navigationAttempted ?? 0);
    total.threadsObserved += Number(counts.threadsObserved ?? 0);
    total.fullyObserved += Number(counts.fullyObserved ?? 0);
    total.authorReplies += Number(counts.authorReplies ?? 0);
    total.threadLinks += Number(counts.threadLinks ?? 0);
    return total;
  }, { navigationAttempted: 0, threadsObserved: 0, fullyObserved: 0, authorReplies: 0, threadLinks: 0 });
  const profileCounts = evidenceRows.reduce<{ scanOk: number; articles: number; ownPosts: number; mediaPosts: number }>((total, evidence) => {
    const counts = evidence.profileCounts && typeof evidence.profileCounts === "object" ? evidence.profileCounts as Record<string, unknown> : {};
    total.scanOk += Number(counts.ownPosts ?? 0) > 0 ? 1 : 0;
    total.articles += Number(counts.articles ?? 0);
    total.ownPosts += Number(counts.ownPosts ?? 0);
    total.mediaPosts += Number(counts.mediaPosts ?? 0);
    return total;
  }, { scanOk: 0, articles: 0, ownPosts: 0, mediaPosts: 0 });
  return { job, items: items ?? [], skippedCreators: skipped, summary: { ...summary, accounts_processed: job?.accounts_processed ?? 0, profile_scan_ok: profileCounts.scanOk, status_navigation_attempted: statusCounts.navigationAttempted, status_threads_observed: statusCounts.threadsObserved, complete_threads_found: job?.complete_threads_found ?? 0, candidates_saved: job?.candidates_saved ?? 0, no_match: job?.no_match ?? 0, retryable: job?.retryable_errors ?? 0, excluded: (job?.excluded_no_posts ?? 0) + (job?.excluded_private ?? 0), profile_counts: profileCounts, status_counts: statusCounts } };
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

async function createJob(payload: Record<string, unknown>) {
  await assertDatabaseReady();
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = normalizeBatchSize(payload.batchSize);
  const queueLimit = Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, normalizeQueueLimit(payload.queueLimit) ?? batchSize);
  const sessionId = cleanText(payload.sessionId) || randomUUID();
  const runToken = cleanText(payload.runToken) || randomUUID();
  const existingForSession = await getCurrentSessionJob(approvedMediaId, sessionId);
  if (existingForSession) {
    return NextResponse.json({ ...(await progress(existingForSession.id)), reused: true, reason: "IDEMPOTENT_ACTIVE_SESSION" });
  }
  await reconcileLegacyActiveJobs();
  await reconcileStaleActiveJobs({ sessionId, runToken, collectorVersion: cleanText(payload.collectorVersion) || null });
  const targetedCreatorIds = normalizeTargetedCreatorIds(payload.targetedCreatorIds);
  const { data: creators, error } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,display_name,creator_x_url,is_active")
    .eq("is_active", true)
    .not("creator_x_url", "is", null)
    .neq("creator_x_url", "")
    .limit(1000);
  if (error) throw error;

  const creatorRows = (creators ?? [])
    .map((creator) => ({ ...creator, creator_x_url: normalizeXProfileUrl(creator.creator_x_url) }))
    .filter((creator) => creator.creator_x_url)
    .filter((creator) => !targetedCreatorIds.length || targetedCreatorIds.includes(creator.id));

  if (targetedCreatorIds.length && !creatorRows.length) return NextResponse.json({ error: "指定されたtarget creatorに有効なXプロフィールがありません。" }, { status: 400 });

  const orderedCreators = [...creatorRows].sort((a, b) => a.id - b.id);
  const { data: existingStates, error: stateError } = await supabaseAdmin
    .from("myfans_creator_collection_state")
    .select("creator_id,rotation_order,collection_enabled")
    .in("creator_id", orderedCreators.map((creator) => creator.id));
  if (stateError) throw stateError;
  const stateByCreator = new Map((existingStates ?? []).map((state) => [Number(state.creator_id), state]));
  const missingStates = orderedCreators
    .filter((creator) => !stateByCreator.has(creator.id))
    .map((creator) => ({ creator_id: creator.id, rotation_order: orderedCreators.findIndex((row) => row.id === creator.id) + 1, collection_enabled: true, state: "ELIGIBLE" }));
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
  const collectionAccounts = orderedCreators.map((creator) => {
    const state = stateByCreator.get(creator.id);
    return { creatorId: creator.id, rotationOrder: Number(state?.rotation_order ?? creator.id), collectionEnabled: state?.collection_enabled !== false };
  });
  const collectionRotation = selectCollectionAccounts(
    collectionAccounts,
    { cursorOrder: Number(cursor?.cursor_order ?? 0), cycleNo: Number(cursor?.cycle_no ?? 1) },
    targetedCreatorIds.length ? Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, targetedCreatorIds.length) : queueLimit,
  );
  const selectedIds = new Set(collectionRotation.selected.map((account) => account.creatorId));
  const prioritized = orderedCreators.filter((creator) => selectedIds.has(creator.id));
  if (targetedCreatorIds.length && !prioritized.length) return NextResponse.json({ error: "指定されたtarget creatorは収集対象外です。" }, { status: 400 });

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
      collector_version: cleanText(payload.collectorVersion) || null,
    };

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
  if (!sessionId || !runToken || activeJob.collection_session_id !== sessionId || activeJob.collection_run_token !== runToken || activeJob.collector_version !== collectorVersion) return NextResponse.json({ error: "JOB_IDENTITY_MISMATCH: Companion runとDB jobのidentityが一致しません。", errorCode: "JOB_IDENTITY_MISMATCH", job: activeJob }, { status: 409 });
  if (activeJob.status === "paused") return NextResponse.json({ paused: true, job: activeJob });
  if (activeJob.status === "cancelled") return NextResponse.json({ done: true, job: activeJob });
  if (!isActiveQuoteRefreshStatus(activeJob.status)) return NextResponse.json({ done: true, job: activeJob });
  if (sessionId && activeJob.collection_session_id !== sessionId) return NextResponse.json({ done: true, job: activeJob, reason: "session_mismatch" });

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

  const { data: stale } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id")
    .eq("job_id", activeJob.id)
    .eq("status", "running")
    .lt("processed_at", new Date(Date.now() - STALE_ITEM_AGE_MS).toISOString());
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

async function reconcileStaleActiveJobs(protectedIdentity?: { jobId?: number | null; sessionId?: string | null; runToken?: string | null; collectorVersion?: string | null }) {
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
  for (const item of items ?? []) itemsByJob.set(Number(item.job_id), [...(itemsByJob.get(Number(item.job_id)) ?? []), item]);
  const { data: cursor, error: cursorError } = await supabaseAdmin
    .from("myfans_collection_cursors")
    .select("cursor_order,cycle_no")
    .eq("collector_key", MYFANS_COLLECTION_KEY)
    .maybeSingle();
  if (cursorError) throw cursorError;

  const finalized: number[] = [];
  for (const job of jobs) {
    const jobItems = itemsByJob.get(Number(job.id)) ?? [];
    if (!isStaleQuoteRefreshJob(job, jobItems, Date.now(), protectedIdentity)) continue;
    const preview = staleQuoteRefreshCleanupPreview(job, jobItems, STALE_JOB_CLEANUP_REASON);
    if (!preview.changed) continue;
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
    const itemPatch = { status: "skipped", error: STALE_JOB_CLEANUP_REASON, processed_at: now, finished_at: now, request_type: "quote_scan", result_code: "STALE_JOB_CANCELLED", http_status: 200, diagnostics: { rotation_eligibility_preserved: true }, collection_state: "CANCELLED", collection_evidence: { final_collection_state: "CANCELLED", final_error: STALE_JOB_CLEANUP_REASON, rotation_eligibility_preserved: true } };
    const { error: pendingError } = await supabaseAdmin.from("myfans_quote_refresh_job_items").update(itemPatch).eq("job_id", job.id).eq("status", "pending");
    if (pendingError) throw pendingError;
    const { error: runningError } = await supabaseAdmin.from("myfans_quote_refresh_job_items").update(itemPatch).eq("job_id", job.id).eq("status", "running").lt("processed_at", new Date(Date.now() - STALE_ITEM_AGE_MS).toISOString());
    if (runningError) throw runningError;
    const { data: finalizedJob, error: jobError } = await supabaseAdmin.from("myfans_quote_refresh_jobs").update({ status: "cancelled", completed_at: now, last_error: STALE_JOB_CLEANUP_REASON }).eq("id", job.id).in("status", ["pending", "running"]).select("id").maybeSingle();
    if (jobError) throw jobError;
    if (!finalizedJob) continue;
    finalized.push(Number(job.id));
  }
  return finalized;
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
