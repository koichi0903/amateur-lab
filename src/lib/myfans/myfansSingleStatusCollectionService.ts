import { NextResponse } from "next/server";
import { cleanMyfansUrl, cleanText, cleanXStatusUrl } from "@/lib/myfans/myfansCompanionInput";
import { normalizeMyfansPostUrl, resolveExactMyfansProductByFinalUrl } from "@/lib/myfansProductResolver";
import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { scoreMyfansQuoteCandidate, type MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import { extractMyfansSourceText } from "@/lib/myfansSourceText";
import { canonicalMyfansXHandle, resolveExactMyfansCreator } from "@/lib/myfansAuthorMatch";
import { companionPersistenceError, normalizeCompanionError } from "@/lib/myfansCompanionErrors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { QuoteScanPayload } from "@/lib/myfans/myfansQuoteScanTypes";
import { buildSingleStatusCandidateRecord } from "@/lib/myfans/myfansSingleStatusRecord";

type ExactProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

type SaveSingleStatusCollectionDependencies = {
  cleanDiagnosticStatusUrl: (value: unknown) => string;
  quoteRefreshErrorCode: (error: string | undefined) => string;
  fetchResolverProducts: () => Promise<MyfansProduct[]>;
  extractFinalMyfansUrl: (candidate: QuoteScanPayload["statusCandidate"]) => string;
  ensureExactProductForCreator: (finalMyfansUrl: string, creatorId: number, approvedMediaId: number | null) => Promise<ExactProductResolution>;
  saveQuoteCandidate: (record: Record<string, unknown>, creatorId: number, existingCandidateId?: number | null) => Promise<number | null>;
  updateGlobalQuoteRanks: (approvedMediaId: number | null) => Promise<void>;
};

type SingleStatusAudit = (metadata: Record<string, unknown>, summary: string) => Promise<void>;

type ExistingSingleStatusCandidate = {
  id: number;
  approved_media_id?: number | null;
  creator_x_url?: string | null;
};

type SingleStatusLinkContext = {
  observedLinkCount: number;
  observedMfcoUrl: string;
  finalMyfansUrl: string;
  myfansPostUuid: string | null;
};

export function createSaveSingleStatusCollectionHandler(deps: SaveSingleStatusCollectionDependencies) {
  const { cleanDiagnosticStatusUrl, quoteRefreshErrorCode, fetchResolverProducts, extractFinalMyfansUrl, ensureExactProductForCreator, saveQuoteCandidate, updateGlobalQuoteRanks } = deps;
  return async function saveSingleStatusCollectionCore(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const source = normalizeSingleStatusSource(payload, cleanDiagnosticStatusUrl);
  const { sourceStatusUrl, sourceXHandle, candidate, candidateUrl, candidateAuthor, sourceHandleFromStatus, text } = source;
  let auditContext: Record<string, unknown> = { sourceStatusUrl, sourceXHandle, singleStatusRunId: cleanText(payload.singleStatusRunId) || null, candidateId: null, matchedCreatorId: null, observedMfcoUrl: null, finalMyfansUrl: null, myfansPostUuid: null, matchedOrCreatedProductId: null, productResolutionMethod: null, resultReason: null };
  const audit = createSingleStatusAudit(() => auditContext);
  const preflightResponse = await validateSingleStatusCollection({
    payload,
    sourceStatusUrl,
    sourceXHandle,
    candidateUrl,
    candidateAuthor,
    sourceHandleFromStatus,
    text,
    quoteRefreshErrorCode,
    audit,
  });
  if (preflightResponse) return preflightResponse;

  const { data: creators, error: creatorError } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,creator_x_url,source_x_handle");
  if (creatorError) throw creatorError;
  const creatorMatch = resolveExactMyfansCreator(creators ?? [], sourceXHandle);
  auditContext = { ...auditContext, ...creatorAuditFields(creatorMatch) };
  if (!creatorMatch.creatorId) {
    return await noExactCreatorResponse(creatorMatch, payload, sourceStatusUrl, sourceXHandle, audit);
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
  const resolvedEvidence = singleStatusResolvedEvidence(candidate);
  const finalMyfansUrl = extractFinalMyfansUrl(candidate);
  const linkContext = buildSingleStatusLinkContext(candidate, resolvedEvidence, finalMyfansUrl);
  const { observedLinkCount } = linkContext;
  auditContext = { ...auditContext, ...singleStatusLinkAuditFields(linkContext) };
  const dbProductResolution = resolveExactMyfansProductByFinalUrl(finalMyfansUrl, products, creatorMatch.creatorId);
  const productResolution = await resolveSingleStatusProduct({
    dbProduct: dbProductResolution.product as Record<string, unknown> | null,
    finalMyfansUrl,
    observedLinkCount,
    creatorId: creatorMatch.creatorId,
    approvedMediaId,
    ensureExactProductForCreator,
    auditContext,
    sourceStatusUrl,
    audit,
  });
  const product = productResolution.product;
  const productId = singleStatusProductId(product);
  auditContext = { ...auditContext, ...productAuditFields(productId, productResolution) };

  const { normalized, scored, quoteVisualReady, record } = buildSingleStatusCandidateRecord({
    approvedMediaId,
    candidate,
    candidateUrl,
    creatorId: creatorMatch.creatorId,
    finalMyfansUrl,
    existingCandidate: existingCandidate ?? null,
    product,
    productId,
    productResolutionMethod: productResolution.method,
    resolvedEvidence,
    sourceXHandle,
    text,
  });
  const candidateId = await saveQuoteCandidate(record, creatorMatch.creatorId, existingCandidateId(existingCandidate));
  auditContext = { ...auditContext, candidateId };
  return completeSingleStatusSave({
    approvedMediaId,
    candidate,
    candidateId,
    creatorId: creatorMatch.creatorId,
    existingCandidate: singleStatusCandidateIdentity(existingCandidate),
    finalMyfansUrl,
    normalized,
    observedLinkCount,
    observedMfcoUrl: linkContext.observedMfcoUrl,
    product,
    productId,
    productResolution,
    quoteVisualReady,
    resolvedEvidence,
    scored,
    sourceStatusUrl,
    sourceXHandle,
    updateGlobalQuoteRanks,
    audit,
  });

  };
}

function normalizeSingleStatusSource(
  payload: QuoteScanPayload,
  cleanDiagnosticStatusUrl: SaveSingleStatusCollectionDependencies["cleanDiagnosticStatusUrl"],
) {
  const sourceStatusUrl = cleanDiagnosticStatusUrl(payload.sourceStatusUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const candidate = payload.statusCandidate;
  return {
    sourceStatusUrl,
    sourceXHandle,
    candidate,
    candidateUrl: cleanXStatusUrl(candidate?.xPostUrl),
    candidateAuthor: cleanText(candidate?.authorHandle).replace(/^@/, ""),
    sourceHandleFromStatus: sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "",
    text: extractMyfansSourceText(candidate?.text, candidate?.articleText),
  };
}

function singleStatusResolvedEvidence(candidate: QuoteScanPayload["statusCandidate"]) {
  return Array.isArray(candidate?.resolvedProductEvidence) ? candidate.resolvedProductEvidence : [];
}

function existingCandidateId(candidate: ExistingSingleStatusCandidate | null | undefined) {
  return candidate?.id;
}

function singleStatusProductId(product: Record<string, unknown> | null) {
  return product?.id ? Number(product.id) : null;
}

function createSingleStatusAudit(getAuditContext: () => Record<string, unknown>): SingleStatusAudit {
  return async (metadata, summary) => {
    const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: null,
      action: "single_status_collect",
      summary,
      metadata: { phase: "saved", ...getAuditContext(), ...metadata },
    });
    if (error) throw error;
  };
}

async function validateSingleStatusCollection(input: {
  payload: QuoteScanPayload;
  sourceStatusUrl: string;
  sourceXHandle: string;
  candidateUrl: string;
  candidateAuthor: string;
  sourceHandleFromStatus: string;
  text: string;
  quoteRefreshErrorCode: SaveSingleStatusCollectionDependencies["quoteRefreshErrorCode"];
  audit: SingleStatusAudit;
}) {
  const { payload, sourceStatusUrl, sourceXHandle, candidateUrl, candidateAuthor, sourceHandleFromStatus, text, quoteRefreshErrorCode, audit } = input;
  const collectionError = cleanText(payload.collectionError);
  if (collectionError) return collectionErrorResponse({ payload, collectionError, sourceStatusUrl, sourceXHandle, quoteRefreshErrorCode, audit });
  if (!sourceStatusUrl || !sourceXHandle || sourceHandleFromStatus.toLowerCase() !== sourceXHandle.toLowerCase()) {
    await audit({ ok: false, sourceStatusUrl, reason: "source_handle_mismatch" }, sourceStatusUrl || "single status収集失敗");
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "CREATOR_MISMATCH", error: "指定status URLとsource handleが一致しません。" }, { status: 200 });
  }
  if (candidateUrl !== sourceStatusUrl || candidateAuthor.toLowerCase() !== sourceXHandle.toLowerCase()) {
    await audit({ ok: false, sourceStatusUrl, candidateUrl, candidateAuthor, reason: "author_or_status_mismatch" }, sourceStatusUrl);
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "CREATOR_MISMATCH", error: "取得したX投稿のauthor/statusが指定URLと一致しません。保存しませんでした。" }, { status: 200 });
  }
  if (!text) {
    await audit({ ok: false, sourceStatusUrl, authorStatusMatch: true, sourceTextSaved: false, reason: "source_text_missing" }, sourceStatusUrl);
    return NextResponse.json({ ok: false, terminal: true, retryable: false, errorCode: "NO_BODY", error: "指定statusの具体的な本文を取得できませんでした。保存しませんでした。" }, { status: 200 });
  }
  return null;
}

