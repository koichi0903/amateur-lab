import { NextResponse } from "next/server";
import { createSaveSingleStatusCollectionHandler } from "@/lib/myfansSingleStatusCollectionService";
import { createSaveQuoteScanHandler } from "@/lib/myfansQuoteScanService";
import { saveQuoteCandidate, updateGlobalQuoteRanks } from "@/lib/myfansQuoteCandidateStore";
import { saveDiagnosticStatusScan } from "@/lib/myfansDiagnosticStatusScanService";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";
import {
  cleanDiagnosticStatusUrl,
  cleanText,
} from "@/lib/myfansCompanionInput";
import { normalizeMyfansPostUrl } from "@/lib/myfansProductResolver";
import { normalizeCompanionError } from "@/lib/myfansCompanionErrors";
import { resolveQuoteRefreshFinalStatus } from "@/lib/myfansQuoteRefreshItemStatus";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureExactProductForCreator, extractFinalMyfansUrl, fetchResolverProducts, importObservedMyfansPost } from "@/lib/myfansCompanionImportService";
import { saveStandardCompanionImport } from "@/lib/myfansCompanionStandardImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COLLECTOR_METHOD = "complete_thread_first_v2";
const COMPANION_PROTOCOL_VERSION = "2";

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

type RefreshItemDetail = { collectedCount?: number; topScore?: number | null; error?: string; diagnostics?: Record<string, unknown>; evidence?: Record<string, unknown> };
type RefreshItemStatus = "success" | "failed";
type RefreshItemOutcome = { finalStatus: string; collectionState: string };

function refreshItemResultCode(errorCode: string, finalStatus: string, collectedCount: number | undefined) {
  if (errorCode) return errorCode;
  if (finalStatus !== "success") return "COLLECTION_FAILED";
  return (collectedCount ?? 0) > 0 ? "SUCCESS_SAVE" : "NO_CANDIDATES";
}

function buildRefreshItemCollectionEvidence(payload: QuoteScanPayload, jobId: number, collectionState: string, detail: RefreshItemDetail) {
  return {
    collectorMethod: COLLECTOR_METHOD,
    job_id: jobId,
    collection_session_id: cleanText(payload.collectionSessionId),
    run_token: cleanText(payload.runToken),
    collector_version: cleanText(payload.collectorVersion),
    final_collection_state: collectionState,
    final_error: detail.error ?? null,
    error: detail.error ?? null,
    collectedCount: detail.collectedCount ?? 0,
    ...(detail.evidence ?? {}),
  };
}

function buildRefreshItemPatch(payload: QuoteScanPayload, jobId: number, status: string, errorCode: string, terminal: boolean, collectionState: string, detail: RefreshItemDetail) {
  return {
    status,
    collected_count: detail.collectedCount ?? 0,
    top_score: detail.topScore ?? null,
    error: detail.error ?? null,
    request_type: "quote_scan",
    result_code: refreshItemResultCode(errorCode, status, detail.collectedCount),
    http_status: 200,
    diagnostics: safeDiagnostics(detail.diagnostics ?? detail.evidence ?? {}),
    ...(terminal ? { finished_at: new Date().toISOString() } : {}),
    collection_state: collectionState,
    collection_evidence: buildRefreshItemCollectionEvidence(payload, jobId, collectionState, detail),
    processed_at: new Date().toISOString(),
  };
}

async function persistRefreshItemOutcome(payload: QuoteScanPayload, jobId: number, itemId: number, status: RefreshItemStatus, detail: RefreshItemDetail): Promise<RefreshItemOutcome & { creatorId: number }> {
  const { data: currentItem } = await supabaseAdmin.from("myfans_quote_refresh_job_items").select("attempts").eq("id", itemId).eq("job_id", jobId).maybeSingle();
  const errorCode = quoteRefreshErrorCode(detail.error);
  const collectionState = collectionStateForResult(status, detail);
  const { finalStatus, terminal } = resolveQuoteRefreshFinalStatus({
    status,
    errorCode,
    attempts: Number(currentItem?.attempts ?? 0),
    nonRetryableErrors: NON_RETRYABLE_QUOTE_REFRESH_ERRORS,
  });
  const patch = buildRefreshItemPatch(payload, jobId, finalStatus, errorCode, terminal, collectionState, detail);
  const { error } = await supabaseAdmin.from("myfans_quote_refresh_job_items").update(patch).eq("id", itemId).eq("job_id", jobId);
  if (error) throw error;
  const { data: item } = await supabaseAdmin.from("myfans_quote_refresh_job_items").select("creator_id").eq("id", itemId).eq("job_id", jobId).maybeSingle();
  return { finalStatus, collectionState, creatorId: Number(payload.creatorId) || Number(item?.creator_id) || 0 };
}

