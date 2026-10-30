import { cleanMyfansUrl, cleanText } from "@/lib/myfansCompanionInput";
import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { normalizeMyfansPostUrl, resolveTextEvidence, type MyfansEvidenceSource, type MyfansPostProductLinkageEvidence, type MyfansResolutionMethod } from "@/lib/myfansProductResolver";
import type { MyfansQuoteScanCandidate, MyfansQuoteScore } from "@/lib/myfansQuoteScoring";
import type { QuoteScanProduct } from "@/lib/myfansQuoteScanTypes";
import { buildQuoteScanCandidateRecord } from "@/lib/myfansQuoteScanRecord";
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

type PersistRankedQuoteCandidatesInput = {
  approvedMediaId: number | null;
  approvedProduct: QuoteScanProduct | null;
  creatorId: number;
  creatorXUrl: string;
  ranked: RankedQuoteCandidate[];
  best: RankedQuoteCandidate | null;
  resolverProducts: MyfansProduct[];
  resolveBatchProduct: (finalMyfansUrl: string) => Promise<ExactProductResolution>;
  saveQuoteCandidate: (record: Record<string, unknown>, creatorId: number) => Promise<number | null>;
  sourceXHandle: string;
};

export async function persistRankedQuoteScanCandidates(input: PersistRankedQuoteCandidatesInput) {
  for (const item of input.ranked) {
    await persistRankedQuoteScanCandidate(input, item);
  }
}

async function persistRankedQuoteScanCandidate(input: PersistRankedQuoteCandidatesInput, item: RankedQuoteCandidate) {
  const finalMyfansUrl = firstFinalMyfansUrl(item.candidate);
  const itemProductResolution = await input.resolveBatchProduct(finalMyfansUrl);
  const itemProduct = itemProductResolution.product;
  const itemProductId = itemProduct?.id ? Number(itemProduct.id) : null;
  const resolverEvidence = Array.isArray(item.candidate.resolvedProductEvidence) ? item.candidate.resolvedProductEvidence : [];
  const record = buildQuoteScanCandidateRecord({
    approvedMediaId: input.approvedMediaId,
    approvedProduct: input.approvedProduct,
    candidate: item.candidate,
    creatorId: input.creatorId,
    creatorRank: item.creatorRank,
    creatorXUrl: input.creatorXUrl,
    productId: itemProductId,
    result: item.result,
    selected: input.best?.candidate.xPostUrl === item.candidate.xPostUrl,
    sourceXHandle: input.sourceXHandle,
  });
  const savedCandidateId = await input.saveQuoteCandidate(record, input.creatorId);
  const evidence = buildQuoteCandidateLinkageEvidence({
    approvedMediaId: input.approvedMediaId,
    approvedProduct: input.approvedProduct,
    candidate: item.candidate,
    creatorId: input.creatorId,
    finalMyfansUrl,
    itemProduct,
    itemProductId,
    itemProductResolution,
    resolverEvidence,
    resolverProducts: input.resolverProducts,
    savedCandidateId,
    sourceXHandle: input.sourceXHandle,
  });
  if (evidence) await persistQuoteCandidateLinkageEvidence(evidence, savedCandidateId);
}

export function firstFinalMyfansUrl(candidate: MyfansQuoteScanCandidate) {
  return (Array.isArray(candidate.myfansUrls) ? candidate.myfansUrls : [])
    .map((url) => normalizeMyfansPostUrl(cleanMyfansUrl(url)))
    .find(Boolean) || "";
}

type QuoteCandidateLinkageEvidenceInput = {
  approvedMediaId: number | null;
  approvedProduct: QuoteScanProduct | null;
  candidate: MyfansQuoteScanCandidate;
  creatorId: number;
  finalMyfansUrl: string;
  itemProduct: Record<string, unknown> | null;
  itemProductId: number | null;
  itemProductResolution: ExactProductResolution;
  resolverEvidence: unknown[];
  resolverProducts: MyfansProduct[];
  savedCandidateId: number | null;
  sourceXHandle: string;
};