async function collectionErrorResponse(input: {
  payload: QuoteScanPayload;
  collectionError: string;
  sourceStatusUrl: string;
  sourceXHandle: string;
  quoteRefreshErrorCode: SaveSingleStatusCollectionDependencies["quoteRefreshErrorCode"];
  audit: SingleStatusAudit;
}) {
  const { payload, collectionError, sourceStatusUrl, sourceXHandle, quoteRefreshErrorCode, audit } = input;
  const failure = payload.collectionFailure;
  await audit({
    ok: false,
    sourceStatusUrl,
    sourceXHandle,
    singleStatusRunId: cleanText(payload.singleStatusRunId),
    reason: "x_collection_failed",
    error: collectionError.slice(0, 500),
    failure: failure ? {
      stage: cleanText(failure.stage),
      errorCode: cleanText(failure.errorCode),
      diagnostics: failure.diagnostics ?? {},
      transitions: (failure.transitions ?? []).slice(-12),
    } : null,
  }, sourceStatusUrl || "single status収集失敗");
  const errorCode = cleanText(failure?.errorCode) || quoteRefreshErrorCode(collectionError) || "COLLECTION_FAILED";
  return NextResponse.json({ ok: false, terminal: true, retryable: false, skipped: errorCode === "LOGIN_OR_CHALLENGE", errorCode, error: collectionError }, { status: 200 });
}

