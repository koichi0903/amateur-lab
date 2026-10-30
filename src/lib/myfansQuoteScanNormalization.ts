import { cleanMyfansUrl, cleanText, cleanValidationStatus, cleanXMediaPermalink, cleanXStatusUrl } from "@/lib/myfansCompanionInput";
import { extractMyfansSourceText } from "@/lib/myfansSourceText";
import type { MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";

export function buildQuoteScanCollectionEvidence(payload: QuoteScanPayload) {
  return {
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
}

export function normalizeQuoteScanCandidates(candidates: MyfansQuoteScanCandidate[], sourceXHandle: string) {
  return candidates
    .slice(0, 20)
    .map(normalizeQuoteScanCandidate)
    .filter((candidate) => candidateBelongsToSource(candidate, sourceXHandle));
}

function normalizeQuoteScanCandidate(candidate: MyfansQuoteScanCandidate) {
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
    mediaType: mediaType === "image" || mediaType === "video" ? mediaType : "none",
    mediaCount: Math.max(0, Math.round(Number(candidate.mediaCount ?? 0) || 0)),
    sourceXHandle: cleanText(candidate.sourceXHandle).replace(/^@/, ""),
    text: extractMyfansSourceText(candidate.text, candidate.articleText),
    myfansUrls: Array.isArray(candidate.myfansUrls) ? candidate.myfansUrls.map(cleanMyfansUrl).filter(Boolean).slice(0, 5) : [],
  } as MyfansQuoteScanCandidate;
}

function candidateBelongsToSource(candidate: MyfansQuoteScanCandidate, sourceXHandle: string) {
  const statusHandle = candidate.xPostUrl.match(/^https:\/\/x\.com\/([^/?#]+)\/status\//i)?.[1] ?? "";
  return Boolean(candidate.xPostUrl)
    && candidate.sourceXHandle.toLowerCase() === sourceXHandle.toLowerCase()
    && statusHandle.toLowerCase() === sourceXHandle.toLowerCase();
}
