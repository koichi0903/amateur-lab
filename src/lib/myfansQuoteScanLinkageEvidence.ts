import { cleanMyfansUrl, cleanText } from "@/lib/myfansCompanionInput";
import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { normalizeMyfansPostUrl, resolveTextEvidence, type MyfansEvidenceSource, type MyfansPostProductLinkageEvidence, type MyfansResolutionMethod } from "@/lib/myfansProductResolver";
import type { MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import type { QuoteScanProduct } from "@/lib/myfansQuoteScanTypes";

export type ExactProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

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

type ExactProductLinkageEvidenceInput = Omit<QuoteCandidateLinkageEvidenceInput, "approvedProduct" | "resolverProducts"> & {
  discoveredUrl: string;
};

export function buildQuoteCandidateLinkageEvidence(input: QuoteCandidateLinkageEvidenceInput): MyfansPostProductLinkageEvidence | null {
  if (input.finalMyfansUrl) return exactUrlLinkageEvidence(input);
  return textLinkageEvidence(input);
}

function exactUrlLinkageEvidence(input: QuoteCandidateLinkageEvidenceInput): MyfansPostProductLinkageEvidence | null {
  if (input.itemProductResolution.status !== "exact") return null;
  const resolver = resolverEvidenceForUrl(input.resolverEvidence, input.finalMyfansUrl);
  const discoveredUrl = discoveredUrlForResolver(resolver, input.finalMyfansUrl);
  return exactProductLinkageEvidence({ ...input, discoveredUrl });
}

function resolverEvidenceForUrl(resolverEvidence: unknown[], finalMyfansUrl: string) {
  return resolverEvidence.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const entryUrl = (entry as Record<string, unknown>).finalMyfansUrl;
    return normalizeMyfansPostUrl(cleanMyfansUrl(entryUrl)) === finalMyfansUrl;
  }) ?? {};
}

function discoveredUrlForResolver(resolver: unknown, finalMyfansUrl: string) {
  const resolverRecord = resolver as Record<string, unknown>;
  const rawUrl = cleanText(resolverRecord.observedMfcoUrl || resolverRecord.sourceUrl || finalMyfansUrl).replace(/[?#].*$/, "");
  return isAllowedDiscoveredUrl(rawUrl) ? rawUrl : finalMyfansUrl;
}

function isAllowedDiscoveredUrl(url: string) {
  return /^(?:https:\/\/(?:www\.)?(?:mfco\.link|t\.co|myfans\.jp)\/)/i.test(url);
}

function textLinkageEvidence(input: QuoteCandidateLinkageEvidenceInput) {
  const { approvedMediaId, approvedProduct, candidate, resolverProducts, sourceXHandle } = input;
  const evidenceText = [candidate.text, ...(candidate.myfansUrls ?? [])].filter(Boolean).join(" ");
  return resolveTextEvidence({
    sourceStatusUrl: candidate.ownReplyStatusUrl || candidate.xPostUrl,
    sourceAuthorHandle: sourceXHandle,
    text: evidenceText,
    products: resolverProducts,
    evidenceSource: candidate.myfansLinkSource === "own_reply" ? "author_reply" : "author_post",
    approvedMediaId: approvedMediaId ?? (approvedProduct?.approved_media_id as number | null | undefined) ?? null,
  });
}

function exactProductLinkageEvidence(input: ExactProductLinkageEvidenceInput): MyfansPostProductLinkageEvidence {
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