async function noExactCreatorResponse(
  creatorMatch: ReturnType<typeof resolveExactMyfansCreator>,
  payload: QuoteScanPayload,
  sourceStatusUrl: string,
  sourceXHandle: string,
  audit: SingleStatusAudit,
) {
  const ambiguous = creatorMatch.status === "ambiguous";
  const reason = ambiguous ? "ambiguous_creator_author" : "creator_not_found";
  await audit({ ok: false, sourceStatusUrl, sourceXHandle: canonicalMyfansXHandle(sourceXHandle), authorStatusMatch: true, sourceTextSaved: true, reason }, sourceStatusUrl);
  return NextResponse.json({
    ok: false,
    terminal: true,
    retryable: false,
    errorCode: ambiguous ? "CREATOR_MISMATCH" : "CREATOR_NOT_FOUND",
    error: ambiguous ? "X authorに一致するcreatorが複数あるため保存しませんでした。" : "既存DBにX authorと完全一致するcreatorが見つかりません。productの有無とは無関係に保存しませんでした。",
    creatorMatch: creatorMatch.status,
    productMatch: "unresolved",
    resultReason: reason,
    singleStatusRunId: cleanText(payload.singleStatusRunId) || null,
  }, { status: 200 });
}

function creatorAuditFields(creatorMatch: ReturnType<typeof resolveExactMyfansCreator>) {
  const resultReason = creatorMatch.status === "exact" ? null : creatorMatch.status === "ambiguous" ? "ambiguous_creator_author" : "creator_not_found";
  return { matchedCreatorId: creatorMatch.creatorId, resultReason };
}

