import { createHash } from "node:crypto";
import { cleanDiagnosticStatusUrl, cleanText, cleanXStatusUrl } from "@/lib/myfans/myfansCompanionInput";
import type { MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import type { QuoteScanPayload } from "@/lib/myfans/myfansQuoteScanTypes";
import type { MyfansPostProductLinkageEvidence } from "@/lib/myfansProductResolver";

export type DiagnosticStatusReply = MyfansQuoteScanCandidate & {
  authorHandle?: unknown;
  observedMfcoLink?: unknown;
};

export function prepareDiagnosticStatusScan(payload: QuoteScanPayload, now = Date.now()) {
  const sourceStatusUrl = cleanDiagnosticStatusUrl(payload.sourceStatusUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const sourceHandleFromStatus = sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "";
  const runId = cleanText(payload.diagnosticRunId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80)
    || createHash("sha256").update(`${sourceStatusUrl}|${now}`).digest("hex").slice(0, 16);
  const isValid = Boolean(sourceStatusUrl && sourceXHandle)
    && sourceHandleFromStatus.toLowerCase() === sourceXHandle.toLowerCase();
  return { sourceStatusUrl, sourceXHandle, runId, isValid };
}

export function selectDiagnosticStatusReplies(
  rawCandidates: unknown,
  sourceStatusUrl: string,
  sourceXHandle: string,
): DiagnosticStatusReply[] {
  const candidates = Array.isArray(rawCandidates) ? rawCandidates as DiagnosticStatusReply[] : [];
  return candidates
    .slice(0, 40)
    .filter((candidate) => Boolean(candidate.isReply)
      && cleanText(candidate.authorHandle).replace(/^@/, "").toLowerCase() === sourceXHandle.toLowerCase())
    .map((candidate) => ({ ...candidate, xPostUrl: cleanXStatusUrl(candidate.xPostUrl) }))
    .filter((candidate) => candidate.xPostUrl && candidate.xPostUrl !== sourceStatusUrl);
}

export function applyObservedMfcoLink(evidence: MyfansPostProductLinkageEvidence, observed: boolean) {
  if (observed && evidence.confidence === "unresolved") {
    evidence.confidence = "strong";
    evidence.resolution_method = "mfco_link_observed";
    evidence.product_id = null;
    evidence.final_myfans_url = null;
    evidence.metadata = { ...(evidence.metadata ?? {}), observed_mfco_link: true, product_resolution: "not_unique" };
  }
  return evidence;
}

export function shouldIgnoreDiagnosticLookupError(message: string) {
  return /diagnostic_mode|schema cache|does not exist/i.test(message);
}

export function shouldIgnoreDiagnosticUpsertError(message: string) {
  return /schema cache|does not exist/i.test(message);
}

export function isExistingNonDiagnosticEvidence(existing: { diagnostic_mode?: boolean | null } | null) {
  return Boolean(existing && existing.diagnostic_mode !== true);
}

export function summarizeDiagnosticStatusReplies(candidates: DiagnosticStatusReply[]) {
  return candidates.map((candidate) => ({
    statusUrl: candidate.xPostUrl,
    authorHandle: cleanText(candidate.authorHandle),
    isReply: Boolean(candidate.isReply),
    myfansUrls: candidate.myfansUrls ?? [],
  }));
}

export function countDiagnosticReplyMyfansLinks(candidates: DiagnosticStatusReply[]) {
  return candidates.reduce((count, candidate) => count + (candidate.myfansUrls?.length ?? 0), 0);
}
