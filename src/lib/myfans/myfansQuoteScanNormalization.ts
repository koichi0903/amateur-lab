import { cleanMyfansUrl, cleanText, cleanValidationStatus, cleanXMediaPermalink, cleanXStatusUrl } from "@/lib/myfans/myfansCompanionInput";
import { extractMyfansSourceText } from "@/lib/myfansSourceText";
import type { MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import type { QuoteScanPayload } from "@/lib/myfans/myfansQuoteScanTypes";

export function buildQuoteScanCollectionEvidence(payload: QuoteScanPayload) {
  return {
    job_id: Number(payload.refreshJobId) || null,
    collection_session_id: cleanText(payload.collectionSessionId) || null,
    run_token: cleanText(payload.runToken) || null,
    collector_version: cleanText(payload.collectorVersion) || null,
    stateTransitions: takeLastArrayEntries(payload.stateTransitions, 80),
    profileCounts: recordOrEmpty(payload.profileCounts),
    profileScan: recordOrEmpty(payload.profileScan),
    statusCounts: recordOrEmpty(payload.statusCounts),
    collectionStatuses: arrayOrEmpty(payload.collectionStatuses),
    final_collection_state: null,
    final_error: null,
  };
}

function takeLastArrayEntries<T>(value: T[] | undefined, limit: number) {
  return Array.isArray(value) ? value.slice(-limit) : [];
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function arrayOrEmpty<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

export function normalizeQuoteScanCandidates(candidates: MyfansQuoteScanCandidate[], sourceXHandle: string) {
  return candidates
    .slice(0, 20)
    .map(normalizeQuoteScanCandidate)
    .filter((candidate) => candidateBelongsToSource(candidate, sourceXHandle));
}

function normalizeQuoteScanCandidate(candidate: MyfansQuoteScanCandidate) {
  return {
    ...candidate,
    xPostUrl: cleanXStatusUrl(candidate.xPostUrl),
    parentStatusUrl: cleanXStatusUrl(candidate.parentStatusUrl || candidate.xPostUrl),
    parentStatusId: cleanText(candidate.parentStatusId) || null,
    ownReplyStatusUrl: cleanXStatusUrl(candidate.ownReplyStatusUrl),
    ownReplyStatusId: cleanText(candidate.ownReplyStatusId) || null,
    myfansLinkSource: normalizeMyfansLinkSource(candidate.myfansLinkSource),
    threadCollectionStatus: cleanText(candidate.threadCollectionStatus) || "LEGACY",
    collectorMethod: cleanText(candidate.collectorMethod) || "legacy_profile_scan",
    resolvedProductEvidence: normalizeResolvedProductEvidence(candidate.resolvedProductEvidence),
    mediaPermalink: cleanXMediaPermalink(candidate.mediaPermalink),
    verifiedVideoPermalink: cleanXMediaPermalink(candidate.verifiedVideoPermalink),
    generatedVideoPermalink: cleanXMediaPermalink(candidate.generatedVideoPermalink),
    validationStatus: cleanValidationStatus(candidate.validationStatus),
    mediaType: normalizeMediaType(candidate.mediaType),
    mediaCount: normalizeMediaCount(candidate.mediaCount),
    sourceXHandle: cleanText(candidate.sourceXHandle).replace(/^@/, ""),
    text: extractMyfansSourceText(candidate.text, candidate.articleText),
    myfansUrls: normalizeMyfansUrls(candidate.myfansUrls),
  } as MyfansQuoteScanCandidate;
}

function normalizeMyfansLinkSource(value: unknown): MyfansQuoteScanCandidate["myfansLinkSource"] {
  if (value === "own_reply") return "own_reply";
  return value === "parent" ? "parent" : null;
}

function normalizeResolvedProductEvidence(value: unknown): MyfansQuoteScanCandidate["resolvedProductEvidence"] {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function normalizeMediaType(value: unknown): NonNullable<MyfansQuoteScanCandidate["mediaType"]> {
  const mediaType = cleanText(value);
  if (mediaType === "image" || mediaType === "video") return mediaType;
  return "none";
}

function normalizeMediaCount(value: unknown) {
  return Math.max(0, Math.round(Number(value ?? 0) || 0));
}

function normalizeMyfansUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanMyfansUrl).filter(Boolean).slice(0, 5);
}

function candidateBelongsToSource(candidate: MyfansQuoteScanCandidate, sourceXHandle: string) {
  const statusHandle = candidate.xPostUrl.match(/^https:\/\/x\.com\/([^/?#]+)\/status\//i)?.[1] ?? "";
  return Boolean(candidate.xPostUrl)
    && candidate.sourceXHandle.toLowerCase() === sourceXHandle.toLowerCase()
    && statusHandle.toLowerCase() === sourceXHandle.toLowerCase();
}