async function advanceCreatorCollectionCursor(jobId: number, creatorId: number, existingRotationOrder: number | null | undefined) {
  const { data: cursor } = await supabaseAdmin.from("myfans_collection_cursors").select("cursor_order,cycle_no").eq("collector_key", "myfans_quote_refresh").maybeSingle();
  const terminalOrder = Number(existingRotationOrder ?? creatorId);
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

async function persistCreatorCollectionState(jobId: number, creatorId: number, detail: RefreshItemDetail, outcome: RefreshItemOutcome) {
  const { data: existingState } = await supabaseAdmin.from("myfans_creator_collection_state").select("rotation_order").eq("creator_id", creatorId).maybeSingle();
  const permanent = outcome.collectionState === "NO_POSTS" || outcome.collectionState === "PRIVATE";
  const { error: stateError } = await supabaseAdmin.from("myfans_creator_collection_state").upsert({
    creator_id: creatorId,
    rotation_order: Number(existingState?.rotation_order ?? creatorId),
    collection_enabled: !permanent,
    state: outcome.collectionState,
    exclusion_reason: permanent ? outcome.collectionState.toLowerCase() : null,
    excluded_at: permanent ? new Date().toISOString() : null,
    last_processed_at: new Date().toISOString(),
    last_run_id: jobId,
    evidence: { collectorMethod: COLLECTOR_METHOD, error: detail.error ?? null, collectedCount: detail.collectedCount ?? 0, ...(detail.evidence ?? {}) },
    updated_at: new Date().toISOString(),
  }, { onConflict: "creator_id" });
  if (stateError) throw stateError;
  if (outcome.finalStatus === "success" || outcome.finalStatus === "skipped") {
    await advanceCreatorCollectionCursor(jobId, creatorId, existingState?.rotation_order);
  }
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

async function markRefreshItem(payload: QuoteScanPayload, status: RefreshItemStatus, detail: RefreshItemDetail) {
  const jobId = Number(payload.refreshJobId);
  const itemId = Number(payload.refreshJobItemId);
  if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isFinite(itemId) || itemId <= 0) return;
  const identity = await validateRunIdentity(payload);
  if (!identity.ok) throw new Error(identity.error);
  const { data: job } = await supabaseAdmin.from("myfans_quote_refresh_jobs").select("status").eq("id", jobId).maybeSingle();
  if (job?.status === "cancelled" || job?.status === "failed") return;
  const outcome = await persistRefreshItemOutcome(payload, jobId, itemId, status, detail);
  if (outcome.creatorId > 0) await persistCreatorCollectionState(jobId, outcome.creatorId, detail, outcome);
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

const saveQuoteScan = createSaveQuoteScanHandler({
  COLLECTOR_METHOD,
  THREAD_INCOMPLETE_STATUSES,
  quoteRefreshErrorCode,
  terminalCollectionReport,
  markRefreshItem,
  fetchResolverProducts,
  ensureExactProductForCreator,
  saveQuoteCandidate,
  updateGlobalQuoteRanks,
});

const saveSingleStatusCollectionCore = createSaveSingleStatusCollectionHandler({
  cleanDiagnosticStatusUrl,
  quoteRefreshErrorCode,
  fetchResolverProducts,
  extractFinalMyfansUrl,
  ensureExactProductForCreator,
  saveQuoteCandidate,
  updateGlobalQuoteRanks,
});

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

async function resolveApprovedMedia(payload: Record<string, unknown>) {
  const requestedApprovedMediaName = cleanText(payload.approvedMediaName);
  let approvedMediaId = Number.isFinite(Number(payload.approvedMediaId)) ? Number(payload.approvedMediaId) : null;
  if (!approvedMediaId) {
    const { data: media } = await supabaseAdmin
      .from("myfans_approved_media")
      .select("id")
      .eq("media_name", requestedApprovedMediaName)
      .maybeSingle();
    approvedMediaId = media?.id ?? null;
  }
  const approvedMediaName = requestedApprovedMediaName || (approvedMediaId ? (await supabaseAdmin.from("myfans_approved_media").select("media_name").eq("id", approvedMediaId).maybeSingle()).data?.media_name ?? "" : "");
  return { approvedMediaId, approvedMediaName };
}

async function handleSpecializedCompanionPayload(payload: Record<string, unknown>, approvedMediaId: number | null) {
  if (payload.type === "x_diagnostic_status_scan" || payload.diagnosticMode === true) return saveDiagnosticStatusScan(payload as QuoteScanPayload, approvedMediaId);
  if (payload.type === "x_single_status_collect") return saveSingleStatusCollection(payload as QuoteScanPayload, approvedMediaId);
  if (payload.type === "x_quote_scan") return saveQuoteScan(payload as QuoteScanPayload, approvedMediaId);
  if (normalizeMyfansPostUrl(cleanText(payload.productUrl || payload.pageUrl))) return importObservedMyfansPost(payload, approvedMediaId);
  return null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (cleanText(payload.protocolVersion) !== COMPANION_PROTOCOL_VERSION) {
      return NextResponse.json({ errorCode: "VERSION_MISMATCH", error: "Companion/API protocol version mismatch", expectedProtocolVersion: COMPANION_PROTOCOL_VERSION, receivedProtocolVersion: cleanText(payload.protocolVersion) || null }, { status: 409 });
    }
    const { approvedMediaId, approvedMediaName } = await resolveApprovedMedia(payload);
    const specializedResponse = await handleSpecializedCompanionPayload(payload, approvedMediaId);
    if (specializedResponse) return specializedResponse;
    return await saveStandardCompanionImport(payload, approvedMediaId, approvedMediaName);
  } catch (error) {
    console.error("myfans companion import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Companion取込に失敗しました。" }, { status: 500 });
  }
}