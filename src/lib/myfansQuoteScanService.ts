import { NextResponse } from "next/server";
import { cleanText, cleanXProfileUrl } from "@/lib/myfansCompanionInput";
import { scoreMyfansQuoteCandidate } from "@/lib/myfansQuoteScoring";
import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { isCompleteThreadCandidate } from "@/lib/myfansCompleteThread";
import { buildQuoteScanCollectionEvidence, normalizeQuoteScanCandidates } from "@/lib/myfansQuoteScanNormalization";
import { firstFinalMyfansUrl, persistRankedQuoteScanCandidates } from "@/lib/myfansQuoteScanPersistence";
import { completeQuoteScanCollection } from "@/lib/myfansQuoteScanCompletion";
import { createBatchProductResolver, fetchQuoteScanProduct, type ExactQuoteProductResolution } from "@/lib/myfansQuoteScanProductResolution";
import { resolveNoReadyQuoteCandidateOutcome } from "@/lib/myfansQuoteScanNoReady";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";

type RefreshItemDetail = {
  collectedCount?: number;
  topScore?: number | null;
  error?: string;
  diagnostics?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

type SaveQuoteScanDependencies = {
  COLLECTOR_METHOD: string;
  THREAD_INCOMPLETE_STATUSES: ReadonlySet<string>;
  quoteRefreshErrorCode: (error: string | undefined) => string;
  terminalCollectionReport: (payload: QuoteScanPayload, errorCode: string, message: string, diagnostics?: Record<string, unknown>) => Promise<NextResponse>;
  markRefreshItem: (payload: QuoteScanPayload, status: "success" | "failed", detail: RefreshItemDetail) => Promise<void>;
  fetchResolverProducts: () => Promise<MyfansProduct[]>;
  ensureExactProductForCreator: (finalMyfansUrl: string, creatorId: number, approvedMediaId: number | null) => Promise<ExactQuoteProductResolution>;
  saveQuoteCandidate: (record: Record<string, unknown>, creatorId: number) => Promise<number | null>;
  updateGlobalQuoteRanks: (approvedMediaId: number | null) => Promise<void>;
};

export function createSaveQuoteScanHandler(deps: SaveQuoteScanDependencies) {
  const { COLLECTOR_METHOD, THREAD_INCOMPLETE_STATUSES, quoteRefreshErrorCode, terminalCollectionReport, markRefreshItem, fetchResolverProducts, ensureExactProductForCreator, saveQuoteCandidate, updateGlobalQuoteRanks } = deps;
  return async function saveQuoteScan(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const { productId, creatorId } = positiveQuoteScanIds(payload);
  const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const failureReason = cleanText(payload.failureReason);
  const candidates = quoteScanCandidates(payload);
  const collectionEvidence = buildQuoteScanCollectionEvidence(payload);
  const preflightResponse = await earlyQuoteScanResponse({ payload, candidates, collectionEvidence, collectorMethod: COLLECTOR_METHOD, incompleteStatuses: THREAD_INCOMPLETE_STATUSES, markRefreshItem, failureReason, quoteRefreshErrorCode, terminalCollectionReport, creatorXUrl, sourceXHandle });
  if (preflightResponse) return preflightResponse;

  const product = await fetchQuoteScanProduct(productId, creatorId);

  const resolvedCreatorId = creatorId ?? product?.creator_id;
  if (!resolvedCreatorId) {
    return terminalCollectionReport(payload, "CREATOR_NOT_FOUND", "Daily Pageの対象creatorを取得できませんでした。", collectionEvidence);
  }

  const normalized = normalizeQuoteScanCandidates(candidates, sourceXHandle);

  if (normalized.length === 0) {
    return terminalCollectionReport(payload, "CREATOR_MISMATCH", "creator本人の表示中投稿が見つかりませんでした。", { ...collectionEvidence, candidateCount: candidates.length });
  }

  const sourceTextMissingCount = normalized.filter((candidate) => !candidate.text).length;
  const sourceReady = readyQuoteScanCandidates(normalized);
  if (sourceReady.length === 0) {
    return noReadyQuoteCandidateResponse({ payload, normalized, sourceTextMissingCount, collectionEvidence, collectorMethod: COLLECTOR_METHOD, incompleteStatuses: THREAD_INCOMPLETE_STATUSES, markRefreshItem, terminalCollectionReport });
  }

  const scored = sourceReady
    .map((candidate) => ({ candidate, result: scoreMyfansQuoteCandidate(candidate) }))
    .sort((a, b) => b.result.score - a.result.score);
  const ranked = scored.map((item, index) => ({ ...item, creatorRank: index + 1 }));
  const top = ranked.filter((item) => item.result.eligible && item.creatorRank <= 3);
  const best = top[0] ?? null;
  const resolverProducts = await fetchResolverProducts();

  const bestFinalUrl = best ? firstFinalMyfansUrl(best.candidate) : "";
  const resolveBatchProduct = createBatchProductResolver({
    approvedMediaId,
    collectorMethod: COLLECTOR_METHOD,
    creatorId: resolvedCreatorId,
    ensureExactProductForCreator,
    resolverProducts,
  });

  const bestProductResolution = await resolveBatchProduct(bestFinalUrl);
  await clearPreviousQuoteSelection(best, bestProductResolution, resolvedCreatorId);

  await persistRankedQuoteScanCandidates({
    approvedMediaId,
    approvedProduct: product,
    creatorId: resolvedCreatorId,
    creatorXUrl,
    ranked,
    best,
    resolverProducts,
    resolveBatchProduct,
    saveQuoteCandidate,
    sourceXHandle,
  });

  return completeQuoteScanCollection({
    approvedMediaId,
    approvedProduct: product,
    best,
    bestProductResolution,
    collectionEvidence,
    collectorMethod: COLLECTOR_METHOD,
    creatorId: resolvedCreatorId,
    markRefreshItem,
    payload,
    sourceTextMissingCount,
    totalCandidateCount: scored.length,
    updateGlobalQuoteRanks,
  });

  };
}

async function duplicateBatchReplayResponse(payload: QuoteScanPayload) {
  const jobId = Number(payload.refreshJobId);
  const itemId = Number(payload.refreshJobItemId);
  if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isFinite(itemId) || itemId <= 0) return null;
  const { data: existingItem } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status,collection_state,collected_count")
    .eq("id", itemId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!existingItem || !["success", "failed", "skipped"].includes(existingItem.status)) return null;
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "quote_refresh_job_item",
    entity_id: itemId,
    action: "duplicate_batch_save_ignored",
    summary: "既にterminalのbatch itemへの重複保存を無視",
    metadata: { jobId, status: existingItem.status, collectionState: existingItem.collection_state ?? null },
  });
  return NextResponse.json({ ok: true, replayed: true, candidatesCount: Number(existingItem.collected_count ?? 0), collectionState: existingItem.collection_state ?? null });
}

