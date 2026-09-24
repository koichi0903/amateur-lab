import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { scoreMyfansQuoteCandidate, type MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import { normalizeMyfansPostUrl, resolveExactMyfansProductByFinalUrl, resolveTextEvidence } from "@/lib/myfansProductResolver";
import { extractMyfansSourceText } from "@/lib/myfansSourceText";
import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { mergePersistedQuoteMediaEvidence } from "@/lib/myfansQuoteCandidateEvidence";
import { evaluateMyfansSourceValue } from "@/lib/myfansSourceValue";
import { isCompleteThreadCandidate } from "@/lib/myfansCompleteThread";
import { canonicalMyfansXHandle, resolveExactMyfansCreator } from "@/lib/myfansAuthorMatch";
import { companionPersistenceError, normalizeCompanionError } from "@/lib/myfansCompanionErrors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COLLECTOR_METHOD = "complete_thread_first_v2";
const COMPANION_PROTOCOL_VERSION = "2";

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(cleanText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function cleanAffiliateUrl(value: unknown) {
  const url = cleanText(value);
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/.test(url) ? url : "";
}

function cleanXStatusUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

function cleanXMediaPermalink(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)\/(photo|video)\/([1-9]\d*)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}/${match[3]}/${match[4]}` : "";
}

function cleanValidationStatus(value: unknown) {
  return cleanText(value).replace(/[^a-z0-9_:-]/gi, "").slice(0, 80);
}

function cleanMyfansUrl(value: unknown) {
  const raw = cleanText(value);
  return /^https?:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(raw) ? raw.replace(/[?#].*$/, "") : "";
}

const RESERVED_X_HANDLES = new Set(["home", "explore", "search", "intent", "share", "i", "notifications", "messages", "settings", "login", "signup"]);

function cleanXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/?$/);
  if (!match) return "";
  const handle = match[1];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || RESERVED_X_HANDLES.has(handle.toLowerCase())) return "";
  return `https://x.com/${handle}`;
}

type VisibleCreator = {
  displayName?: unknown;
  myfansUrl?: unknown;
  creatorXUrl?: unknown;
  sourceXHandle?: unknown;
  followerCount?: unknown;
  postsCount?: unknown;
  singleRewardRate?: unknown;
  planSignupRewardRate?: unknown;
  xUrlSource?: unknown;
  genre?: unknown;
};

type VisibleProduct = {
  productTitle?: unknown;
  productUrl?: unknown;
  affiliateUrl?: unknown;
  price?: unknown;
  rewardRate?: unknown;
  likesCount?: unknown;
  publishedAt?: unknown;
};

type QuoteScanPayload = {
  type?: unknown;
  productId?: unknown;
  creatorId?: unknown;
  creatorXUrl?: unknown;
  sourceXHandle?: unknown;
  refreshJobId?: unknown;
  refreshJobItemId?: unknown;
  failureReason?: unknown;
  quoteCandidates?: MyfansQuoteScanCandidate[];
  diagnosticMode?: boolean;
  diagnosticRunId?: unknown;
  sourceStatusUrl?: unknown;
  statusCandidate?: MyfansQuoteScanCandidate & { authorHandle?: unknown };
  singleStatusRunId?: unknown;
  collectionError?: unknown;
  collectionFailure?: { stage?: unknown; errorCode?: unknown; diagnostics?: Record<string, unknown>; transitions?: Array<Record<string, unknown>> };
  collectionStatuses?: Array<{ parentStatusUrl?: unknown; status?: unknown }>;
  stateTransitions?: Array<{ stage?: unknown; at?: unknown; [key: string]: unknown }>;
  profileCounts?: Record<string, unknown>;
  profileScan?: Record<string, unknown>;
  statusCounts?: Record<string, unknown>;
  collectionSessionId?: unknown;
  runToken?: unknown;
  collectorVersion?: unknown;
};

const THREAD_INCOMPLETE_STATUSES = new Set(["THREAD_NOT_FULLY_OBSERVED", "LINK_FOUND_THREAD_INCOMPLETE", "THREAD_INCOMPLETE_WITHOUT_LINK", "THREAD_OBSERVATION_FAILED", "OBSERVATION_NULL"]);

async function validateRunIdentity(payload: QuoteScanPayload) {
  const jobId = Number(payload.refreshJobId);
  const sessionId = cleanText(payload.collectionSessionId);
  const runToken = cleanText(payload.runToken);
  const collectorVersion = cleanText(payload.collectorVersion);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return { ok: false as const, error: "JOB_IDENTITY_MISMATCH: job_idがありません。" };
  const { data: job, error } = await supabaseAdmin.from("myfans_quote_refresh_jobs").select("id,collection_session_id,collection_run_token,collector_version,status").eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!job || !sessionId || !runToken || job.collection_session_id !== sessionId || job.collection_run_token !== runToken || job.collector_version !== collectorVersion || !["pending", "running", "paused"].includes(job.status)) {
    return { ok: false as const, error: "JOB_IDENTITY_MISMATCH: Companion runとDB jobのidentityが一致しません。" };
  }
  return { ok: true as const, job };
}

function xHandleFromUrl(value: string) {
  const match = cleanXProfileUrl(value).match(/^https:\/\/x\.com\/([^/?#]+)/);
  return match?.[1] ? `@${match[1]}` : "";
}

async function updateRefreshProgress(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status")
    .eq("job_id", jobId);
  if (error) throw error;
  const processed = (items ?? []).filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const success = (items ?? []).filter((item) => item.status === "success").length;
  const failed = (items ?? []).filter((item) => item.status === "failed").length;
  const hasRemaining = (items ?? []).some((item) => ["pending", "running"].includes(item.status));
  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      status: hasRemaining ? "running" : "completed",
      processed_creators: processed,
      success_creators: success,
      failed_creators: failed,
      completed_at: hasRemaining ? null : new Date().toISOString(),
    })
    .eq("id", jobId);
  if (updateError) throw updateError;
}

async function updateSensitiveGateStreak(jobId: number, error: string | undefined) {
  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("sensitive_gate_streak,sensitive_gate_streak_limit")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  const isGate = quoteRefreshErrorCode(error) === "SENSITIVE_CONTENT_GATE";
  const streak = isGate ? (job.sensitive_gate_streak ?? 0) + 1 : 0;
  const shouldStop = isGate && streak >= (job.sensitive_gate_streak_limit ?? 3);
  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      sensitive_gate_streak: streak,
      ...(shouldStop ? {
        status: "paused",
        stopped_reason: `SENSITIVE_CONTENT_GATEが${streak}件連続したため停止。未処理creatorは持ち越し。`,
        last_error: `SENSITIVE_CONTENT_GATEが${streak}件連続したため、安全側で停止しました。`,
      } : {}),
    })
    .eq("id", jobId);
  if (updateError) throw updateError;
}

const NON_RETRYABLE_QUOTE_REFRESH_ERRORS = new Set(["LOGIN_OR_CHALLENGE", "PROFILE_NOT_FOUND/SUSPENDED", "SENSITIVE_CONTENT_GATE", "NO_POSTS", "PRIVATE"]);

function quoteRefreshErrorCode(error: string | undefined) {
  return cleanText(error).match(/^([A-Z_/]+):\s*/)?.[1] || "";
}

const DIAGNOSTIC_SECRET_KEY = /cookie|token|authorization|password|secret|session.?id|run.?token|body|html|article.?text|text.?sample/i;

function safeDiagnostics(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 240);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => safeDiagnostics(entry, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 60).map(([key, entry]) => [
      key,
      DIAGNOSTIC_SECRET_KEY.test(key) ? "[redacted]" : safeDiagnostics(entry, depth + 1),
    ]));
  }
  return null;
}

function isFatalSessionAuth(errorCode: string, message: string) {
  return errorCode === "FATAL_SESSION_AUTH" || /FATAL_SESSION_AUTH|SESSION_AUTH_LOST|AUTH_SESSION_EXPIRED/i.test(`${errorCode} ${message}`);
}

async function markFatalSessionAuth(payload: QuoteScanPayload, detail: { error: string; diagnostics?: Record<string, unknown> }) {
  const jobId = Number(payload.refreshJobId);
  const itemId = Number(payload.refreshJobItemId);
  const identity = await validateRunIdentity(payload);
  if (!identity.ok) throw new Error(identity.error);
  const now = new Date().toISOString();
  const diagnostics = safeDiagnostics(detail.diagnostics ?? {}) as Record<string, unknown>;
  const itemPatch = {
    status: "failed",
    error: detail.error,
    request_type: "quote_scan",
    result_code: "FATAL_SESSION_AUTH",
    http_status: 401,
    diagnostics,
    finished_at: now,
    processed_at: now,
  };
  if (Number.isSafeInteger(itemId) && itemId > 0) {
    const { error } = await supabaseAdmin.from("myfans_quote_refresh_job_items").update(itemPatch).eq("id", itemId).eq("job_id", jobId);
    if (error) throw error;
  }
  const { error: pendingError } = await supabaseAdmin.from("myfans_quote_refresh_job_items")
    .update({ status: "skipped", error: "FATAL_SESSION_AUTH: session/auth喪失のため未実行", request_type: "quote_scan", result_code: "FATAL_SESSION_AUTH", http_status: 401, diagnostics: { fatal: true }, finished_at: now, processed_at: now })
    .eq("job_id", jobId).in("status", ["pending", "running"]).neq("id", itemId);
  if (pendingError) throw pendingError;
  const { error: jobError } = await supabaseAdmin.from("myfans_quote_refresh_jobs").update({ status: "failed", completed_at: now, last_error: detail.error }).eq("id", jobId).in("status", ["pending", "running"]);
  if (jobError) throw jobError;
}

async function terminalCollectionReport(payload: QuoteScanPayload, errorCode: string, message: string, diagnostics: Record<string, unknown> = {}) {
  const error = `${errorCode}: ${message}`;
  if (isFatalSessionAuth(errorCode, message)) {
    await markFatalSessionAuth(payload, { error, diagnostics });
  } else {
    await markRefreshItem(payload, "failed", { error, diagnostics, evidence: { terminalReport: true, diagnostics: safeDiagnostics(diagnostics) } });
  }
  return NextResponse.json({ ok: false, terminal: true, retryable: false, skipped: errorCode === "LOGIN_OR_CHALLENGE", errorCode, error, diagnostics: safeDiagnostics(diagnostics) }, { status: isFatalSessionAuth(errorCode, message) ? 401 : 200 });
}

