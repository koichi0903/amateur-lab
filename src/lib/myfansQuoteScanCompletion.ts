import { NextResponse } from "next/server";
import type { MyfansQuoteScanCandidate, MyfansQuoteScore } from "@/lib/myfansQuoteScoring";
import type { QuoteScanPayload, QuoteScanProduct } from "@/lib/myfansQuoteScanTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ExactProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

type RankedQuoteCandidate = {
  candidate: MyfansQuoteScanCandidate;
  result: MyfansQuoteScore;
  creatorRank: number;
};

type CollectionCompletionInput = {
  approvedMediaId: number | null;
  approvedProduct: QuoteScanProduct | null;
  best: RankedQuoteCandidate | null;
  bestProductResolution: ExactProductResolution;
  collectionEvidence: Record<string, unknown>;
  collectorMethod: string;
  creatorId: number;
  markRefreshItem: (payload: QuoteScanPayload, status: "success", detail: { collectedCount: number; topScore: number | null; evidence: Record<string, unknown> }) => Promise<void>;
  payload: QuoteScanPayload;
  sourceTextMissingCount: number;
  totalCandidateCount: number;
  updateGlobalQuoteRanks: (approvedMediaId: number | null) => Promise<void>;
};

export async function completeQuoteScanCollection(input: CollectionCompletionInput) {
  await autoSelectBestQuote(input);
  await input.updateGlobalQuoteRanks(input.approvedMediaId ?? input.approvedProduct?.approved_media_id ?? null);
  await recordCompleteThreadStatuses(input);
  await input.markRefreshItem(input.payload, "success", {
    collectedCount: input.totalCandidateCount,
    topScore: input.best?.result.score ?? null,
    evidence: { ...input.collectionEvidence, completeThreadsFound: input.totalCandidateCount, candidatesSaved: input.totalCandidateCount },
  });
  return NextResponse.json({
    ok: true,
    importedType: "quote_candidates",
    candidatesCount: input.totalCandidateCount,
    sourceTextMissingCount: input.sourceTextMissingCount,
    collectionStatuses: input.payload.collectionStatuses ?? [],
    selected: selectedQuoteSummary(input.best),
  });
}

async function autoSelectBestQuote(input: CollectionCompletionInput) {
  const { best, bestProductResolution, creatorId } = input;
  const product = bestProductResolution.product;
  if (!best || !product?.id) return;
  const quoteUrl = best.candidate.mediaPermalink || best.candidate.xPostUrl;
  const { error } = await supabaseAdmin
    .from("myfans_products")
    .update({ quote_candidate_x_url: quoteUrl, updated_at: new Date().toISOString() })
    .eq("id", product.id);
  if (error) throw error;
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "creator",
    entity_id: creatorId,
    action: "quote_candidate_auto_select",
    summary: product.title as string,
    metadata: quoteSelectionAuditMetadata(best, quoteUrl),
  });
}

function quoteSelectionAuditMetadata(best: RankedQuoteCandidate, quoteUrl: string) {
  return {
    quoteUrl,
    statusUrl: best.candidate.xPostUrl,
    mediaPermalink: best.candidate.mediaPermalink || null,
    mediaType: best.candidate.mediaType || "none",
    quoteVisualReady: Boolean(best.candidate.quoteVisualReady),
    validationStatus: best.candidate.validationStatus || null,
    score: best.result.score,
    creatorRank: best.creatorRank,
    reason: best.result.reason,
  };
}

async function recordCompleteThreadStatuses(input: CollectionCompletionInput) {
  const statuses = input.payload.collectionStatuses;
  if (!Array.isArray(statuses) || statuses.length === 0) return;
  const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "creator",
    entity_id: input.creatorId,
    action: "complete_thread_collection_status",
    summary: `${input.collectorMethod}: ${statuses.length} parent statuses`,
    metadata: { collectorMethod: input.collectorMethod, statuses, ...input.collectionEvidence },
  });
  if (error) console.error("complete thread status audit failed", error);
}

function selectedQuoteSummary(best: RankedQuoteCandidate | null) {
  if (!best) return null;
  const candidate = best.candidate;
  return {
    xPostUrl: candidate.xPostUrl,
    mediaPermalink: candidate.mediaPermalink || null,
    mediaType: candidate.mediaType || "none",
    quoteVisualReady: Boolean(candidate.quoteVisualReady),
    validationStatus: candidate.validationStatus || null,
    score: best.result.score,
    creatorRank: best.creatorRank,
    reason: best.result.reason,
  };
}