function positiveQuoteScanIds(payload: QuoteScanPayload) {
  const positiveId = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return { productId: positiveId(payload.productId), creatorId: positiveId(payload.creatorId) };
}

function quoteScanCandidates(payload: QuoteScanPayload) {
  return Array.isArray(payload.quoteCandidates) ? payload.quoteCandidates.slice(0, 20) : [];
}

async function earlyQuoteScanResponse(input: {
  payload: QuoteScanPayload;
  candidates: NonNullable<QuoteScanPayload["quoteCandidates"]>;
  collectionEvidence: Record<string, unknown>;
  collectorMethod: string;
  incompleteStatuses: ReadonlySet<string>;
  markRefreshItem: SaveQuoteScanDependencies["markRefreshItem"];
  failureReason: string;
  quoteRefreshErrorCode: SaveQuoteScanDependencies["quoteRefreshErrorCode"];
  terminalCollectionReport: SaveQuoteScanDependencies["terminalCollectionReport"];
  creatorXUrl: string;
  sourceXHandle: string;
}) {
  const replay = await duplicateBatchReplayResponse(input.payload);
  if (replay) return replay;
  const failure = collectionFailureResponse(input.payload, input.failureReason, input.quoteRefreshErrorCode, input.terminalCollectionReport);
  if (failure) return failure;
  const emptyThread = await emptyThreadCollectionResponse({
    payload: input.payload,
    candidates: input.candidates,
    collectionEvidence: input.collectionEvidence,
    collectorMethod: input.collectorMethod,
    incompleteStatuses: input.incompleteStatuses,
    markRefreshItem: input.markRefreshItem,
  });
  if (emptyThread) return emptyThread;
  const invalidSource = invalidQuoteScanSourceResponse(input.creatorXUrl, input.sourceXHandle);
  if (invalidSource) return invalidSource;
  if (input.candidates.length === 0) {
    return input.terminalCollectionReport(input.payload, "NO_CANDIDATES", "Xプロフィール上に保存可能な投稿候補がありません。", input.collectionEvidence);
  }
  return null;
}

async function clearPreviousQuoteSelection(
  best: { candidate: { xPostUrl: string } } | null,
  resolution: ExactQuoteProductResolution,
  creatorId: number,
) {
  if (!best || !resolution.product?.id) return;
  const { error } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ selected: false })
    .eq("creator_id", creatorId);
  if (error) throw error;
}

function collectionFailureResponse(
  payload: QuoteScanPayload,
  failureReason: string,
  quoteRefreshErrorCode: SaveQuoteScanDependencies["quoteRefreshErrorCode"],
  terminalCollectionReport: SaveQuoteScanDependencies["terminalCollectionReport"],
) {
  if (!failureReason) return null;
  const errorCode = quoteRefreshErrorCode(failureReason) || "COLLECTION_FAILED";
  return terminalCollectionReport(payload, errorCode, failureReason.replace(/^[A-Z_/]+:\s*/, ""), {
    collectionFailure: payload.collectionFailure ?? null,
    collectionStatuses: payload.collectionStatuses ?? [],
    stateTransitions: payload.stateTransitions ?? [],
  });
}