async function markRefreshItem(payload: QuoteScanPayload, status: "success" | "failed", detail: { collectedCount?: number; topScore?: number | null; error?: string; diagnostics?: Record<string, unknown>; evidence?: Record<string, unknown> }) {
  const jobId = Number(payload.refreshJobId);
  const itemId = Number(payload.refreshJobItemId);
  if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isFinite(itemId) || itemId <= 0) return;
  const identity = await validateRunIdentity(payload);
  if (!identity.ok) throw new Error(identity.error);
  const { data: job } = await supabaseAdmin.from("myfans_quote_refresh_jobs").select("status").eq("id", jobId).maybeSingle();
  if (job?.status === "cancelled" || job?.status === "failed") return;
  const { data: currentItem } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("attempts")
    .eq("id", itemId)
    .eq("job_id", jobId)
    .maybeSingle();
  const retryableWithinJob = status === "failed" && quoteRefreshErrorCode(detail.error) !== "" && Number(currentItem?.attempts ?? 0) < 3;
  const finalStatus =
    status === "failed" && NON_RETRYABLE_QUOTE_REFRESH_ERRORS.has(quoteRefreshErrorCode(detail.error))
      ? "skipped"
      : retryableWithinJob
        ? "pending"
      : status;
  const errorCode = quoteRefreshErrorCode(detail.error);
  const terminal = finalStatus === "success" || finalStatus === "failed" || finalStatus === "skipped";
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({
      status: finalStatus,
      collected_count: detail.collectedCount ?? 0,
      top_score: detail.topScore ?? null,
      error: detail.error ?? null,
      request_type: "quote_scan",
      result_code: errorCode || (finalStatus === "success" ? ((detail.collectedCount ?? 0) > 0 ? "SUCCESS_SAVE" : "NO_CANDIDATES") : "COLLECTION_FAILED"),
      http_status: finalStatus === "success" ? 200 : finalStatus === "skipped" ? 200 : 200,
      diagnostics: safeDiagnostics(detail.diagnostics ?? detail.evidence ?? {}),
      ...(terminal ? { finished_at: new Date().toISOString() } : {}),
      collection_state: collectionStateForResult(status, detail),
      collection_evidence: { collectorMethod: COLLECTOR_METHOD, job_id: jobId, collection_session_id: cleanText(payload.collectionSessionId), run_token: cleanText(payload.runToken), collector_version: cleanText(payload.collectorVersion), final_collection_state: collectionStateForResult(status, detail), final_error: detail.error ?? null, error: detail.error ?? null, collectedCount: detail.collectedCount ?? 0, ...(detail.evidence ?? {}) },
      processed_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("job_id", jobId);
  if (error) throw error;
  const { data: item } = await supabaseAdmin.from("myfans_quote_refresh_job_items").select("creator_id").eq("id", itemId).eq("job_id", jobId).maybeSingle();
  const creatorId = Number(payload.creatorId) || Number(item?.creator_id) || 0;
  if (creatorId > 0) {
    const state = collectionStateForResult(status, detail);
    const permanent = state === "NO_POSTS" || state === "PRIVATE";
    const { data: existingState } = await supabaseAdmin.from("myfans_creator_collection_state").select("rotation_order").eq("creator_id", creatorId).maybeSingle();
    const { error: stateError } = await supabaseAdmin.from("myfans_creator_collection_state").upsert({
      creator_id: creatorId,
      rotation_order: Number(existingState?.rotation_order ?? creatorId),
      collection_enabled: !permanent,
      state,
      exclusion_reason: permanent ? state.toLowerCase() : null,
      excluded_at: permanent ? new Date().toISOString() : null,
      last_processed_at: new Date().toISOString(),
      last_run_id: jobId,
      evidence: { collectorMethod: COLLECTOR_METHOD, error: detail.error ?? null, collectedCount: detail.collectedCount ?? 0, ...(detail.evidence ?? {}) },
      updated_at: new Date().toISOString(),
    }, { onConflict: "creator_id" });
    if (stateError) throw stateError;
    if (finalStatus === "success" || finalStatus === "skipped") {
      const { data: cursor } = await supabaseAdmin.from("myfans_collection_cursors").select("cursor_order,cycle_no").eq("collector_key", "myfans_quote_refresh").maybeSingle();
      const terminalOrder = Number(existingState?.rotation_order ?? creatorId);
      const currentCursorOrder = Number(cursor?.cursor_order ?? 0);
      let cursorAfterOrder = currentCursorOrder;
      let cycleCompleted = false;
      let cycleNo = Number(cursor?.cycle_no ?? 1);
      if (terminalOrder > currentCursorOrder) {
        const { data: lastEligible } = await supabaseAdmin.from("myfans_creator_collection_state").select("rotation_order").eq("collection_enabled", true).order("rotation_order", { ascending: false }).limit(1).maybeSingle();
        cycleCompleted = terminalOrder >= Number(lastEligible?.rotation_order ?? terminalOrder);
        cursorAfterOrder = cycleCompleted ? 0 : terminalOrder;
        cycleNo += cycleCompleted ? 1 : 0;
        const { error: cursorError } = await supabaseAdmin.from("myfans_collection_cursors").upsert({
          collector_key: "myfans_quote_refresh",
          cursor_order: cursorAfterOrder,
          cycle_no: cycleNo,
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "collector_key" });
        if (cursorError) throw cursorError;
      }
      const { error: jobCursorError } = await supabaseAdmin.from("myfans_quote_refresh_jobs").update({
        cursor_after_order: cursorAfterOrder,
        collection_cycle_no: cycleNo,
        cycle_completed: cycleCompleted,
      }).eq("id", jobId);
      if (jobCursorError) throw jobCursorError;
    }
  }
  await updateSensitiveGateStreak(jobId, detail.error);
  await updateRefreshProgress(jobId);
}

function collectionStateForResult(status: "success" | "failed", detail: { collectedCount?: number; error?: string }) {
  const code = quoteRefreshErrorCode(detail.error);
  if (code === "NO_POSTS") return "NO_POSTS";
  if (code === "PRIVATE") return "PRIVATE";
  if (THREAD_INCOMPLETE_STATUSES.has(code)) return "THREAD_INCOMPLETE";
  if (code === "LOGIN_OR_CHALLENGE" || code === "X_TEMPORARY_ERROR" || code === "SENSITIVE_CONTENT_GATE") return "TEMP_ERROR";
  if (status === "success" && (detail.collectedCount ?? 0) > 0) return "ELIGIBLE";
  if (status === "success") return "NO_MATCH_THIS_RUN";
  return "TEMP_ERROR";
}

async function updateGlobalQuoteRanks(approvedMediaId: number | null) {
  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,creator_id,creator_x_url,score,creator_rank,collected_at,cooldown_until,last_used_at,use_count,is_repost,x_post_url,media_type,media_permalink,quote_visual_ready,media_permalink_validation_status,visual_score")
    .lte("creator_rank", 3)
    .gte("score", 55)
    .order("score", { ascending: false })
    .limit(500);
  if (approvedMediaId) query = query.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;

  const now = new Date().toISOString();
  const rows = (data ?? [])
    .filter((row) => !row.is_repost && !row.last_used_at && (!row.cooldown_until || row.cooldown_until <= now))
    .map((row) => {
      const ageDays = row.collected_at ? Math.max(0, (Date.now() - new Date(row.collected_at).getTime()) / 86_400_000) : 7;
      const visualBoost = row.quote_visual_ready && row.media_permalink
        ? row.media_type === "video" ? 18 : row.media_type === "image" ? 12 : 0
        : row.visual_score ? -12 : 0;
      const renderStatus = row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink")
        ? "browser_visible"
        : /not_rendered/i.test(row.media_permalink_validation_status ?? "")
          ? "app_only"
          : "blocked";
      const visualStatusPenalty = renderStatus === "browser_visible" ? 0 : renderStatus === "app_only" ? 30 : 45;
      const globalScore = Math.round(Math.max(0, Math.min(120, row.score + visualBoost + Math.max(0, 10 - ageDays) - ((row.creator_rank ?? 3) - 1) * 4 - (row.use_count ?? 0) * 12)));
      return { ...row, globalScore: Math.max(0, globalScore - visualStatusPenalty) };
    })
    .sort((a, b) => b.globalScore - a.globalScore || b.score - a.score);

  const { error: resetError } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ global_rank: null, selected_for_today: false })
    .or(approvedMediaId ? `approved_media_id.eq.${approvedMediaId},approved_media_id.is.null` : "approved_media_id.is.null,approved_media_id.not.is.null");
  if (resetError) throw resetError;

  const selectedCreators = new Set<string>();
  let selectedCount = 0;
  for (const [index, row] of rows.entries()) {
    const key = row.creator_id ? `creator:${row.creator_id}` : `x:${String(row.creator_x_url).toLowerCase()}`;
    const isVisualReady = Boolean(row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink"));
    const selectedForToday = isVisualReady && !selectedCreators.has(key) && (selectedCount === 0 || row.globalScore >= 78) && selectedCount < 2;
    if (selectedForToday) {
      selectedCreators.add(key);
      selectedCount += 1;
    }
    const { error: updateError } = await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({ global_score: row.globalScore, global_rank: index + 1, selected_for_today: selectedForToday })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
}

async function saveQuoteCandidate(record: Record<string, unknown>, creatorId: number, existingCandidateId?: number | null) {
  const postUrl = cleanXStatusUrl(record.x_post_url);
  const query = existingCandidateId
    ? supabaseAdmin.from("myfans_quote_candidates").select("id,selected,media_type,media_permalink,media_count,quote_visual_ready,media_permalink_validation_status,media_permalink_verified_at,visual_score,has_image,has_video").eq("id", existingCandidateId).maybeSingle()
    : supabaseAdmin.from("myfans_quote_candidates").select("id,selected,media_type,media_permalink,media_count,quote_visual_ready,media_permalink_validation_status,media_permalink_verified_at,visual_score,has_image,has_video").eq("creator_id", creatorId).eq("x_post_url", postUrl).order("id", { ascending: true }).limit(1).maybeSingle();
  const { data: existing, error: findError } = await query;
  if (findError) throw findError;
  if (existing?.id) {
    const mergedRecord = mergePersistedQuoteMediaEvidence(existing, record);
    const { error } = await supabaseAdmin.from("myfans_quote_candidates").update({ ...record, ...mergedRecord, selected: Boolean(existing.selected) }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.from("myfans_quote_candidates").insert(record).select("id").single();
  if (error) throw error;
  return data?.id ?? null;
}

let resolverProductsCache: Awaited<ReturnType<typeof fetchResolverProductsFromDb>> | null = null;

async function fetchResolverProductsFromDb() {
  const { data, error } = await supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,approved_media_id,title,product_url,genre,product_type,status,price,reward_rate,estimated_reward,plan_signup_reward,recurring_reward_rate,popularity_rank,likes_count,saves_count,is_new,source_x_url,creator_x_url,quote_candidate_x_url,affiliate_url,media_permission_status,media_permission_note,selection_reason,approved_media_name,approved_media_url,affiliate_media_id,selection_score,launch_priority,created_at")
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

async function fetchResolverProducts() {
  resolverProductsCache ??= await fetchResolverProductsFromDb();
  return resolverProductsCache;
}

async function saveCompanionImport(record: Record<string, unknown>, payloadHash: string) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("myfans_companion_imports")
    .select("id")
    .eq("payload_hash", payloadHash)
    .maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("myfans_companion_imports").update(record).eq("id", existing.id);
    if (error) throw error;
    return existing.id as number;
  }

  const { data, error } = await supabaseAdmin.from("myfans_companion_imports").insert(record).select("id").single();
  if (error) throw error;
  return data.id as number;
}

async function saveCreator(record: { display_name: string; myfans_url: string; creator_x_url?: string; source_x_handle?: string; latest_quote_x_url?: string; genre?: string; activity_note?: string; x_url_source?: string }) {
  const creatorXUrl = cleanXProfileUrl(record.creator_x_url);
  const sourceXHandle = creatorXUrl ? xHandleFromUrl(creatorXUrl) : "";
  const normalized = { ...record, creator_x_url: creatorXUrl, source_x_handle: sourceXHandle };
  if (record.myfans_url) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("myfans_creators")
      .select("id,creator_x_url,source_x_handle")
      .eq("myfans_url", record.myfans_url)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const existingXUrl = cleanXProfileUrl(existing.creator_x_url);
      if (creatorXUrl && existingXUrl && creatorXUrl.toLowerCase() !== existingXUrl.toLowerCase()) {
        const conflict = { existingXUrl, incomingXUrl: creatorXUrl, source: record.x_url_source || "chrome_companion", detectedAt: new Date().toISOString() };
        await supabaseAdmin.from("myfans_audit_logs").insert({
          entity_type: "creator",
          entity_id: existing.id,
          action: "creator_x_url_conflict",
          summary: record.display_name,
          metadata: conflict,
        });
        const { data, error } = await supabaseAdmin
          .from("myfans_creators")
          .update({ display_name: record.display_name, genre: record.genre ?? "", activity_note: `${record.activity_note ?? ""} X URL不一致のため既存URLを維持。`, x_url_conflict: conflict, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as number;
      }
      const updateRecord = Object.fromEntries(Object.entries({
        ...normalized,
        creator_x_url: existingXUrl || creatorXUrl || undefined,
        source_x_handle: existing.source_x_handle || sourceXHandle || undefined,
        x_url_source: existingXUrl ? undefined : normalized.x_url_source,
        updated_at: new Date().toISOString(),
      }).filter(([, value]) => value !== undefined));
      const { data, error } = await supabaseAdmin
        .from("myfans_creators")
        .update(updateRecord)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      if (!existingXUrl && creatorXUrl) {
        await supabaseAdmin
          .from("myfans_products")
          .update({ creator_x_url: creatorXUrl, updated_at: new Date().toISOString() })
          .eq("creator_id", existing.id)
          .or("creator_x_url.is.null,creator_x_url.eq.");
      }
      return data.id as number;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("myfans_creators")
    .insert({ ...normalized, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

async function saveProduct(record: Record<string, unknown>, productUrl: string) {
  if (productUrl) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("myfans_products")
      .select("id")
      .eq("product_url", productUrl)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("myfans_products")
        .update(record)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as number;
    }
  }

  const { data, error } = await supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  if (error) throw error;
  return data.id as number;
}

function parseObservedPrice(value: unknown) {
  const parsed = Number(cleanText(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function isMissingSupplyColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && /column .* does not exist|schema cache/i.test(error.message));
}

type SupplyEvidenceRow = {
  id: number;
  source_status_url: string;
  discovered_myfans_url: string;
  final_myfans_url: string | null;
  product_id: number | null;
  resolution_method: string;
  confidence: string;
  evidence_source: string;
  metadata: Record<string, unknown> | null;
  verified_at: string;
  resolution_history?: unknown;
};

async function importObservedMyfansPost(payload: Record<string, unknown>, approvedMediaId: number | null) {
  const productUrl = normalizeMyfansPostUrl(cleanText(payload.productUrl || payload.pageUrl));
  const title = cleanText(payload.productTitle || payload.title);
  if (!productUrl || !title) {
    return NextResponse.json({ error: "myfans投稿のcanonical URLと表示タイトルが必要です。" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const price = parseObservedPrice(payload.price);
  const likesCount = Math.round(numberValue(payload.likesCount));
  const sourceMetadata = {
    observed_url: productUrl,
    observed_title: title,
    observed_creator_name: cleanText(payload.creatorName),
    observed_genre: cleanText(payload.genre),
    observed_likes_count: likesCount,
    observed_published_at: cleanText(payload.publishedAt),
    observed_price: price || null,
    creator_linkage: "not_inferred_from_post_url",
    affiliate_linkage: "not_observed",
  };
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title,creator_id,affiliate_url,price,status,likes_count")
    .eq("product_url", productUrl)
    .maybeSingle();
  if (existingError) throw existingError;

  const record = {
    ...(existing ? {} : { creator_id: null, affiliate_url: "", source_x_url: "", genre: cleanText(payload.genre), product_type: "single", status: "candidate", price: 0, reward_rate: 0, estimated_reward: 0, plan_signup_reward: 0, recurring_reward_rate: 0, likes_count: 0, saves_count: 0, is_new: false, selection_reason: "通常Chromeで表示確認したmyfans投稿の最小商品レコード。creator/affiliateは未推測。", selection_score: 0, launch_priority: "low" }),
    ...(approvedMediaId ? { approved_media_id: approvedMediaId } : {}),
    title,
    product_url: productUrl,
    ...(price > 0 && Number(existing?.price ?? 0) === 0 ? { price } : {}),
    ...(Number(existing?.likes_count ?? 0) === 0 ? { likes_count: likesCount } : {}),
    ingest_source: "chrome_observed_myfans_post",
    source_observed_at: now,
    source_metadata: sourceMetadata,
    updated_at: now,
  };
  const legacyRecord = Object.fromEntries(Object.entries(record).filter(([key]) => !["ingest_source", "source_observed_at", "source_metadata"].includes(key)));
  const query = existing
    ? supabaseAdmin.from("myfans_products").update(record).eq("id", existing.id).select("id").single()
    : supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  let { data: saved, error: saveError } = await query;
  if (isMissingSupplyColumn(saveError)) {
    const legacyQuery = existing
      ? supabaseAdmin.from("myfans_products").update(legacyRecord).eq("id", existing.id).select("id").single()
      : supabaseAdmin.from("myfans_products").insert(legacyRecord).select("id").single();
    ({ data: saved, error: saveError } = await legacyQuery);
  }
  if (saveError) throw companionPersistenceError(saveError, "myfans_product_import");
  if (!saved) throw new Error("myfans商品の保存結果を取得できませんでした。");
  const productId = Number(saved.id);

  const evidenceQuery = await supabaseAdmin
    .from("myfans_post_product_linkage_evidence")
    .select("id,source_status_url,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,metadata,verified_at,resolution_history")
    .or(`final_myfans_url.eq.${productUrl},discovered_myfans_url.eq.${productUrl}`);
  let evidenceSelectError = evidenceQuery.error;
  let evidenceRows = (evidenceQuery.data ?? []) as SupplyEvidenceRow[];
  if (isMissingSupplyColumn(evidenceSelectError)) {
    const fallbackEvidence = await supabaseAdmin
      .from("myfans_post_product_linkage_evidence")
      .select("id,source_status_url,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,metadata,verified_at")
      .or(`final_myfans_url.eq.${productUrl},discovered_myfans_url.eq.${productUrl}`);
    evidenceRows = (fallbackEvidence.data ?? []) as SupplyEvidenceRow[];
    evidenceSelectError = fallbackEvidence.error;
  }
  if (evidenceSelectError) throw companionPersistenceError(evidenceSelectError, "myfans_evidence_lookup");
  let promotedEvidence = 0;
  for (const evidence of evidenceRows ?? []) {
    if (evidence.confidence === "exact" && evidence.product_id === productId) continue;
    const history = Array.isArray(evidence.resolution_history) ? evidence.resolution_history : [];
    const nextHistory = [...history, {
      at: now,
      from: { product_id: evidence.product_id, confidence: evidence.confidence, resolution_method: evidence.resolution_method, final_myfans_url: evidence.final_myfans_url },
      reason: "canonical myfans post product upsert",
    }].slice(-20);
    const promotion = {
      final_myfans_url: productUrl,
      product_id: productId,
      resolution_method: "exact_product_url",
      confidence: "exact",
      metadata: { ...(evidence.metadata && typeof evidence.metadata === "object" ? evidence.metadata : {}), promoted_from_supply_import: true, promoted_at: now },
      resolution_history: nextHistory,
      updated_at: now,
    };
    let { error: promoteError } = await supabaseAdmin
      .from("myfans_post_product_linkage_evidence")
      .update(promotion)
      .eq("id", evidence.id);
    if (isMissingSupplyColumn(promoteError)) {
      const legacyPromotion = Object.fromEntries(Object.entries(promotion).filter(([key]) => key !== "resolution_history"));
      ({ error: promoteError } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").update(legacyPromotion).eq("id", evidence.id));
    }
    if (promoteError) throw companionPersistenceError(promoteError, "myfans_evidence_promotion");
    promotedEvidence += 1;
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "evidence",
      entity_id: evidence.id,
      action: "resolver_exact_promotion",
      summary: productUrl,
      metadata: { productId, previousConfidence: evidence.confidence, previousProductId: evidence.product_id, source: "myfans_post_supply_import" },
    });
  }
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "product",
    entity_id: productId,
    action: existing ? "myfans_post_supply_refresh" : "myfans_post_supply_import",
    summary: title,
    metadata: sourceMetadata,
  });
  return NextResponse.json({ ok: true, importedType: "post_product", id: productId, productUrl, promotedEvidence, affiliateReady: Boolean(existing?.affiliate_url) });
}

type ExactProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

function extractFinalMyfansUrl(candidate: QuoteScanPayload["statusCandidate"]) {
  const direct = Array.isArray(candidate?.myfansUrls) ? candidate.myfansUrls : [];
  const evidence = Array.isArray(candidate?.resolvedProductEvidence) ? candidate.resolvedProductEvidence : [];
  return [...direct, ...evidence.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).finalMyfansUrl : "")]
    .map((url) => normalizeMyfansPostUrl(cleanMyfansUrl(url)))
    .find(Boolean) || "";
}

function htmlMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

async function observeMyfansPostForImport(finalMyfansUrl: string) {
  try {
    const response = await fetch(finalMyfansUrl, { signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!response.ok) return { title: "", price: 0, reason: `MYFANS_PAGE_HTTP_${response.status}` };
    const html = await response.text();
    const title = htmlMeta(html, ["og:title", "twitter:title"]) || cleanText(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]);
    const price = htmlMeta(html, ["product:price:amount", "og:price:amount"]);
    return { title, price: price ? parseObservedPrice(price) : 0, reason: title ? "og_metadata" : "TITLE_NOT_OBSERVED" };
  } catch (error) {
    return { title: "", price: 0, reason: error instanceof Error ? error.message.slice(0, 180) : "MYFANS_PAGE_FETCH_FAILED" };
  }
}

async function ensureExactProductForCreator(finalMyfansUrl: string, creatorId: number, approvedMediaId: number | null): Promise<ExactProductResolution> {
  const canonicalUrl = normalizeMyfansPostUrl(finalMyfansUrl);
  if (!canonicalUrl) return { product: null, status: "blocked", method: "invalid_final_myfans_url", missing: ["canonical MyFans post URL"] };
  const { data: matches, error: findError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price")
    .eq("product_url", canonicalUrl);
  if (findError) throw findError;
  if ((matches ?? []).length > 1) return { product: null, status: "ambiguous", method: "exact_canonical_url_duplicate", missing: [] };
  if ((matches ?? []).length === 1) {
    const existing = matches[0] as Record<string, unknown>;
    if (existing.creator_id != null && Number(existing.creator_id) !== creatorId) {
      return { product: null, status: "ambiguous", method: "exact_url_creator_conflict", missing: [] };
    }
    const { data: updated, error } = await supabaseAdmin.from("myfans_products")
      .update({ creator_id: creatorId, ...(approvedMediaId ? { approved_media_id: approvedMediaId } : {}), updated_at: new Date().toISOString() })
      .eq("id", existing.id).select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price").single();
    if (error) throw error;
    return { product: updated as Record<string, unknown>, status: "exact", method: "existing_canonical_url_then_creator_exact", missing: [] };
  }

  const observed = await observeMyfansPostForImport(canonicalUrl);
  if (!observed.title) return { product: null, status: "blocked", method: "canonical_url_observed_title_missing", missing: ["MyFans表示タイトル", observed.reason] };
  const imported = await importObservedMyfansPost({ productUrl: canonicalUrl, productTitle: observed.title, price: observed.price, pageUrl: canonicalUrl }, approvedMediaId);
  const importedBody = await imported.json().catch(() => ({}));
  if (!imported.ok || !importedBody?.id) throw new Error(`MYFANS_PRODUCT_IMPORT_FAILED: ${String(importedBody?.error || imported.status)}`);
  const { data: linked, error: linkError } = await supabaseAdmin.from("myfans_products")
    .update({ creator_id: creatorId, updated_at: new Date().toISOString() }).eq("id", Number(importedBody.id))
    .select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price").single();
  if (linkError) throw linkError;
  return { product: linked as Record<string, unknown>, status: "exact", method: "canonical_url_observed_import_then_creator_exact", missing: [] };
}

async function saveQuoteScan(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const parsedProductId = Number(payload.productId);
  const parsedCreatorId = Number(payload.creatorId);
  const productId = Number.isFinite(parsedProductId) && parsedProductId > 0 ? parsedProductId : null;
  const creatorId = Number.isFinite(parsedCreatorId) && parsedCreatorId > 0 ? parsedCreatorId : null;
  const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const failureReason = cleanText(payload.failureReason);
  const candidates = Array.isArray(payload.quoteCandidates) ? payload.quoteCandidates.slice(0, 20) : [];
  const collectionEvidence = {
    job_id: Number(payload.refreshJobId) || null,
    collection_session_id: cleanText(payload.collectionSessionId) || null,
    run_token: cleanText(payload.runToken) || null,
    collector_version: cleanText(payload.collectorVersion) || null,
    stateTransitions: Array.isArray(payload.stateTransitions) ? payload.stateTransitions.slice(-80) : [],
    profileCounts: payload.profileCounts && typeof payload.profileCounts === "object" ? payload.profileCounts : {},
    profileScan: payload.profileScan && typeof payload.profileScan === "object" ? payload.profileScan : {},
    statusCounts: payload.statusCounts && typeof payload.statusCounts === "object" ? payload.statusCounts : {},
    collectionStatuses: Array.isArray(payload.collectionStatuses) ? payload.collectionStatuses : [],
    final_collection_state: null,
    final_error: null,
  };
  if (Number.isFinite(Number(payload.refreshJobId)) && Number(payload.refreshJobId) > 0 && Number.isFinite(Number(payload.refreshJobItemId)) && Number(payload.refreshJobItemId) > 0) {
    const { data: existingItem } = await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .select("status,collection_state,collected_count")
      .eq("id", Number(payload.refreshJobItemId))
      .eq("job_id", Number(payload.refreshJobId))
      .maybeSingle();
    if (existingItem && ["success", "failed", "skipped"].includes(existingItem.status)) {
      await supabaseAdmin.from("myfans_audit_logs").insert({
        entity_type: "quote_refresh_job_item",
        entity_id: Number(payload.refreshJobItemId),
        action: "duplicate_batch_save_ignored",
        summary: "既にterminalのbatch itemへの重複保存を無視",
        metadata: { jobId: Number(payload.refreshJobId), status: existingItem.status, collectionState: existingItem.collection_state ?? null },
      });
      return NextResponse.json({ ok: true, replayed: true, candidatesCount: Number(existingItem.collected_count ?? 0), collectionState: existingItem.collection_state ?? null });
    }
  }
  if (failureReason) {
    const errorCode = quoteRefreshErrorCode(failureReason) || "COLLECTION_FAILED";
    return terminalCollectionReport(payload, errorCode, failureReason.replace(/^[A-Z_/]+:\s*/, ""), {
      collectionFailure: payload.collectionFailure ?? null,
      collectionStatuses: payload.collectionStatuses ?? [],
      stateTransitions: payload.stateTransitions ?? [],
    });
  }
  if (candidates.length === 0 && Array.isArray(payload.collectionStatuses) && payload.collectionStatuses.length > 0 && cleanXProfileUrl(payload.creatorXUrl)) {
    const creatorIdForAudit = Number(payload.creatorId);
    if (Number.isSafeInteger(creatorIdForAudit) && creatorIdForAudit > 0) {
      await supabaseAdmin.from("myfans_audit_logs").insert({
        entity_type: "creator",
        entity_id: creatorIdForAudit,
        action: "complete_thread_collection_status",
        summary: `${COLLECTOR_METHOD}: no eligible parent`,
        metadata: { collectorMethod: COLLECTOR_METHOD, statuses: payload.collectionStatuses, ...collectionEvidence },
      });
    }
    const incomplete = payload.collectionStatuses.some((item) => THREAD_INCOMPLETE_STATUSES.has(cleanText(item.status)));
    const reason = payload.collectionStatuses.find((item) => THREAD_INCOMPLETE_STATUSES.has(cleanText(item.status)))?.status || "THREAD_INCOMPLETE_WITHOUT_LINK";
    const error = incomplete ? `${reason}: status threadを十分に観測できませんでした。` : undefined;
    await markRefreshItem(payload, incomplete ? "failed" : "success", { collectedCount: 0, topScore: null, error, evidence: collectionEvidence });
    return NextResponse.json({ ok: !incomplete, retryable: incomplete, errorCode: incomplete ? reason : null, importedType: "quote_candidates", candidatesCount: 0, collectionStatuses: payload.collectionStatuses, profileCounts: payload.profileCounts ?? {}, statusCounts: payload.statusCounts ?? {}, stateTransitions: payload.stateTransitions ?? [], ...(error ? { error } : {}) }, { status: incomplete ? 202 : 200 });
  }
  if (!creatorXUrl || !sourceXHandle) {
    return NextResponse.json({ error: "creatorXUrlとsourceXHandleが必要です。", errorCode: "INVALID_PAYLOAD" }, { status: 400 });
  }
  if (candidates.length === 0) {
    return terminalCollectionReport(payload, "NO_CANDIDATES", "Xプロフィール上に保存可能な投稿候補がありません。", collectionEvidence);
  }

  const productQuery = productId
    ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("id", productId).maybeSingle()
    : creatorId
      ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("creator_id", creatorId).order("selection_score", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null });
  const { data: product, error: productError } = await productQuery;
  if (productError) throw productError;

  const resolvedCreatorId = creatorId ?? product?.creator_id;
  if (!resolvedCreatorId) {
    return terminalCollectionReport(payload, "CREATOR_NOT_FOUND", "Daily Pageの対象creatorを取得できませんでした。", collectionEvidence);
  }

  const normalized = candidates
    .map((candidate) => {
      const mediaType = cleanText(candidate.mediaType);
      return {
        ...candidate,
        xPostUrl: cleanXStatusUrl(candidate.xPostUrl),
        parentStatusUrl: cleanXStatusUrl(candidate.parentStatusUrl || candidate.xPostUrl),
        parentStatusId: cleanText(candidate.parentStatusId) || null,
        ownReplyStatusUrl: cleanXStatusUrl(candidate.ownReplyStatusUrl),
        ownReplyStatusId: cleanText(candidate.ownReplyStatusId) || null,
        myfansLinkSource: candidate.myfansLinkSource === "own_reply" ? "own_reply" : candidate.myfansLinkSource === "parent" ? "parent" : null,
        threadCollectionStatus: cleanText(candidate.threadCollectionStatus) || "LEGACY",
        collectorMethod: cleanText(candidate.collectorMethod) || "legacy_profile_scan",
        resolvedProductEvidence: candidate.resolvedProductEvidence && typeof candidate.resolvedProductEvidence === "object" ? candidate.resolvedProductEvidence : null,
        mediaPermalink: cleanXMediaPermalink(candidate.mediaPermalink),
        verifiedVideoPermalink: cleanXMediaPermalink(candidate.verifiedVideoPermalink),
        generatedVideoPermalink: cleanXMediaPermalink(candidate.generatedVideoPermalink),
        validationStatus: cleanValidationStatus(candidate.validationStatus),
        mediaType: (mediaType === "image" || mediaType === "video" ? mediaType : "none") as "image" | "video" | "none",
        mediaCount: Math.max(0, Math.round(Number(candidate.mediaCount ?? 0) || 0)),
        sourceXHandle: cleanText(candidate.sourceXHandle).replace(/^@/, ""),
        text: extractMyfansSourceText(candidate.text, candidate.articleText),
        myfansUrls: Array.isArray(candidate.myfansUrls) ? candidate.myfansUrls.map(cleanMyfansUrl).filter(Boolean).slice(0, 5) : [],
      } as MyfansQuoteScanCandidate;
    })
    .filter((candidate) => {
      const statusHandle = candidate.xPostUrl.match(/^https:\/\/x\.com\/([^/?#]+)\/status\//i)?.[1] ?? "";
      return candidate.xPostUrl
        && candidate.sourceXHandle.toLowerCase() === sourceXHandle.toLowerCase()
        && statusHandle.toLowerCase() === sourceXHandle.toLowerCase();
    });

  if (normalized.length === 0) {
    return terminalCollectionReport(payload, "CREATOR_MISMATCH", "creator本人の表示中投稿が見つかりませんでした。", { ...collectionEvidence, candidateCount: candidates.length });
  }

  const sourceTextMissingCount = normalized.filter((candidate) => !candidate.text).length;
  const sourceReady = normalized.filter((candidate) => {
    if (!candidate.text) return false;
    if (candidate.collectorMethod === "complete_thread_first_v2") {
      return isCompleteThreadCandidate(candidate);
    }
    return true;
  });
  if (sourceReady.length === 0) {
    if (normalized.some((candidate) => candidate.collectorMethod === COLLECTOR_METHOD) && Array.isArray(payload.collectionStatuses)) {
      const incomplete = payload.collectionStatuses.some((item) => THREAD_INCOMPLETE_STATUSES.has(cleanText(item.status)));
      const reason = payload.collectionStatuses.find((item) => THREAD_INCOMPLETE_STATUSES.has(cleanText(item.status)))?.status || "THREAD_INCOMPLETE_WITHOUT_LINK";
      const error = incomplete ? `${reason}: status threadを十分に観測できませんでした。` : undefined;
      await markRefreshItem(payload, incomplete ? "failed" : "success", { collectedCount: 0, topScore: null, error, evidence: collectionEvidence });
      return NextResponse.json({ ok: !incomplete, retryable: incomplete, errorCode: incomplete ? reason : null, importedType: "quote_candidates", candidatesCount: 0, collectionStatuses: payload.collectionStatuses, profileCounts: payload.profileCounts ?? {}, statusCounts: payload.statusCounts ?? {}, stateTransitions: payload.stateTransitions ?? [], ...(error ? { error } : {}) }, { status: incomplete ? 202 : 200 });
    }
    return terminalCollectionReport(payload, "NO_BODY", "表示中投稿に安全に紐付けられる本文がありません。空本文は保存しません。", { ...collectionEvidence, candidateCount: normalized.length, sourceTextMissingCount });
  }

  const scored = sourceReady
    .map((candidate) => ({ candidate, result: scoreMyfansQuoteCandidate(candidate) }))
    .sort((a, b) => b.result.score - a.result.score);
  const ranked = scored.map((item, index) => ({ ...item, creatorRank: index + 1 }));
  const top = ranked.filter((item) => item.result.eligible && item.creatorRank <= 3);
  const best = top[0] ?? null;
  const resolverProducts = await fetchResolverProducts();

  const bestFinalUrl = best ? (Array.isArray(best.candidate.myfansUrls) ? best.candidate.myfansUrls : []).map((url) => normalizeMyfansPostUrl(cleanMyfansUrl(url))).find(Boolean) || "" : "";
  const productResolutions = new Map<string, ExactProductResolution>();
  const resolveBatchProduct = async (finalMyfansUrl: string) => {
    if (!finalMyfansUrl) return { product: null, status: "blocked", method: "no_final_myfans_url", missing: ["final MyFans post URL"] } as ExactProductResolution;
    const cached = productResolutions.get(finalMyfansUrl);
    if (cached) return cached;
    let resolution: ExactProductResolution;
    try {
      const dbResolution = resolveExactMyfansProductByFinalUrl(finalMyfansUrl, resolverProducts, resolvedCreatorId);
      resolution = dbResolution.product?.id
        ? { product: dbResolution.product as Record<string, unknown>, status: "exact" as const, method: "existing_canonical_url", missing: [] }
        : dbResolution.status === "ambiguous"
          ? { product: null, status: "ambiguous" as const, method: "exact_canonical_url_duplicate", missing: [] }
          : await ensureExactProductForCreator(finalMyfansUrl, resolvedCreatorId, approvedMediaId);
    } catch (error) {
      const normalizedError = normalizeCompanionError(error, "batch_product_resolution");
      const { error: auditError } = await supabaseAdmin.from("myfans_audit_logs").insert({
        entity_type: "creator",
        entity_id: resolvedCreatorId,
        action: "batch_product_resolution_failed",
        summary: finalMyfansUrl,
        metadata: { collectorMethod: COLLECTOR_METHOD, finalMyfansUrl, error: normalizedError },
      });
      if (auditError) console.error("batch product resolution audit failed", auditError);
      throw companionPersistenceError(normalizedError, normalizedError.errorStage, "batch_product_resolution_failed");
    }
    productResolutions.set(finalMyfansUrl, resolution);
    return resolution;
  };

  const bestProductResolution = await resolveBatchProduct(bestFinalUrl);
  if (best && bestProductResolution.product?.id) {
    const { error } = await supabaseAdmin.from("myfans_quote_candidates").update({ selected: false }).eq("creator_id", resolvedCreatorId);
    if (error) throw error;
  }

  for (const item of ranked) {
    const finalMyfansUrl = (Array.isArray(item.candidate.myfansUrls) ? item.candidate.myfansUrls : []).map((url) => normalizeMyfansPostUrl(cleanMyfansUrl(url))).find(Boolean) || "";
    const itemProductResolution = await resolveBatchProduct(finalMyfansUrl);
    const itemProduct = itemProductResolution.product;
    const itemProductId = itemProduct?.id ? Number(itemProduct.id) : null;
    const resolverEvidence = Array.isArray(item.candidate.resolvedProductEvidence) ? item.candidate.resolvedProductEvidence : [];
    const isVerifiedVideo = item.candidate.mediaType === "video" && item.candidate.validationStatus === "verified_video_permalink" && item.candidate.verifiedVideoPermalink === item.candidate.mediaPermalink;
    const isVerifiedImage = item.candidate.mediaType === "image" && Boolean(item.candidate.mediaPermalink && item.candidate.quoteVisualReady);
    const quoteVisualReady = Boolean(item.candidate.mediaPermalink && (isVerifiedVideo || isVerifiedImage));
    const record = {
      approved_media_id: approvedMediaId ?? product?.approved_media_id ?? null,
      creator_id: resolvedCreatorId,
      product_id: itemProductId,
      creator_x_url: creatorXUrl,
      source_x_handle: sourceXHandle,
      x_post_url: item.candidate.xPostUrl,
      media_permalink: item.candidate.mediaPermalink || null,
      media_type: item.candidate.mediaType || "none",
      media_count: item.candidate.mediaCount ?? 0,
      quote_visual_ready: quoteVisualReady,
      media_permalink_verified_at: quoteVisualReady ? new Date().toISOString() : null,
      media_permalink_validation_status: item.candidate.validationStatus || null,
      visual_score: quoteVisualReady
        ? item.candidate.mediaType === "video" ? 100 : item.candidate.mediaType === "image" ? 85 : 0
        : item.candidate.hasVideo || item.candidate.hasImage ? 25 : 0,
      posted_at: item.candidate.postedAt || null,
      text_excerpt: item.candidate.text || "",
      views: item.candidate.views ?? null,
      likes: item.candidate.likes ?? null,
      reposts: item.candidate.reposts ?? null,
      replies: item.candidate.replies ?? null,
      bookmarks: item.candidate.bookmarks ?? null,
      has_image: Boolean(item.candidate.hasImage),
      has_video: Boolean(item.candidate.hasVideo),
      is_pinned: Boolean(item.candidate.isPinned),
      is_reply: Boolean(item.candidate.isReply),
      is_repost: Boolean(item.candidate.isRepost),
      is_quote: Boolean(item.candidate.isQuote),
      score: item.result.score,
      score_reason: item.result.reason,
      ...(() => {
        const sourceValue = evaluateMyfansSourceValue({
          text: item.candidate.text || "",
          postedAt: item.candidate.postedAt,
          collectedAt: new Date().toISOString(),
          mediaType: item.candidate.mediaType,
          mediaPermalink: item.candidate.mediaPermalink,
          quoteVisualReady,
          views: item.candidate.views,
          likes: item.candidate.likes,
          reposts: item.candidate.reposts,
          replies: item.candidate.replies,
          isRepost: item.candidate.isRepost,
          isReply: item.candidate.isReply,
          isQuote: item.candidate.isQuote,
        });
        return { source_value_score: sourceValue.score, source_value_verdict: sourceValue.verdict, source_value_reasons: sourceValue.reasons, reaction_angles: sourceValue.reactionAngles, source_specificity: sourceValue.sourceSpecificity };
      })(),
      selected: best?.candidate.xPostUrl === item.candidate.xPostUrl,
      creator_rank: item.creatorRank <= 3 && item.result.eligible ? item.creatorRank : null,
      global_score: item.result.score,
      collected_at: new Date().toISOString(),
      parent_status_url: item.candidate.parentStatusUrl || item.candidate.xPostUrl,
      parent_status_id: item.candidate.parentStatusId || item.candidate.xPostUrl.match(/\/status\/(\d+)/)?.[1] || null,
      own_reply_status_url: item.candidate.ownReplyStatusUrl || null,
      own_reply_status_id: item.candidate.ownReplyStatusId || null,
      myfans_link_source: item.candidate.myfansLinkSource || null,
      thread_collection_status: item.candidate.threadCollectionStatus || "LEGACY",
      collector_method: item.candidate.collectorMethod || "legacy_profile_scan",
      resolved_product_evidence: item.candidate.resolvedProductEvidence || {},
    };
    const savedCandidateId = await saveQuoteCandidate(record, resolvedCreatorId);
    const evidenceText = [item.candidate.text, ...(item.candidate.myfansUrls ?? [])].filter(Boolean).join(" ");
    const resolver = resolverEvidence.find((entry) => entry && typeof entry === "object" && normalizeMyfansPostUrl(cleanMyfansUrl(entry.finalMyfansUrl)) === finalMyfansUrl) || {};
    const rawDiscoveredUrl = cleanText(resolver.observedMfcoUrl || resolver.sourceUrl || finalMyfansUrl).replace(/[?#].*$/, "");
    const discoveredUrl = /^(?:https:\/\/(?:www\.)?(?:mfco\.link|t\.co|myfans\.jp)\/)/i.test(rawDiscoveredUrl) ? rawDiscoveredUrl : finalMyfansUrl;
    const evidence = finalMyfansUrl && itemProductResolution.status === "exact"
      ? {
        approved_media_id: approvedMediaId ?? (itemProduct?.approved_media_id as number | null | undefined) ?? null,
        quote_candidate_id: savedCandidateId,
        source_status_url: item.candidate.ownReplyStatusUrl || item.candidate.xPostUrl,
        source_author_handle: sourceXHandle,
        discovered_myfans_url: discoveredUrl,
        final_myfans_url: finalMyfansUrl,
        product_id: itemProductId,
        resolution_method: itemProductResolution.status === "exact" ? itemProductResolution.method === "existing_canonical_url" ? "exact_product_url" : "safe_redirect_product_url" : "myfans_url_resolved_product_not_registered",
        confidence: "exact",
        evidence_source: item.candidate.myfansLinkSource === "own_reply" ? "author_reply" : "author_post",
        verified_at: new Date().toISOString(),
        metadata: { link_source: item.candidate.myfansLinkSource === "own_reply" ? "author_reply" : "parent", myfans_post_uuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null, matched_creator_id: resolvedCreatorId, matched_product_id: itemProductId, product_resolution: itemProductResolution.status, product_resolution_method: itemProductResolution.method, resolver_evidence: resolverEvidence },
      }
      : !finalMyfansUrl
        ? resolveTextEvidence({
        sourceStatusUrl: item.candidate.ownReplyStatusUrl || item.candidate.xPostUrl,
        sourceAuthorHandle: sourceXHandle,
        text: evidenceText,
        products: resolverProducts,
        evidenceSource: item.candidate.myfansLinkSource === "own_reply" ? "author_reply" : "author_post",
        approvedMediaId: approvedMediaId ?? product?.approved_media_id ?? null,
        })
        : null;
    if (evidence) {
      const { error: evidenceError } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").upsert({
        approved_media_id: evidence.approved_media_id,
        quote_candidate_id: savedCandidateId,
        source_status_url: evidence.source_status_url,
        source_author_handle: evidence.source_author_handle,
        discovered_myfans_url: evidence.discovered_myfans_url,
        final_myfans_url: evidence.final_myfans_url,
        product_id: evidence.product_id,
        resolution_method: evidence.resolution_method,
        confidence: evidence.confidence,
        evidence_source: evidence.evidence_source,
        verified_at: evidence.verified_at,
        metadata: evidence.metadata ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: "source_status_url,discovered_myfans_url,evidence_source" });
      if (evidenceError && !/myfans_post_product_linkage_evidence|schema cache|does not exist/i.test(evidenceError.message)) throw evidenceError;
      if (!evidenceError && savedCandidateId) {
        const { error: evidenceUpdateError } = await supabaseAdmin
          .from("myfans_quote_candidates")
          .update({ resolved_product_evidence: { productId: evidence.product_id, discoveredMyfansUrl: evidence.discovered_myfans_url, finalMyfansUrl: evidence.final_myfans_url, resolutionMethod: evidence.resolution_method, confidence: evidence.confidence, evidenceSource: evidence.evidence_source } })
          .eq("id", savedCandidateId);
        if (evidenceUpdateError && !/resolved_product_evidence|schema cache|does not exist/i.test(evidenceUpdateError.message)) throw evidenceUpdateError;
      }
    }
  }

  if (best && bestProductResolution.product?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("myfans_products")
      .update({ quote_candidate_x_url: best.candidate.mediaPermalink || best.candidate.xPostUrl, updated_at: new Date().toISOString() })
      .eq("id", bestProductResolution.product.id);
    if (updateError) throw updateError;
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "creator",
      entity_id: resolvedCreatorId,
      action: "quote_candidate_auto_select",
      summary: bestProductResolution.product.title,
      metadata: { quoteUrl: best.candidate.mediaPermalink || best.candidate.xPostUrl, statusUrl: best.candidate.xPostUrl, mediaPermalink: best.candidate.mediaPermalink || null, mediaType: best.candidate.mediaType || "none", quoteVisualReady: Boolean(best.candidate.quoteVisualReady), validationStatus: best.candidate.validationStatus || null, score: best.result.score, creatorRank: best.creatorRank, reason: best.result.reason },
    });
  }

  await updateGlobalQuoteRanks(approvedMediaId ?? product?.approved_media_id ?? null);
  if (Array.isArray(payload.collectionStatuses) && payload.collectionStatuses.length > 0) {
    const { error: statusAuditError } = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "creator",
      entity_id: resolvedCreatorId,
      action: "complete_thread_collection_status",
      summary: `${COLLECTOR_METHOD}: ${payload.collectionStatuses.length} parent statuses`,
      metadata: { collectorMethod: COLLECTOR_METHOD, statuses: payload.collectionStatuses, ...collectionEvidence },
    });
    if (statusAuditError) console.error("complete thread status audit failed", statusAuditError);
  }
  await markRefreshItem(payload, "success", {
    collectedCount: scored.length,
    topScore: best?.result.score ?? null,
    evidence: { ...collectionEvidence, completeThreadsFound: scored.length, candidatesSaved: scored.length },
  });

  return NextResponse.json({
    ok: true,
    importedType: "quote_candidates",
    candidatesCount: scored.length,
    sourceTextMissingCount,
    collectionStatuses: payload.collectionStatuses ?? [],
    selected: best ? { xPostUrl: best.candidate.xPostUrl, mediaPermalink: best.candidate.mediaPermalink || null, mediaType: best.candidate.mediaType || "none", quoteVisualReady: Boolean(best.candidate.quoteVisualReady), validationStatus: best.candidate.validationStatus || null, score: best.result.score, creatorRank: best.creatorRank, reason: best.result.reason } : null,
  });
}

function cleanDiagnosticStatusUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/i);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

async function saveDiagnosticStatusScan(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const sourceStatusUrl = cleanDiagnosticStatusUrl(payload.sourceStatusUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const sourceHandleFromStatus = sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "";
  const runId = cleanText(payload.diagnosticRunId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || createHash("sha256").update(`${sourceStatusUrl}|${Date.now()}`).digest("hex").slice(0, 16);
  if (!sourceStatusUrl || !sourceXHandle || sourceHandleFromStatus.toLowerCase() !== sourceXHandle.toLowerCase()) {
    return NextResponse.json({ error: "診断対象はx.comの正規status URLで、source handleと一致する必要があります。" }, { status: 400 });
  }
  const products = await fetchResolverProducts();
  const candidates = (Array.isArray(payload.quoteCandidates) ? payload.quoteCandidates : [])
    .slice(0, 40)
    .filter((candidate) => Boolean(candidate.isReply) && cleanText((candidate as MyfansQuoteScanCandidate & { authorHandle?: unknown }).authorHandle).replace(/^@/, "").toLowerCase() === sourceXHandle.toLowerCase())
    .map((candidate) => ({ ...candidate, xPostUrl: cleanXStatusUrl(candidate.xPostUrl) }))
    .filter((candidate) => candidate.xPostUrl && candidate.xPostUrl !== sourceStatusUrl);
  let saved = 0;
  const savedEvidence: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const evidenceText = [candidate.text, ...(candidate.myfansUrls ?? [])].filter(Boolean).join(" ");
    const evidence = resolveTextEvidence({ sourceStatusUrl: candidate.xPostUrl, sourceAuthorHandle: sourceXHandle, text: evidenceText, products, evidenceSource: "author_reply", approvedMediaId });
    if (!evidence) continue;
    const observedMfcoLink = Boolean((candidate as MyfansQuoteScanCandidate & { observedMfcoLink?: unknown }).observedMfcoLink);
    if (observedMfcoLink && evidence.confidence === "unresolved") {
      evidence.confidence = "strong";
      evidence.resolution_method = "mfco_link_observed";
      evidence.product_id = null;
      evidence.final_myfans_url = null;
      evidence.metadata = { ...(evidence.metadata ?? {}), observed_mfco_link: true, product_resolution: "not_unique" };
    }
    const { data: existingEvidence, error: existingError } = await supabaseAdmin
      .from("myfans_post_product_linkage_evidence")
      .select("id,diagnostic_mode")
      .eq("source_status_url", evidence.source_status_url)
      .eq("discovered_myfans_url", evidence.discovered_myfans_url)
      .eq("evidence_source", "author_reply")
      .maybeSingle();
    if (existingError && !/diagnostic_mode|schema cache|does not exist/i.test(existingError.message)) throw existingError;
    if (existingEvidence && existingEvidence.diagnostic_mode !== true) continue;
    const { error } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").upsert({
      approved_media_id: evidence.approved_media_id,
      quote_candidate_id: null,
      source_status_url: evidence.source_status_url,
      source_author_handle: evidence.source_author_handle,
      discovered_myfans_url: evidence.discovered_myfans_url,
      final_myfans_url: evidence.final_myfans_url,
      product_id: evidence.product_id,
      resolution_method: evidence.resolution_method,
      confidence: evidence.confidence,
      evidence_source: "author_reply",
      verified_at: evidence.verified_at,
      metadata: { ...(evidence.metadata ?? {}), diagnostic: true, diagnostic_run_id: runId, diagnostic_source_status_url: sourceStatusUrl, reply_author_handle: sourceXHandle },
      diagnostic_mode: true,
      diagnostic_run_id: runId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source_status_url,discovered_myfans_url,evidence_source" });
    if (error && !/schema cache|does not exist/i.test(error.message)) throw error;
    if (!error) {
      saved += 1;
      savedEvidence.push({ sourceStatusUrl: evidence.source_status_url, discoveredMyfansUrl: evidence.discovered_myfans_url, finalMyfansUrl: evidence.final_myfans_url, confidence: evidence.confidence, method: evidence.resolution_method, productId: evidence.product_id, evidenceSource: "author_reply", diagnosticMode: true, diagnosticRunId: runId });
    }
  }
  return NextResponse.json({ ok: true, importedType: "diagnostic_status", diagnostic: true, diagnosticRunId: runId, sourceStatusUrl, sourceXHandle, replyCount: candidates.length, replyStatuses: candidates.map((candidate) => ({ statusUrl: candidate.xPostUrl, authorHandle: cleanText((candidate as MyfansQuoteScanCandidate & { authorHandle?: unknown }).authorHandle), isReply: Boolean(candidate.isReply), myfansUrls: candidate.myfansUrls ?? [] })), evidenceSaved: saved, savedEvidence, myfansLinkCount: candidates.reduce((count, candidate) => count + (candidate.myfansUrls?.length ?? 0), 0) });
}

async function saveSingleStatusCollectionCore(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const sourceStatusUrl = cleanDiagnosticStatusUrl(payload.sourceStatusUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const candidate = payload.statusCandidate;
  let auditContext: Record<string, unknown> = { sourceStatusUrl, sourceXHandle, singleStatusRunId: cleanText(payload.singleStatusRunId) || null, candidateId: null, matchedCreatorId: null, observedMfcoUrl: null, finalMyfansUrl: null, myfansPostUuid: null, matchedOrCreatedProductId: null, productResolutionMethod: null, resultReason: null };
  const candidateUrl = cleanXStatusUrl(candidate?.xPostUrl);
  const candidateAuthor = cleanText(candidate?.authorHandle).replace(/^@/, "");
  const sourceHandleFromStatus = sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "";
  const audit = async (metadata: Record<string, unknown>, summary: string) => {
    const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: null,
      action: "single_status_collect",
      summary,
      metadata: { phase: "saved", ...auditContext, ...metadata },
    });
    if (error) throw error;
  };

  const collectionError = cleanText(payload.collectionError);
  if (collectionError) {
    await audit({
      ok: false,
      sourceStatusUrl,
      sourceXHandle,
      singleStatusRunId: cleanText(payload.singleStatusRunId),
      reason: "x_collection_failed",
      error: collectionError.slice(0, 500),
      failure: payload.collectionFailure ? {
        stage: cleanText(payload.collectionFailure.stage),
        errorCode: cleanText(payload.collectionFailure.errorCode),
        diagnostics: payload.collectionFailure.diagnostics ?? {},
        transitions: (payload.collectionFailure.transitions ?? []).slice(-12),
      } : null,
    }, sourceStatusUrl || "single status収集失敗");
    const errorCode = cleanText(payload.collectionFailure?.errorCode) || quoteRefreshErrorCode(collectionError) || "COLLECTION_FAILED";
    return NextResponse.json({ ok: false, terminal: true, retryable: false, skipped: errorCode === "LOGIN_OR_CHALLENGE", errorCode, error: collectionError }, { status: 200 });
  }

  if (!sourceStatusUrl || !sourceXHandle || sourceHandleFromStatus.toLowerCase() !== sourceXHandle.toLowerCase()) {
    await audit({ ok: false, sourceStatusUrl, reason: "source_handle_mismatch" }, sourceStatusUrl || "single status収集失敗");
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "CREATOR_MISMATCH", error: "指定status URLとsource handleが一致しません。" }, { status: 200 });
  }
  if (candidateUrl !== sourceStatusUrl || candidateAuthor.toLowerCase() !== sourceXHandle.toLowerCase()) {
    await audit({ ok: false, sourceStatusUrl, candidateUrl, candidateAuthor, reason: "author_or_status_mismatch" }, sourceStatusUrl);
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "CREATOR_MISMATCH", error: "取得したX投稿のauthor/statusが指定URLと一致しません。保存しませんでした。" }, { status: 200 });
  }
  const text = extractMyfansSourceText(candidate?.text, candidate?.articleText);
  if (!text) {
    await audit({ ok: false, sourceStatusUrl, authorStatusMatch: true, sourceTextSaved: false, reason: "source_text_missing" }, sourceStatusUrl);
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "NO_BODY", error: "指定statusの具体的な本文を取得できませんでした。保存しませんでした。" }, { status: 200 });
  }

  const { data: creators, error: creatorError } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,creator_x_url,source_x_handle");
  if (creatorError) throw creatorError;
  const creatorMatch = resolveExactMyfansCreator(creators ?? [], sourceXHandle);
  auditContext = { ...auditContext, matchedCreatorId: creatorMatch.creatorId, resultReason: creatorMatch.status === "exact" ? null : creatorMatch.status === "ambiguous" ? "ambiguous_creator_author" : "creator_not_found" };
  if (!creatorMatch.creatorId) {
    const reason = creatorMatch.status === "ambiguous" ? "ambiguous_creator_author" : "creator_not_found";
    await audit({ ok: false, sourceStatusUrl, sourceXHandle: canonicalMyfansXHandle(sourceXHandle), authorStatusMatch: true, sourceTextSaved: true, reason }, sourceStatusUrl);
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: creatorMatch.status === "ambiguous" ? "CREATOR_MISMATCH" : "CREATOR_NOT_FOUND", error: creatorMatch.status === "ambiguous" ? "X authorに一致するcreatorが複数あるため保存しませんでした。" : "既存DBにX authorと完全一致するcreatorが見つかりません。productの有無とは無関係に保存しませんでした。", creatorMatch: creatorMatch.status, productMatch: "unresolved", resultReason: reason, singleStatusRunId: cleanText(payload.singleStatusRunId) || null }, { status: 200 });
  }

  const { data: existingCandidate, error: existingCandidateError } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,creator_id,product_id,approved_media_id,creator_x_url,source_x_handle,resolved_product_evidence")
    .eq("creator_id", creatorMatch.creatorId)
    .eq("x_post_url", sourceStatusUrl)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingCandidateError) throw existingCandidateError;

  const products = await fetchResolverProducts();
  const resolvedEvidence = Array.isArray(candidate?.resolvedProductEvidence) ? candidate.resolvedProductEvidence : [];
  const observedLinkCount = Array.isArray(candidate?.myfansUrls) ? candidate.myfansUrls.length : 0;
  const finalMyfansUrl = extractFinalMyfansUrl(candidate);
  const observedMfcoUrl = resolvedEvidence.find((item) => item && typeof item === "object" && cleanText((item as Record<string, unknown>).observedMfcoUrl)) as Record<string, unknown> | undefined;
  auditContext = { ...auditContext, observedMfcoUrl: cleanText(observedMfcoUrl?.observedMfcoUrl || (Array.isArray(candidate?.myfansUrls) ? candidate.myfansUrls.find((url) => /^https:\/\/(?:www\.)?(?:mfco\.link|t\.co)\//i.test(String(url))) : null) || null), finalMyfansUrl: finalMyfansUrl || null, myfansPostUuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null };
  const dbProductResolution = resolveExactMyfansProductByFinalUrl(finalMyfansUrl, products, creatorMatch.creatorId);
  let product: Record<string, unknown> | null = dbProductResolution.product as Record<string, unknown> | null;
  const productResolution: ExactProductResolution = await (async () => {
    try {
      return product
        ? { product, status: "exact", method: "existing_canonical_url", missing: [] as string[] }
        : finalMyfansUrl
          ? await ensureExactProductForCreator(finalMyfansUrl, creatorMatch.creatorId, approvedMediaId)
          : { product: null, status: "blocked" as const, method: "no_final_myfans_url", missing: observedLinkCount > 0 ? ["final MyFans post URL"] : [] };
    } catch (error) {
      const normalizedError = normalizeCompanionError(error, "product_resolution");
      await audit({ ...auditContext, ok: false, reason: "product_resolution_failed", ...normalizedError }, sourceStatusUrl);
      throw companionPersistenceError(normalizedError, normalizedError.errorStage, "product_resolution_failed");
    }
  })();
  product = productResolution.product;
  const productId = product?.id ? Number(product.id) : null;
  const productMatch = productResolution.status === "exact" ? "exact" : productResolution.status === "blocked" ? "product_registration_blocked" : "unresolved";
  auditContext = { ...auditContext, matchedOrCreatedProductId: productId, productResolutionMethod: productResolution.method, resultReason: productResolution.status === "exact" ? null : productResolution.status === "ambiguous" ? "ambiguous_product_identity" : productResolution.missing.join("|") || "product_not_registered" };

  const normalized = {
    ...candidate,
    xPostUrl: candidateUrl,
    sourceXHandle,
    text,
    mediaPermalink: cleanXMediaPermalink(candidate?.mediaPermalink),
    verifiedVideoPermalink: cleanXMediaPermalink(candidate?.verifiedVideoPermalink),
    generatedVideoPermalink: cleanXMediaPermalink(candidate?.generatedVideoPermalink),
    validationStatus: cleanValidationStatus(candidate?.validationStatus),
    mediaType: ["image", "video"].includes(cleanText(candidate?.mediaType)) ? cleanText(candidate?.mediaType) : "none",
    mediaCount: Math.max(0, Math.round(Number(candidate?.mediaCount ?? 0) || 0)),
    myfansUrls: finalMyfansUrl ? [finalMyfansUrl] : [],
    myfansLinkSource: candidate?.myfansLinkSource === "own_reply" ? "own_reply" : candidate?.myfansLinkSource === "parent" ? "parent" : null,
    resolvedProductEvidence: resolvedEvidence.length > 0 ? resolvedEvidence : (finalMyfansUrl ? [{ finalMyfansUrl, myfansPostUuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null, resolverMethod: productResolution.method, confidence: "exact" }] : null),
    isReply: false,
  } as MyfansQuoteScanCandidate;
  const scored = scoreMyfansQuoteCandidate(normalized);
  const quoteVisualReady = Boolean(normalized.mediaPermalink && (
    (normalized.mediaType === "video" && normalized.validationStatus === "verified_video_permalink" && normalized.verifiedVideoPermalink === normalized.mediaPermalink)
    || (normalized.mediaType === "image" && normalized.quoteVisualReady)
  ));
  const record = {
    approved_media_id: approvedMediaId ?? existingCandidate?.approved_media_id ?? product?.approved_media_id ?? null,
    creator_id: creatorMatch.creatorId,
    product_id: productId,
    creator_x_url: product?.creator_x_url || existingCandidate?.creator_x_url || `https://x.com/${canonicalMyfansXHandle(sourceXHandle)}`,
    source_x_handle: sourceXHandle,
    x_post_url: normalized.xPostUrl,
    media_permalink: normalized.mediaPermalink || null,
    media_type: normalized.mediaType,
    media_count: normalized.mediaCount,
    quote_visual_ready: quoteVisualReady,
    media_permalink_verified_at: quoteVisualReady ? new Date().toISOString() : null,
    media_permalink_validation_status: normalized.validationStatus || null,
    visual_score: quoteVisualReady ? (normalized.mediaType === "video" ? 100 : 85) : 0,
    posted_at: normalized.postedAt || null,
    text_excerpt: normalized.text,
    views: normalized.views ?? null,
    likes: normalized.likes ?? null,
    reposts: normalized.reposts ?? null,
    replies: normalized.replies ?? null,
    bookmarks: normalized.bookmarks ?? null,
    has_image: Boolean(normalized.hasImage),
    has_video: Boolean(normalized.hasVideo),
    is_pinned: Boolean(normalized.isPinned),
    is_reply: false,
    is_repost: Boolean(normalized.isRepost),
    is_quote: Boolean(normalized.isQuote),
    score: scored.score,
    score_reason: scored.reason,
    ...(() => {
      const sourceValue = evaluateMyfansSourceValue({
        text: normalized.text || "",
        postedAt: normalized.postedAt,
        collectedAt: new Date().toISOString(),
        mediaType: normalized.mediaType,
        mediaPermalink: normalized.mediaPermalink,
        quoteVisualReady,
        views: normalized.views,
        likes: normalized.likes,
        reposts: normalized.reposts,
        replies: normalized.replies,
        isRepost: normalized.isRepost,
        isReply: normalized.isReply,
        isQuote: normalized.isQuote,
      });
      return { source_value_score: sourceValue.score, source_value_verdict: sourceValue.verdict, source_value_reasons: sourceValue.reasons, reaction_angles: sourceValue.reactionAngles, source_specificity: sourceValue.sourceSpecificity };
    })(),
    selected: false,
    creator_rank: scored.eligible ? 1 : null,
    global_score: scored.score,
    collected_at: new Date().toISOString(),
  };
  const candidateId = await saveQuoteCandidate(record, creatorMatch.creatorId, existingCandidate?.id);
  auditContext = { ...auditContext, candidateId };
  const isExistingCandidate = Boolean(existingCandidate?.id);
  const partialFailures: string[] = [];
  if (productId) {
    const { error: productUpdateError } = await supabaseAdmin.from("myfans_products").update({ quote_candidate_x_url: normalized.mediaPermalink || normalized.xPostUrl, updated_at: new Date().toISOString() }).eq("id", productId);
    if (productUpdateError) partialFailures.push(`product pointer update: ${productUpdateError.message}`);
  }
  if (finalMyfansUrl) {
    const resolver = resolvedEvidence.find((item) => item && typeof item === "object" && normalizeMyfansPostUrl(cleanMyfansUrl(item.finalMyfansUrl)) === finalMyfansUrl) || {};
    const rawDiscoveredUrl = cleanText(resolver.observedMfcoUrl || resolver.sourceUrl || finalMyfansUrl).replace(/[?#].*$/, "");
    const discoveredUrl = /^(?:https:\/\/(?:www\.)?(?:mfco\.link|t\.co|myfans\.jp)\/)/i.test(rawDiscoveredUrl) ? rawDiscoveredUrl : finalMyfansUrl;
    const { error: evidenceError } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").upsert({
      approved_media_id: approvedMediaId ?? existingCandidate?.approved_media_id ?? product?.approved_media_id ?? null,
      quote_candidate_id: candidateId,
      source_status_url: sourceStatusUrl,
      source_author_handle: canonicalMyfansXHandle(sourceXHandle),
      discovered_myfans_url: discoveredUrl,
      final_myfans_url: finalMyfansUrl,
      product_id: productId,
       resolution_method: productResolution.status === "exact" ? productResolution.method === "existing_canonical_url" ? "exact_product_url" : "safe_redirect_product_url" : "myfans_url_resolved_product_not_registered",
      confidence: "exact",
      evidence_source: candidate?.myfansLinkSource === "own_reply" ? "author_reply" : "author_post",
      verified_at: new Date().toISOString(),
       metadata: { link_source: candidate?.myfansLinkSource === "own_reply" ? "author_reply" : "parent", myfans_post_uuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null, matched_creator_id: creatorMatch.creatorId, matched_product_id: productId, product_resolution: productResolution.status, product_resolution_method: productResolution.method, missing_product_fields: productResolution.missing, resolver_evidence: resolvedEvidence },
      updated_at: new Date().toISOString(),
    }, { onConflict: "source_status_url,discovered_myfans_url,evidence_source" });
    if (evidenceError && !/myfans_post_product_linkage_evidence|schema cache|does not exist/i.test(evidenceError.message)) throw evidenceError;
  }
  try {
    await updateGlobalQuoteRanks(approvedMediaId ?? existingCandidate?.approved_media_id ?? product?.approved_media_id ?? null);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("JOB_IDENTITY_MISMATCH:")) return NextResponse.json({ ok: false, retryable: false, errorCode: "JOB_IDENTITY_MISMATCH", error: error.message }, { status: 409 });
    partialFailures.push(`global rank update: ${error instanceof Error ? error.message : String(error)}`);
  }
  const metadata = { ok: true, sourceStatusUrl, candidateId, creatorId: creatorMatch.creatorId, matchedCreatorId: creatorMatch.creatorId, creatorMatch: "exact", productId, matchedOrCreatedProductId: productId, productMatch, productResolution: productResolution.status, productResolutionMethod: productResolution.method, resultReason: productResolution.status === "exact" ? (isExistingCandidate ? "NO_NEW_CANDIDATE" : "candidate_saved") : productResolution.missing.join("|") || "product_not_registered", linkDetected: observedLinkCount > 0, linkResolution: finalMyfansUrl ? "mfco_resolved" : observedLinkCount > 0 ? "unresolved" : "no_link", observedMfcoUrl: auditContext.observedMfcoUrl, finalMyfansUrl: finalMyfansUrl || null, myfansPostUuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null, linkSource: normalized.myfansLinkSource, existingCandidate: isExistingCandidate, sourceTextSaved: true, authorStatusMatch: true, visualStatus: quoteVisualReady ? "verified" : normalized.mediaType === "none" ? "unavailable" : "metadata_only", score: scored.score, eligible: scored.eligible };
  try {
    await audit(metadata, sourceStatusUrl);
  } catch (error) {
    partialFailures.push(`success audit: ${error instanceof Error ? error.message : String(error)}`);
    console.error("single_status_collect success audit failed", error);
  }
  if (partialFailures.length > 0) {
    return NextResponse.json({ importedType: "single_status_quote_candidate", ...metadata, status: "partial", partialFailure: true, failures: partialFailures }, { status: 200 });
  }
  return NextResponse.json({ importedType: "single_status_quote_candidate", ...metadata, status: isExistingCandidate ? "no_new_candidate" : "done", resultCode: isExistingCandidate ? "NO_NEW_CANDIDATE" : "NEW_CANDIDATE" });
}

async function saveSingleStatusCollection(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const singleStatusRunId = cleanText(payload.singleStatusRunId);
  if (!singleStatusRunId) return NextResponse.json({ ok: false, serverAccepted: false, saveReached: false, reason: "missing_run_id" }, { status: 400 });
  const { data: replay } = await supabaseAdmin.from("myfans_audit_logs").select("id").eq("action", "single_status_collect").contains("metadata", { singleStatusRunId, phase: "saved" }).limit(1).maybeSingle();
  if (replay) return NextResponse.json({ ok: false, serverAccepted: true, saveReached: false, replayed: true, reason: "duplicate/replayed", singleStatusRunId }, { status: 200 });
  const { error: receivedError } = await supabaseAdmin.from("myfans_audit_logs").insert({ entity_type: "import", entity_id: null, action: "single_status_collect", summary: cleanDiagnosticStatusUrl(payload.sourceStatusUrl) || "single status received", metadata: { phase: "received", ok: true, serverAccepted: true, saveReached: false, singleStatusRunId, sourceStatusUrl: cleanDiagnosticStatusUrl(payload.sourceStatusUrl), receivedAt: new Date().toISOString() } });
  if (receivedError) return NextResponse.json({ ok: false, serverAccepted: false, saveReached: false, reason: "received_audit_failed", error: receivedError.message, singleStatusRunId }, { status: 500 });
  try {
    const response = await saveSingleStatusCollectionCore(payload, approvedMediaId);
    if (response.status >= 400) return response;
    const body = await response.json();
    return NextResponse.json({ ...body, ok: true, serverAccepted: true, saveReached: true, singleStatusRunId }, { status: 200 });
  } catch (error) {
    const sourceStatusUrl = cleanDiagnosticStatusUrl(payload.sourceStatusUrl);
    const normalizedError = normalizeCompanionError(error, "single_status_persistence");
    const reason = normalizedError.reason || "server_persistence_failed";
    const { error: auditError } = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: null,
      action: "single_status_collect",
      summary: sourceStatusUrl || "single status収集失敗",
      metadata: {
        phase: "saved",
        ok: false,
        sourceStatusUrl,
        sourceXHandle: cleanText(payload.sourceXHandle).replace(/^@/, ""),
        singleStatusRunId: cleanText(payload.singleStatusRunId),
        reason,
        errorCode: normalizedError.errorCode,
        errorMessage: normalizedError.errorMessage.slice(0, 500),
        errorStage: normalizedError.errorStage,
      },
    });
    if (auditError) console.error("single_status_collect audit failed", auditError);
    return NextResponse.json({ ok: false, serverAccepted: true, saveReached: false, reason, singleStatusRunId, errorCode: normalizedError.errorCode, errorMessage: normalizedError.errorMessage, errorStage: normalizedError.errorStage, error: normalizedError.errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.get("action") === "single_status_latest") {
    const runId = cleanText(query.get("runId"));
    const { data, error } = await supabaseAdmin
      .from("myfans_audit_logs")
      .select("id,summary,metadata,created_at")
      .eq("action", "single_status_collect")
      .contains("metadata", runId ? { singleStatusRunId: runId, phase: "saved" } : { phase: "saved" })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data ?? null });
  }
  const runId = cleanText(new URL(request.url).searchParams.get("diagnostic_run_id")).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  if (!runId) return NextResponse.json({ error: "diagnostic_run_idが必要です。" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("myfans_post_product_linkage_evidence")
    .select("id,source_status_url,source_author_handle,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,diagnostic_mode,diagnostic_run_id,metadata,verified_at")
    .eq("diagnostic_mode", true)
    .eq("diagnostic_run_id", runId)
    .order("verified_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, diagnostic: true, diagnosticRunId: runId, evidence: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (cleanText(payload.protocolVersion) !== COMPANION_PROTOCOL_VERSION) {
      return NextResponse.json({ errorCode: "VERSION_MISMATCH", error: "Companion/API protocol version mismatch", expectedProtocolVersion: COMPANION_PROTOCOL_VERSION, receivedProtocolVersion: cleanText(payload.protocolVersion) || null }, { status: 409 });
    }
    const approvedMediaName = cleanText(payload.approvedMediaName) || "@lumi_reviw";
    let approvedMediaId = Number.isFinite(Number(payload.approvedMediaId)) ? Number(payload.approvedMediaId) : null;
    if (!approvedMediaId) {
      const { data: media } = await supabaseAdmin
        .from("myfans_approved_media")
        .select("id")
        .eq("media_name", approvedMediaName)
        .maybeSingle();
      approvedMediaId = media?.id ?? null;
    }
    if (payload.type === "x_diagnostic_status_scan" || payload.diagnosticMode === true) return await saveDiagnosticStatusScan(payload, approvedMediaId);
    if (payload.type === "x_single_status_collect") return await saveSingleStatusCollection(payload, approvedMediaId);
    if (payload.type === "x_quote_scan") return await saveQuoteScan(payload, approvedMediaId);
    if (normalizeMyfansPostUrl(cleanText(payload.productUrl || payload.pageUrl))) return await importObservedMyfansPost(payload, approvedMediaId);

    const creatorName = cleanText(payload.creatorName);
    const productTitle = cleanText(payload.productTitle || payload.title);
    const productUrl = cleanText(payload.productUrl || payload.pageUrl);
    const affiliateUrl = cleanAffiliateUrl(payload.affiliateUrl);
    const price = Math.round(numberValue(payload.price));
    const rewardRate = cleanText(payload.rewardRate).includes("売上の全額") ? 100 : numberValue(payload.rewardRate);
    const planSignupReward = Math.round(numberValue(payload.planSignupReward));
    const recurringRewardRate = numberValue(payload.recurringRewardRate);
    const likesCount = Math.round(numberValue(payload.likesCount));

    const visibleCreators = Array.isArray(payload.creators) ? (payload.creators as VisibleCreator[]) : [];
    if (!productTitle && !productUrl && visibleCreators.length === 0) {
      return NextResponse.json({ error: "商品名、URL、クリエイター一覧のいずれも取得できませんでした。" }, { status: 400 });
    }
    const payloadHash = createHash("sha256").update([approvedMediaId ?? approvedMediaName, productUrl, affiliateUrl, productTitle].join("|")).digest("hex");

    await saveCompanionImport({
      page_url: cleanText(payload.pageUrl),
      creator_name: creatorName,
      product_title: productTitle,
      product_url: productUrl,
      affiliate_url: affiliateUrl,
      price,
      reward_rate: rewardRate,
      plan_signup_reward: planSignupReward,
      recurring_reward_rate: recurringRewardRate,
      likes_count: likesCount,
      published_at: cleanText(payload.publishedAt),
      raw_payload: payload,
      approved_media_id: approvedMediaId,
      import_source: "chrome_companion",
      payload_hash: payloadHash,
    }, payloadHash);

    if (visibleCreators.length > 0 && !productUrl.includes("/posts/")) {
      let savedCreators = 0;
      let xUrlCount = 0;
      for (const creator of visibleCreators) {
        const displayName = cleanText(creator.displayName);
        if (!displayName) continue;
        const creatorXUrl = cleanXProfileUrl(creator.creatorXUrl);
        await saveCreator({
          display_name: displayName,
          myfans_url: cleanText(creator.myfansUrl),
          creator_x_url: creatorXUrl,
          source_x_handle: xHandleFromUrl(creatorXUrl),
          genre: cleanText(creator.genre),
          x_url_source: cleanText(creator.xUrlSource) || "creator_list_href",
          activity_note: [
            "Chrome Companionでmyfansクリエイター一覧から登録。",
            `フォロワー:${cleanText(creator.followerCount) || "不明"}`,
            `投稿:${cleanText(creator.postsCount) || "不明"}`,
            `単品:${cleanText(creator.singleRewardRate) || "不明"}%`,
            `プラン:${cleanText(creator.planSignupRewardRate) || "不明"}%`,
          ].join(" "),
        });
        if (creatorXUrl) xUrlCount += 1;
        savedCreators += 1;
      }
      return NextResponse.json({ ok: true, importedType: "creators", creatorsCount: savedCreators, xUrlCount, approvedMediaId });
    }

    let creatorId: number | null = null;
    if (creatorName) {
      const creatorUrl = cleanText(payload.creatorUrl);
      const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
      creatorId = await saveCreator({
        display_name: creatorName,
        myfans_url: creatorUrl,
        creator_x_url: creatorXUrl,
        source_x_handle: xHandleFromUrl(creatorXUrl),
        latest_quote_x_url: cleanXStatusUrl(payload.quoteCandidateXUrl),
        x_url_source: "creator_detail_href",
      });
    }

    const visibleProducts = Array.isArray(payload.products) ? (payload.products as VisibleProduct[]) : [];
    if (visibleProducts.length > 1) {
      let savedProducts = 0;
      for (const visibleProduct of visibleProducts.slice(0, 50)) {
        const visibleProductUrl = cleanText(visibleProduct.productUrl);
        const visibleProductTitle = cleanText(visibleProduct.productTitle) || visibleProductUrl;
        if (!visibleProductUrl || !visibleProductTitle) continue;
        const visiblePrice = Math.round(numberValue(visibleProduct.price));
        const visibleRewardRate = cleanText(visibleProduct.rewardRate).includes("売上の全額")
          ? 100
          : numberValue(visibleProduct.rewardRate);
        const visibleAffiliateUrl = cleanAffiliateUrl(visibleProduct.affiliateUrl) || affiliateUrl;
        const visibleLikesCount = Math.round(numberValue(visibleProduct.likesCount));
        const visibleSelectionScore = calculateMyfansSelectionScore({
          price: visiblePrice,
          rewardRate: visibleRewardRate,
          planSignupReward,
          recurringRewardRate,
          popularityRank: null,
          likesCount: visibleLikesCount,
          savesCount: 0,
          isNew: Boolean(cleanText(visibleProduct.publishedAt)),
          hasAffiliateUrl: Boolean(visibleAffiliateUrl),
          hasApprovedMedia: true,
          source_x_url: cleanText(payload.sourceXUrl),
        });
        await saveProduct({
          creator_id: creatorId,
          approved_media_id: approvedMediaId,
          title: visibleProductTitle,
          product_url: visibleProductUrl,
          affiliate_url: visibleAffiliateUrl,
          ...(visibleAffiliateUrl ? {
            affiliate_url_generated_at: new Date().toISOString(),
            affiliate_url_expires_at: null,
            affiliate_url_source: "chrome_companion",
          } : {}),
          source_x_url: cleanText(payload.sourceXUrl),
          creator_x_url: cleanXProfileUrl(payload.creatorXUrl),
          quote_candidate_x_url: cleanText(payload.quoteCandidateXUrl) || cleanText(payload.sourceXUrl),
          media_permission_status: "unknown",
          genre: cleanText(payload.genre),
          product_type: "single",
          status: "candidate",
          price: visiblePrice,
          reward_rate: visibleRewardRate,
          estimated_reward: Math.round(visiblePrice * (visibleRewardRate / 100)),
          plan_signup_reward: planSignupReward,
          recurring_reward_rate: recurringRewardRate,
          likes_count: visibleLikesCount,
          is_new: Boolean(cleanText(visibleProduct.publishedAt)),
          approved_media_name: approvedMediaName,
          selection_reason: "Chrome Companionからページ内の商品候補を登録。正規アフィURLが画面にある場合のみ保存。",
          selection_score: visibleSelectionScore,
          launch_priority: myfansLaunchPriority(visibleSelectionScore),
          last_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, visibleProductUrl);
        savedProducts += 1;
      }
      return NextResponse.json({ ok: true, importedType: "products", productsCount: savedProducts, approvedMediaId });
    }

    const selectionScore = calculateMyfansSelectionScore({
      price,
      rewardRate,
      planSignupReward,
      recurringRewardRate,
      popularityRank: null,
      likesCount,
      savesCount: 0,
      isNew: Boolean(cleanText(payload.publishedAt)),
      hasAffiliateUrl: Boolean(affiliateUrl),
      hasApprovedMedia: true,
      source_x_url: cleanText(payload.sourceXUrl),
    });
    const record = {
      creator_id: creatorId,
      approved_media_id: approvedMediaId,
      title: productTitle || productUrl,
      product_url: productUrl,
      affiliate_url: affiliateUrl,
      ...(affiliateUrl ? {
        affiliate_url_generated_at: new Date().toISOString(),
        affiliate_url_expires_at: null,
        affiliate_url_source: "chrome_companion",
      } : {}),
      source_x_url: cleanText(payload.sourceXUrl),
      creator_x_url: cleanXProfileUrl(payload.creatorXUrl),
      quote_candidate_x_url: cleanText(payload.quoteCandidateXUrl) || cleanText(payload.sourceXUrl),
      media_permission_status: "unknown",
      genre: cleanText(payload.genre),
      product_type: "single",
      status: "candidate",
      price,
      reward_rate: rewardRate,
      estimated_reward: Math.round(price * (rewardRate / 100)),
      plan_signup_reward: planSignupReward,
      recurring_reward_rate: recurringRewardRate,
      likes_count: likesCount,
      is_new: Boolean(cleanText(payload.publishedAt)),
      approved_media_name: approvedMediaName,
      selection_reason: "Chrome Companionから登録。ユーザーが通常Chromeで閲覧中のmyfansページ情報を保存。",
      selection_score: selectionScore,
      launch_priority: myfansLaunchPriority(selectionScore),
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const productId = await saveProduct(record, productUrl);

    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: productId,
      action: "companion_import",
      summary: record.title,
      metadata: { selectionScore },
    });

    return NextResponse.json({ ok: true, importedType: "product", id: productId, selectionScore, approvedMediaId });
  } catch (error) {
    console.error("myfans companion import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Companion取込に失敗しました。" }, { status: 500 });
  }
}
