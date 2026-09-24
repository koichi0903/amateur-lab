import type { MyfansProduct } from "@/lib/myfansAnalytics";

export type MyfansResolutionConfidence = "exact" | "strong" | "unresolved";
export type MyfansResolutionMethod = "exact_product_url" | "safe_redirect_product_url" | "myfans_url_resolved_product_not_registered" | "mfco_link_observed" | "db_existing" | "unresolved";
export type MyfansEvidenceSource = "author_post" | "author_reply" | "db_existing";

export type MyfansPostProductLinkageEvidence = {
  id?: number;
  approved_media_id?: number | null;
  quote_candidate_id?: number | null;
  source_status_url: string;
  source_author_handle: string;
  discovered_myfans_url: string;
  final_myfans_url?: string | null;
  product_id: number | null;
  resolution_method: MyfansResolutionMethod;
  confidence: MyfansResolutionConfidence;
  evidence_source: MyfansEvidenceSource;
  verified_at: string;
  metadata?: Record<string, unknown> | null;
  diagnostic_mode?: boolean;
  diagnostic_run_id?: string | null;
};

function normalizeUrl(value: string | null | undefined) {
  try {
    const url = new URL(String(value ?? "").trim());
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function normalizeMyfansPostUrl(value: string | null | undefined) {
  const raw = normalizeUrl(value);
  const match = raw.match(/^https:\/\/(?:www\.)?myfans\.jp\/posts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  return match ? `https://myfans.jp/posts/${match[1].toLowerCase()}` : "";
}

export function normalizeXHandle(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

export function extractMyfansUrls(text: string | null | undefined) {
  const source = String(text ?? "");
  const matches = source.match(/https?:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\/[^\s"'<>）)]+/gi) ?? [];
  return Array.from(new Set(matches.map((url) => url.replace(/[.,。、]+$/, ""))));
}

export function resolveMyfansUrlToProduct(url: string, products: MyfansProduct[]) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return products.find((product) => {
    const productUrl = normalizeUrl(product.product_url);
    const affiliateUrl = normalizeUrl(product.affiliate_url);
    return Boolean(productUrl && productUrl === normalized) || Boolean(affiliateUrl && affiliateUrl === normalized);
  }) ?? null;
}

export function resolveExactMyfansProductByFinalUrl(finalUrl: string, products: MyfansProduct[], creatorId?: number | null) {
  const canonicalUrl = normalizeMyfansPostUrl(finalUrl);
  if (!canonicalUrl) return { product: null, status: "invalid" as const, canonicalUrl: "" };
  const matches = products.filter((product) => {
    if (creatorId != null && product.creator_id !== creatorId) return false;
    return normalizeMyfansPostUrl(product.product_url) === canonicalUrl;
  });
  if (matches.length === 1) return { product: matches[0], status: "exact" as const, canonicalUrl };
  return { product: null, status: matches.length > 1 ? "ambiguous" as const : "not_registered" as const, canonicalUrl };
}

export function buildDbExistingEvidence(input: {
  sourceStatusUrl: string;
  sourceAuthorHandle: string;
  product: MyfansProduct;
  verifiedAt?: string;
  approvedMediaId?: number | null;
  quoteCandidateId?: number | null;
}): MyfansPostProductLinkageEvidence {
  return {
    approved_media_id: input.approvedMediaId ?? input.product.approved_media_id ?? null,
    quote_candidate_id: input.quoteCandidateId ?? null,
    source_status_url: input.sourceStatusUrl,
    source_author_handle: normalizeXHandle(input.sourceAuthorHandle),
    discovered_myfans_url: input.product.product_url || input.product.affiliate_url || "",
    final_myfans_url: input.product.product_url || null,
    product_id: input.product.id,
    resolution_method: "db_existing",
    confidence: "exact",
    evidence_source: "db_existing",
    verified_at: input.verifiedAt ?? new Date().toISOString(),
    metadata: { reason: "existing quote/product linkage" },
  };
}

export function resolveTextEvidence(input: {
  sourceStatusUrl: string;
  sourceAuthorHandle: string;
  text: string;
  products: MyfansProduct[];
  evidenceSource: MyfansEvidenceSource;
  verifiedAt?: string;
  approvedMediaId?: number | null;
  quoteCandidateId?: number | null;
}): MyfansPostProductLinkageEvidence | null {
  const discovered = extractMyfansUrls(input.text)[0] ?? "";
  if (!discovered) return null;
  const product = resolveMyfansUrlToProduct(discovered, input.products);
  const isMfco = /^https?:\/\/(?:www\.)?mfco\.link\//i.test(discovered);
  return {
    approved_media_id: input.approvedMediaId ?? product?.approved_media_id ?? null,
    quote_candidate_id: input.quoteCandidateId ?? null,
    source_status_url: input.sourceStatusUrl,
    source_author_handle: normalizeXHandle(input.sourceAuthorHandle),
    discovered_myfans_url: product?.product_url ?? discovered,
    final_myfans_url: product?.product_url ?? null,
    product_id: product?.id ?? null,
    resolution_method: product ? "exact_product_url" : isMfco ? "mfco_link_observed" : "unresolved",
    confidence: product ? "exact" : isMfco ? "strong" : "unresolved",
    evidence_source: input.evidenceSource,
    verified_at: input.verifiedAt ?? new Date().toISOString(),
    metadata: { extracted_from_text: true },
  };
}

export function bestResolverEvidence(rows: Array<MyfansPostProductLinkageEvidence | null | undefined>) {
  const valid = rows.filter((row): row is MyfansPostProductLinkageEvidence => Boolean(row));
  return valid.sort((a, b) => {
    const rank = { exact: 3, strong: 2, unresolved: 1 };
    return rank[b.confidence] - rank[a.confidence] || String(b.verified_at).localeCompare(String(a.verified_at));
  })[0] ?? null;
}