async function emptyThreadCollectionResponse(input: {
  payload: QuoteScanPayload;
  candidates: NonNullable<QuoteScanPayload["quoteCandidates"]>;
  collectionEvidence: Record<string, unknown>;
  collectorMethod: string;
  incompleteStatuses: ReadonlySet<string>;
  markRefreshItem: SaveQuoteScanDependencies["markRefreshItem"];
}) {
  const { payload, candidates, collectionEvidence, collectorMethod, incompleteStatuses, markRefreshItem } = input;
  const statuses = payload.collectionStatuses;
  if (candidates.length !== 0 || !Array.isArray(statuses) || statuses.length === 0 || !cleanXProfileUrl(payload.creatorXUrl)) return null;
  const creatorIdForAudit = Number(payload.creatorId);
  if (Number.isSafeInteger(creatorIdForAudit) && creatorIdForAudit > 0) {
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "creator",
      entity_id: creatorIdForAudit,
      action: "complete_thread_collection_status",
      summary: `${collectorMethod}: no eligible parent`,
      metadata: { collectorMethod, statuses, ...collectionEvidence },
    });
  }
  return markEmptyThreadRefreshItem(payload, statuses, incompleteStatuses, collectionEvidence, markRefreshItem);
}

async function markEmptyThreadRefreshItem(
  payload: QuoteScanPayload,
  statuses: NonNullable<QuoteScanPayload["collectionStatuses"]>,
  incompleteStatuses: ReadonlySet<string>,
  collectionEvidence: Record<string, unknown>,
  markRefreshItem: SaveQuoteScanDependencies["markRefreshItem"],
) {
  const incomplete = statuses.some((item) => incompleteStatuses.has(cleanText(item.status)));
  const reason = statuses.find((item) => incompleteStatuses.has(cleanText(item.status)))?.status || "THREAD_INCOMPLETE_WITHOUT_LINK";
  const error = incomplete ? `${reason}: status threadを十分に観測できませんでした。` : undefined;
  await markRefreshItem(payload, incomplete ? "failed" : "success", { collectedCount: 0, topScore: null, error, evidence: collectionEvidence });
  return NextResponse.json({
    ok: !incomplete,
    retryable: incomplete,
    errorCode: incomplete ? reason : null,
    importedType: "quote_candidates",
    candidatesCount: 0,
    collectionStatuses: statuses,
    profileCounts: payload.profileCounts ?? {},
    statusCounts: payload.statusCounts ?? {},
    stateTransitions: payload.stateTransitions ?? [],
    ...(error ? { error } : {}),
  }, { status: incomplete ? 202 : 200 });
}

function invalidQuoteScanSourceResponse(creatorXUrl: string, sourceXHandle: string) {
  if (creatorXUrl && sourceXHandle) return null;
  return NextResponse.json({ error: "creatorXUrlとsourceXHandleが必要です。", errorCode: "INVALID_PAYLOAD" }, { status: 400 });
}

function readyQuoteScanCandidates(candidates: NonNullable<QuoteScanPayload["quoteCandidates"]>) {
  return candidates.filter((candidate) => {
    if (!candidate.text) return false;
    if (candidate.collectorMethod === "complete_thread_first_v2") return isCompleteThreadCandidate(candidate);
    return true;
  });
}

async function noReadyQuoteCandidateResponse(input: {
  payload: QuoteScanPayload;
  normalized: NonNullable<QuoteScanPayload["quoteCandidates"]>;
  sourceTextMissingCount: number;
  collectionEvidence: Record<string, unknown>;
  collectorMethod: string;
  incompleteStatuses: ReadonlySet<string>;
  markRefreshItem: SaveQuoteScanDependencies["markRefreshItem"];
  terminalCollectionReport: SaveQuoteScanDependencies["terminalCollectionReport"];
}) {
  const { payload, normalized, sourceTextMissingCount, collectionEvidence, collectorMethod, incompleteStatuses, markRefreshItem, terminalCollectionReport } = input;
  const statuses = payload.collectionStatuses;
  const outcome = resolveNoReadyQuoteCandidateOutcome({
    hasCollectorCandidate: normalized.some((candidate) => candidate.collectorMethod === collectorMethod),
    statuses,
    incompleteStatuses,
  });
  if (outcome.kind === "thread-status") {
    const { incomplete, reason, error } = outcome;
    await markRefreshItem(payload, incomplete ? "failed" : "success", { collectedCount: 0, topScore: null, error, evidence: collectionEvidence });
    return NextResponse.json({
      ok: !incomplete,
      retryable: incomplete,
      errorCode: incomplete ? reason : null,
      importedType: "quote_candidates",
      candidatesCount: 0,
      collectionStatuses: outcome.statuses,
      profileCounts: payload.profileCounts ?? {},
      statusCounts: payload.statusCounts ?? {},
      stateTransitions: payload.stateTransitions ?? [],
      ...(error ? { error } : {}),
    }, { status: incomplete ? 202 : 200 });
  }
  return terminalCollectionReport(payload, "NO_BODY", "表示中投稿に安全に紐付けられる本文がありません。空本文は保存しません。", { ...collectionEvidence, candidateCount: normalized.length, sourceTextMissingCount });
}
