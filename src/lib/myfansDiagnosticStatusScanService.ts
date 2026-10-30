import "server-only";

import { NextResponse } from "next/server";
import { fetchResolverProducts } from "@/lib/myfansCompanionImportService";
import { resolveTextEvidence } from "@/lib/myfansProductResolver";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  applyObservedMfcoLink,
  countDiagnosticReplyMyfansLinks,
  isExistingNonDiagnosticEvidence,
  prepareDiagnosticStatusScan,
  selectDiagnosticStatusReplies,
  shouldIgnoreDiagnosticLookupError,
  shouldIgnoreDiagnosticUpsertError,
  summarizeDiagnosticStatusReplies,
  type DiagnosticStatusReply,
} from "@/lib/myfansDiagnosticStatusScanRules";
import type { MyfansPostProductLinkageEvidence } from "@/lib/myfansProductResolver";

async function persistDiagnosticReplyEvidence(
  evidence: MyfansPostProductLinkageEvidence,
  runId: string,
  sourceStatusUrl: string,
  sourceXHandle: string,
) {
  const { data: existingEvidence, error: existingError } = await supabaseAdmin
    .from("myfans_post_product_linkage_evidence")
    .select("id,diagnostic_mode")
    .eq("source_status_url", evidence.source_status_url)
    .eq("discovered_myfans_url", evidence.discovered_myfans_url)
    .eq("evidence_source", "author_reply")
    .maybeSingle();
  if (existingError && !shouldIgnoreDiagnosticLookupError(existingError.message)) throw existingError;
  if (isExistingNonDiagnosticEvidence(existingEvidence)) return null;

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
    metadata: {
      ...(evidence.metadata ?? {}),
      diagnostic: true,
      diagnostic_run_id: runId,
      diagnostic_source_status_url: sourceStatusUrl,
      reply_author_handle: sourceXHandle,
    },
    diagnostic_mode: true,
    diagnostic_run_id: runId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_status_url,discovered_myfans_url,evidence_source" });
  if (error && !shouldIgnoreDiagnosticUpsertError(error.message)) throw error;
  if (error) return null;

  return {
    sourceStatusUrl: evidence.source_status_url,
    discoveredMyfansUrl: evidence.discovered_myfans_url,
    finalMyfansUrl: evidence.final_myfans_url,
    confidence: evidence.confidence,
    method: evidence.resolution_method,
    productId: evidence.product_id,
    evidenceSource: "author_reply",
    diagnosticMode: true,
    diagnosticRunId: runId,
  };
}

export async function saveDiagnosticStatusScan(
  payload: QuoteScanPayload,
  approvedMediaId: number | null,
) {
  const scan = prepareDiagnosticStatusScan(payload);
  if (!scan.isValid) {
    return NextResponse.json({ error: "診断対象はx.comの正規status URLで、source handleと一致する必要があります。" }, { status: 400 });
  }
  const products = await fetchResolverProducts();
  const candidates = selectDiagnosticStatusReplies(payload.quoteCandidates, scan.sourceStatusUrl, scan.sourceXHandle);
  let saved = 0;
  const savedEvidence: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const evidenceText = [candidate.text, ...(candidate.myfansUrls ?? [])].filter(Boolean).join(" ");
    const evidence = resolveTextEvidence({ sourceStatusUrl: candidate.xPostUrl, sourceAuthorHandle: scan.sourceXHandle, text: evidenceText, products, evidenceSource: "author_reply", approvedMediaId });
    if (!evidence) continue;
    applyObservedMfcoLink(evidence, Boolean((candidate as DiagnosticStatusReply).observedMfcoLink));
    const savedRow = await persistDiagnosticReplyEvidence(evidence, scan.runId, scan.sourceStatusUrl, scan.sourceXHandle);
    if (!savedRow) continue;
    saved += 1;
    savedEvidence.push(savedRow);
  }
  return NextResponse.json({
    ok: true,
    importedType: "diagnostic_status",
    diagnostic: true,
    diagnosticRunId: scan.runId,
    sourceStatusUrl: scan.sourceStatusUrl,
    sourceXHandle: scan.sourceXHandle,
    replyCount: candidates.length,
    replyStatuses: summarizeDiagnosticStatusReplies(candidates),
    evidenceSaved: saved,
    savedEvidence,
    myfansLinkCount: countDiagnosticReplyMyfansLinks(candidates),
  });
}