function buildSingleStatusLinkContext(
  candidate: QuoteScanPayload["statusCandidate"],
  resolvedEvidence: unknown[],
  finalMyfansUrl: string,
): SingleStatusLinkContext {
  const observedLinkCount = Array.isArray(candidate?.myfansUrls) ? candidate.myfansUrls.length : 0;
  const matchedEvidence = resolvedEvidence.find((item) => {
    if (!item || typeof item !== "object") return false;
    return Boolean(cleanText((item as Record<string, unknown>).observedMfcoUrl));
  }) as Record<string, unknown> | undefined;
  const firstObservedMyfansUrl = candidate?.myfansUrls?.find((url) => /^https:\/\/(?:www\.)?(?:mfco\.link|t\.co)\//i.test(String(url)));
  const observedMfcoUrl = cleanText(matchedEvidence?.observedMfcoUrl || firstObservedMyfansUrl || null);
  const myfansPostUuid = finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null;
  return { observedLinkCount, observedMfcoUrl, finalMyfansUrl, myfansPostUuid };
}

function singleStatusLinkAuditFields(context: SingleStatusLinkContext) {
  return {
    observedMfcoUrl: context.observedMfcoUrl,
    finalMyfansUrl: context.finalMyfansUrl || null,
    myfansPostUuid: context.myfansPostUuid,
  };
}

function productAuditFields(productId: number | null, resolution: ExactProductResolution) {
  const resultReason = resolution.status === "exact"
    ? null
    : resolution.status === "ambiguous"
      ? "ambiguous_product_identity"
      : resolution.missing.join("|") || "product_not_registered";
  return { matchedOrCreatedProductId: productId, productResolutionMethod: resolution.method, resultReason };
}

function singleStatusCandidateIdentity(candidate: ExistingSingleStatusCandidate | null | undefined): ExistingSingleStatusCandidate | null {
  if (!candidate) return null;
  return { id: candidate.id, approved_media_id: candidate.approved_media_id, creator_x_url: candidate.creator_x_url };
}

async function resolveSingleStatusProduct(input: {
  dbProduct: Record<string, unknown> | null;
  finalMyfansUrl: string;
  observedLinkCount: number;
  creatorId: number;
  approvedMediaId: number | null;
  ensureExactProductForCreator: SaveSingleStatusCollectionDependencies["ensureExactProductForCreator"];
  auditContext: Record<string, unknown>;
  sourceStatusUrl: string;
  audit: SingleStatusAudit;
}): Promise<ExactProductResolution> {
  const { dbProduct, finalMyfansUrl, observedLinkCount, creatorId, approvedMediaId, ensureExactProductForCreator, auditContext, sourceStatusUrl, audit } = input;
  if (dbProduct) return { product: dbProduct, status: "exact", method: "existing_canonical_url", missing: [] };
  if (!finalMyfansUrl) return { product: null, status: "blocked", method: "no_final_myfans_url", missing: observedLinkCount > 0 ? ["final MyFans post URL"] : [] };
  try {
    return await ensureExactProductForCreator(finalMyfansUrl, creatorId, approvedMediaId);
  } catch (error) {
    const normalizedError = normalizeCompanionError(error, "product_resolution");
    await audit({ ...auditContext, ok: false, reason: "product_resolution_failed", ...normalizedError }, sourceStatusUrl);
    throw companionPersistenceError(normalizedError, normalizedError.errorStage, "product_resolution_failed");
  }
}

type CompleteSingleStatusSaveInput = {
  approvedMediaId: number | null;
  candidate?: QuoteScanPayload["statusCandidate"];
  candidateId: number | null;
  creatorId: number;
  existingCandidate: ExistingSingleStatusCandidate | null;
  finalMyfansUrl: string;
  normalized: MyfansQuoteScanCandidate;
  observedLinkCount: number;
  observedMfcoUrl: string;
  product: Record<string, unknown> | null;
  productId: number | null;
  productResolution: ExactProductResolution;
  quoteVisualReady: boolean;
  resolvedEvidence: unknown[];
  scored: ReturnType<typeof scoreMyfansQuoteCandidate>;
  sourceStatusUrl: string;
  sourceXHandle: string;
  updateGlobalQuoteRanks: SaveSingleStatusCollectionDependencies["updateGlobalQuoteRanks"];
  audit: SingleStatusAudit;
};

async function completeSingleStatusSave(input: CompleteSingleStatusSaveInput) {
  const partialFailures: string[] = [];
  await persistSingleStatusRelationships(input, partialFailures);
  const rankConflict = await updateSingleStatusRanks(input, partialFailures);
  if (rankConflict) return rankConflict;
  const metadata = buildSingleStatusResultMetadata(input);
  const auditFailure = await recordSingleStatusSuccessAudit(input.audit, metadata, input.sourceStatusUrl);
  if (auditFailure) partialFailures.push(auditFailure);
  return singleStatusResultResponse(metadata, partialFailures, Boolean(input.existingCandidate?.id));
}

async function persistSingleStatusRelationships(input: CompleteSingleStatusSaveInput, partialFailures: string[]) {
  await updateSingleStatusProductPointer(input, partialFailures);
  await persistSingleStatusProductLinkEvidence(input);
}

async function updateSingleStatusProductPointer(input: CompleteSingleStatusSaveInput, partialFailures: string[]) {
  const { normalized, productId } = input;
  if (productId) {
    const { error } = await supabaseAdmin.from("myfans_products").update({ quote_candidate_x_url: normalized.mediaPermalink || normalized.xPostUrl, updated_at: new Date().toISOString() }).eq("id", productId);
    if (error) partialFailures.push(`product pointer update: ${error.message}`);
  }
}

async function persistSingleStatusProductLinkEvidence(input: CompleteSingleStatusSaveInput) {
  const { approvedMediaId, candidate, candidateId, creatorId, existingCandidate, finalMyfansUrl, product, productId, productResolution, resolvedEvidence, sourceStatusUrl, sourceXHandle } = input;
  if (!finalMyfansUrl) return;
  const discoveredUrl = discoveredSingleStatusMyfansUrl(resolvedEvidence, finalMyfansUrl);
  const evidenceSource = singleStatusEvidenceSource(candidate);
  const { error } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").upsert({
    approved_media_id: approvedMediaId ?? existingCandidate?.approved_media_id ?? product?.approved_media_id ?? null,
    quote_candidate_id: candidateId,
    source_status_url: sourceStatusUrl,
    source_author_handle: canonicalMyfansXHandle(sourceXHandle),
    discovered_myfans_url: discoveredUrl,
    final_myfans_url: finalMyfansUrl,
    product_id: productId,
    resolution_method: singleStatusResolutionMethod(productResolution),
    confidence: "exact",
    evidence_source: evidenceSource,
    verified_at: new Date().toISOString(),
    metadata: { link_source: evidenceSource === "author_reply" ? "author_reply" : "parent", myfans_post_uuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null, matched_creator_id: creatorId, matched_product_id: productId, product_resolution: productResolution.status, product_resolution_method: productResolution.method, missing_product_fields: productResolution.missing, resolver_evidence: resolvedEvidence },
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_status_url,discovered_myfans_url,evidence_source" });
  if (error && !/myfans_post_product_linkage_evidence|schema cache|does not exist/i.test(error.message)) throw error;
}

function discoveredSingleStatusMyfansUrl(resolvedEvidence: unknown[], finalMyfansUrl: string) {
  const resolver = resolvedEvidence.find((item) => singleStatusEvidenceMatchesUrl(item, finalMyfansUrl)) as Record<string, unknown> | undefined || {};
  const rawUrl = cleanText(resolver.observedMfcoUrl || resolver.sourceUrl || finalMyfansUrl).replace(/[?#].*$/, "");
  return /^(?:https:\/\/(?:www\.)?(?:mfco\.link|t\.co|myfans\.jp)\/)/i.test(rawUrl) ? rawUrl : finalMyfansUrl;
}

function singleStatusEvidenceMatchesUrl(item: unknown, finalMyfansUrl: string) {
  if (!item || typeof item !== "object") return false;
  const evidenceUrl = cleanMyfansUrl((item as Record<string, unknown>).finalMyfansUrl);
  return Boolean(evidenceUrl && normalizeMyfansPostUrl(evidenceUrl) === finalMyfansUrl);
}

function singleStatusEvidenceSource(candidate: QuoteScanPayload["statusCandidate"]) {
  return candidate?.myfansLinkSource === "own_reply" ? "author_reply" : "author_post";
}

function singleStatusResolutionMethod(resolution: ExactProductResolution) {
  if (resolution.status !== "exact") return "myfans_url_resolved_product_not_registered";
  return resolution.method === "existing_canonical_url" ? "exact_product_url" : "safe_redirect_product_url";
}

async function updateSingleStatusRanks(input: CompleteSingleStatusSaveInput, partialFailures: string[]) {
  try {
    await input.updateGlobalQuoteRanks(input.approvedMediaId ?? input.existingCandidate?.approved_media_id ?? (input.product?.approved_media_id as number | null | undefined) ?? null);
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("JOB_IDENTITY_MISMATCH:")) {
      return NextResponse.json({ ok: false, retryable: false, errorCode: "JOB_IDENTITY_MISMATCH", error: error.message }, { status: 409 });
    }
    partialFailures.push(`global rank update: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function buildSingleStatusResultMetadata(input: CompleteSingleStatusSaveInput) {
  const { candidateId, creatorId, existingCandidate, finalMyfansUrl, normalized, observedLinkCount, observedMfcoUrl, productId, productResolution, quoteVisualReady, scored, sourceStatusUrl } = input;
  return {
    ok: true,
    sourceStatusUrl,
    candidateId,
    creatorId,
    matchedCreatorId: creatorId,
    creatorMatch: "exact",
    productId,
    matchedOrCreatedProductId: productId,
    productMatch: productMatchForResolution(productResolution),
    productResolution: productResolution.status,
    productResolutionMethod: productResolution.method,
    resultReason: singleStatusResultReason(productResolution, Boolean(existingCandidate?.id)),
    linkDetected: observedLinkCount > 0,
    linkResolution: singleStatusLinkResolution(finalMyfansUrl, observedLinkCount),
    observedMfcoUrl,
    finalMyfansUrl: finalMyfansUrl || null,
    myfansPostUuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null,
    linkSource: normalized.myfansLinkSource,
    existingCandidate: Boolean(existingCandidate?.id),
    sourceTextSaved: true,
    authorStatusMatch: true,
    visualStatus: singleStatusVisualStatus(quoteVisualReady, normalized.mediaType),
    score: scored.score,
    eligible: scored.eligible,
  };
}

function productMatchForResolution(resolution: ExactProductResolution) {
  if (resolution.status === "exact") return "exact";
  return resolution.status === "blocked" ? "product_registration_blocked" : "unresolved";
}

function singleStatusResultReason(resolution: ExactProductResolution, isExistingCandidate: boolean) {
  if (resolution.status === "exact") return isExistingCandidate ? "NO_NEW_CANDIDATE" : "candidate_saved";
  return resolution.missing.join("|") || "product_not_registered";
}

function singleStatusLinkResolution(finalMyfansUrl: string, observedLinkCount: number) {
  if (finalMyfansUrl) return "mfco_resolved";
  return observedLinkCount > 0 ? "unresolved" : "no_link";
}

function singleStatusVisualStatus(quoteVisualReady: boolean, mediaType: string | null | undefined) {
  if (quoteVisualReady) return "verified";
  return mediaType === "none" ? "unavailable" : "metadata_only";
}

async function recordSingleStatusSuccessAudit(audit: SingleStatusAudit, metadata: Record<string, unknown>, sourceStatusUrl: string) {
  try {
    await audit(metadata, sourceStatusUrl);
    return null;
  } catch (error) {
    console.error("single_status_collect success audit failed", error);
    return `success audit: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function singleStatusResultResponse(metadata: Record<string, unknown>, partialFailures: string[], isExistingCandidate: boolean) {
  if (partialFailures.length > 0) {
    return NextResponse.json({ importedType: "single_status_quote_candidate", ...metadata, status: "partial", partialFailure: true, failures: partialFailures }, { status: 200 });
  }
  return NextResponse.json({
    importedType: "single_status_quote_candidate",
    ...metadata,
    status: isExistingCandidate ? "no_new_candidate" : "done",
    resultCode: isExistingCandidate ? "NO_NEW_CANDIDATE" : "NEW_CANDIDATE",
  });
}