function buildQuoteCandidateLinkageEvidence(input: QuoteCandidateLinkageEvidenceInput): MyfansPostProductLinkageEvidence | null {
  const { approvedMediaId, approvedProduct, candidate, creatorId, finalMyfansUrl, itemProduct, itemProductId, itemProductResolution, resolverEvidence, resolverProducts, savedCandidateId, sourceXHandle } = input;
  const evidenceText = [candidate.text, ...(candidate.myfansUrls ?? [])].filter(Boolean).join(" ");
  const resolver = resolverEvidence.find((entry) => entry && typeof entry === "object" && normalizeMyfansPostUrl(cleanMyfansUrl((entry as Record<string, unknown>).finalMyfansUrl)) === finalMyfansUrl) || {};
  const rawDiscoveredUrl = cleanText((resolver as Record<string, unknown>).observedMfcoUrl || (resolver as Record<string, unknown>).sourceUrl || finalMyfansUrl).replace(/[?#].*$/, "");
  const discoveredUrl = /^(?:https:\/\/(?:www\.)?(?:mfco\.link|t\.co|myfans\.jp)\/)/i.test(rawDiscoveredUrl) ? rawDiscoveredUrl : finalMyfansUrl;

  if (finalMyfansUrl && itemProductResolution.status === "exact") {
    return exactProductLinkageEvidence({ approvedMediaId, candidate, creatorId, discoveredUrl, finalMyfansUrl, itemProduct, itemProductId, itemProductResolution, resolverEvidence, savedCandidateId, sourceXHandle });
  }
  if (finalMyfansUrl) return null;
  return resolveTextEvidence({
    sourceStatusUrl: candidate.ownReplyStatusUrl || candidate.xPostUrl,
    sourceAuthorHandle: sourceXHandle,
    text: evidenceText,
    products: resolverProducts,
    evidenceSource: candidate.myfansLinkSource === "own_reply" ? "author_reply" : "author_post",
    approvedMediaId: approvedMediaId ?? (approvedProduct?.approved_media_id as number | null | undefined) ?? null,
  });
}

function exactProductLinkageEvidence(input: Omit<QuoteCandidateLinkageEvidenceInput, "approvedProduct" | "finalMyfansUrl" | "resolverProducts"> & { discoveredUrl: string; finalMyfansUrl: string }): MyfansPostProductLinkageEvidence {
  const { approvedMediaId, candidate, creatorId, discoveredUrl, finalMyfansUrl, itemProduct, itemProductId, itemProductResolution, resolverEvidence, savedCandidateId, sourceXHandle } = input;
  const sourceStatusUrl = candidate.ownReplyStatusUrl || candidate.xPostUrl;
  const linkSource: MyfansEvidenceSource = candidate.myfansLinkSource === "own_reply" ? "author_reply" : "author_post";
  const resolutionMethod: MyfansResolutionMethod = itemProductResolution.method === "existing_canonical_url" ? "exact_product_url" : "safe_redirect_product_url";
  return {
    approved_media_id: approvedMediaId ?? (itemProduct?.approved_media_id as number | null | undefined) ?? null,
    quote_candidate_id: savedCandidateId,
    source_status_url: sourceStatusUrl,
    source_author_handle: sourceXHandle,
    discovered_myfans_url: discoveredUrl,
    final_myfans_url: finalMyfansUrl,
    product_id: itemProductId,
    resolution_method: resolutionMethod,
    confidence: "exact",
    evidence_source: linkSource,
    verified_at: new Date().toISOString(),
    metadata: {
      link_source: linkSource === "author_reply" ? "author_reply" : "parent",
      myfans_post_uuid: finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null,
      matched_creator_id: creatorId,
      matched_product_id: itemProductId,
      product_resolution: itemProductResolution.status,
      product_resolution_method: itemProductResolution.method,
      resolver_evidence: resolverEvidence,
    },
  };
}

async function persistQuoteCandidateLinkageEvidence(evidence: MyfansPostProductLinkageEvidence, savedCandidateId: number | null) {
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
  if (!evidenceError && savedCandidateId) await updateCandidateResolvedProductEvidence(evidence, savedCandidateId);
}

async function updateCandidateResolvedProductEvidence(evidence: MyfansPostProductLinkageEvidence, savedCandidateId: number) {
  const { error } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ resolved_product_evidence: {
      productId: evidence.product_id,
      discoveredMyfansUrl: evidence.discovered_myfans_url,
      finalMyfansUrl: evidence.final_myfans_url,
      resolutionMethod: evidence.resolution_method,
      confidence: evidence.confidence,
      evidenceSource: evidence.evidence_source,
    } })
    .eq("id", savedCandidateId);
  if (error && !/resolved_product_evidence|schema cache|does not exist/i.test(error.message)) throw error;
}
