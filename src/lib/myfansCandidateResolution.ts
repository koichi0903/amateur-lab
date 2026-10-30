import type { MyfansAnalytics, MyfansDailyFunnelProduct, MyfansProduct, MyfansQuoteCandidate } from "./myfansAnalytics";
import { bestResolverEvidence, buildDbExistingEvidence, resolveTextEvidence } from "./myfansProductResolver";
import { normalizeSourceUrl, sourceAuthorHandleFromQuote, sourceAuthorLabelFromQuote } from "./myfansQuotePool";
import { stringField } from "./myfansCreativeEvidence";
import type { MyfansCandidateType, MyfansMonetizableStatus } from "./myfansGrowthStrategy";
import type { DailyRole } from "./myfansTopicValue";

export function creatorMyfansUrl(product: MyfansProduct | MyfansDailyFunnelProduct | null | undefined) {
  const relation = product?.myfans_creators as { myfans_url?: unknown } | null | undefined;
  return stringField(relation?.myfans_url);
}

export function quoteMatchesProduct(quote: MyfansQuoteCandidate | null | undefined, product: MyfansProduct | null | undefined) {
  if (!quote || !product) return false;
  if (quote.product_id && quote.product_id === product.id) return true;
  const quoteHandle = (quote.source_x_handle || quote.creator_x_url || "").replace(/^@/, "").toLowerCase();
  const productHandle = (product.creator_x_url || "").replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "").split(/[/?#]/)[0]?.replace(/^@/, "").toLowerCase();
  return Boolean(quoteHandle && productHandle && quoteHandle === productHandle);
}

function resolvedMyfansTarget(product: MyfansProduct | null | undefined, quote: MyfansQuoteCandidate | null | undefined) {
  if (!product) return { type: "none", url: "", affiliateUrl: "", canConnectAffiliate: false } as const;
  const canConnectAffiliate = !quote || quoteMatchesProduct(quote, product);
  const url = canConnectAffiliate ? product.product_url || creatorMyfansUrl(product) : "";
  return {
    type: url ? (product.product_url ? "product" : "creator") : "none",
    url,
    affiliateUrl: canConnectAffiliate ? product.affiliate_url || "" : "",
    canConnectAffiliate,
  } as const;
}

function monetizableStatusFor(product: MyfansProduct | null | undefined, canConnectAffiliate: boolean): MyfansMonetizableStatus {
  if (!product || !canConnectAffiliate) return "unlinked";
  return product.affiliate_url ? "linked_affiliate_ready" : "linked_no_affiliate";
}

function candidateTypeFor(role: DailyRole, quote: MyfansQuoteCandidate | null | undefined, status: MyfansMonetizableStatus, exactResolution = false): MyfansCandidateType {
  if (role === "REVENUE") return "Revenue";
  if ((quote && status !== "unlinked") || exactResolution) return "Monetizable Growth";
  return "Growth";
}

type CandidateResolutionInput = {
  analytics: MyfansAnalytics;
  product: MyfansProduct | null;
  productionLinkageEvidence: MyfansAnalytics["productLinkageEvidence"];
  quote: MyfansQuoteCandidate | null;
  dailyRole: DailyRole;
};

function approvedMediaIdFor(analytics: MyfansAnalytics, quote: MyfansQuoteCandidate) {
  return analytics.selectedMediaId === 5 ? 5 : quote.approved_media_id ?? analytics.selectedMediaId ?? null;
}

function storedEvidenceFor(quote: MyfansQuoteCandidate | null, rows: MyfansAnalytics["productLinkageEvidence"]) {
  if (!quote) return null;
  return rows.find((row) => normalizeSourceUrl(row.source_status_url) === normalizeSourceUrl(quote.x_post_url));
}

function textEvidenceFor(analytics: MyfansAnalytics, quote: MyfansQuoteCandidate | null) {
  if (!quote) return null;
  return resolveTextEvidence({
    sourceStatusUrl: quote.x_post_url,
    sourceAuthorHandle: sourceAuthorHandleFromQuote(quote),
    text: quote.text_excerpt,
    products: analytics.products,
    evidenceSource: quote.is_reply ? "author_reply" : "author_post",
    approvedMediaId: approvedMediaIdFor(analytics, quote),
    quoteCandidateId: quote.id,
  });
}

function dbExistingEvidenceFor(analytics: MyfansAnalytics, quote: MyfansQuoteCandidate | null, product: MyfansProduct | null) {
  if (!quote || !product || !quoteMatchesProduct(quote, product)) return null;
  return buildDbExistingEvidence({
    sourceStatusUrl: quote.x_post_url,
    sourceAuthorHandle: sourceAuthorHandleFromQuote(quote),
    product,
    approvedMediaId: approvedMediaIdFor(analytics, quote),
    quoteCandidateId: quote.id,
  });
}

function resolverEvidenceFor(input: CandidateResolutionInput) {
  const { analytics, product, productionLinkageEvidence, quote } = input;
  return bestResolverEvidence([
    storedEvidenceFor(quote, productionLinkageEvidence),
    textEvidenceFor(analytics, quote),
    dbExistingEvidenceFor(analytics, quote, product),
  ]);
}

function resolvedProductFor(input: CandidateResolutionInput, resolverEvidence: ReturnType<typeof resolverEvidenceFor>) {
  if (resolverEvidence?.confidence !== "exact" || !resolverEvidence.product_id) return input.product;
  return input.analytics.products.find((item) => item.id === resolverEvidence.product_id) ?? input.product;
}

function candidateTitleFor(
  quote: MyfansQuoteCandidate | null,
  canConnectProduct: boolean,
  sourceAuthorLabel: string,
  resolvedProduct: MyfansProduct | null,
) {
  if (quote && !canConnectProduct) {
    const mediaLabel = quote.media_type === "image" ? "画像" : quote.media_type === "video" ? "動画" : "X投稿";
    return `${sourceAuthorLabel} の${mediaLabel}`;
  }
  return resolvedProduct?.title ?? `${sourceAuthorLabel} のX投稿`;
}

export function resolveMyfansCandidateProduct(input: CandidateResolutionInput) {
  const { quote, dailyRole } = input;
  const resolverEvidence = resolverEvidenceFor(input);
  const resolvedProduct = resolvedProductFor(input, resolverEvidence);
  const myfansTarget = resolvedMyfansTarget(resolvedProduct, quote);
  const resolverCanConnectProduct = Boolean(resolverEvidence?.confidence === "exact" && resolverEvidence.product_id);
  const canConnectProduct = myfansTarget.canConnectAffiliate || resolverCanConnectProduct;
  const monetizableStatus = monetizableStatusFor(resolvedProduct, canConnectProduct);
  const candidateProduct = canConnectProduct ? resolvedProduct : null;
  const candidateType = candidateTypeFor(dailyRole, quote, monetizableStatus, resolverCanConnectProduct);
  const sourceAuthorHandle = sourceAuthorHandleFromQuote(quote);
  const sourceAuthorLabel = sourceAuthorLabelFromQuote(quote);
  const myfansCreatorName = canConnectProduct ? resolvedProduct?.myfans_creators?.display_name ?? "" : "";
  const candidateTitle = candidateTitleFor(quote, canConnectProduct, sourceAuthorLabel, resolvedProduct);

  return {
    resolverEvidence,
    resolvedProduct,
    myfansTarget,
    resolverCanConnectProduct,
    canConnectProduct,
    monetizableStatus,
    candidateProduct,
    candidateType,
    sourceAuthorHandle,
    sourceAuthorLabel,
    myfansCreatorName,
    candidateTitle,
  };
}

export function isRevenueTargetProduct(product: MyfansProduct) {
  return Boolean(product.product_url || creatorMyfansUrl(product)) && (product.reward_rate > 0 || product.estimated_reward > 0 || product.plan_signup_reward > 0 || product.price > 0);
}
