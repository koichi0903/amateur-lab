import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { buildMyfansScoredProductPool, type MyfansScoredProduct } from "@/lib/myfans/myfansCandidateScoring";
import { pickMyfansCandidateProduct } from "@/lib/myfans/myfansCandidateProductSelection";
import {
  buildMyfansQuotePool,
  creatorKeyFromProduct,
  creatorKeyFromQuote,
  hasFreshTopicEvidence,
  normalizeSourceUrl,
  quoteUrlFromCandidate,
  topicIdentityFor,
  topicSemanticKeyFor,
  type MyfansTopicValue,
} from "@/lib/myfans/myfansQuotePool";

type CandidatePoolRole = "ATTENTION" | "DISCOVERY" | "AUTHORITY" | "REVENUE";

type CandidatePoolContextInput<TBaselines> = {
  planDate: string;
  planKey: string;
  topicBaselines: TBaselines;
  quotePool: ReturnType<typeof buildMyfansQuotePool>;
  productionLinkageEvidence: MyfansAnalytics["productLinkageEvidence"];
  evaluateTopicValue: (input: {
    product: MyfansProduct;
    quote: MyfansQuoteCandidate | null;
    role: CandidatePoolRole;
    baselines: TBaselines;
  }) => MyfansTopicValue;
  isValidRevenueProduct: (product: MyfansProduct) => boolean;
  isRevenueTargetProduct: (product: MyfansProduct) => boolean;
  roleForPostType: (postType: string) => CandidatePoolRole;
};

export function buildMyfansCandidatePoolContext<TBaselines>(
  analytics: MyfansAnalytics,
  input: CandidatePoolContextInput<TBaselines>,
) {
  const { planDate, planKey, topicBaselines, quotePool, productionLinkageEvidence } = input;
  const products = buildMyfansScoredProductPool(analytics, planKey);
  const productForQuote = (quote: MyfansQuoteCandidate | null) => {
    if (!quote) return null;
    if (quote.product_id) {
      const direct = products.find((row) => row.product.id === quote.product_id);
      if (direct) return direct;
    }
    const resolverProductId = productionLinkageEvidence.find((evidence) =>
      evidence.confidence === "exact" &&
      evidence.product_id &&
      normalizeSourceUrl(evidence.source_status_url) === normalizeSourceUrl(quote.x_post_url),
    )?.product_id;
    if (resolverProductId) {
      const resolved = products.find((row) => row.product.id === resolverProductId);
      if (resolved) return resolved;
    }
    const quoteCreatorKey = creatorKeyFromQuote(quote);
    return products.find((row) => creatorKeyFromProduct(row.product) === quoteCreatorKey) ?? null;
  };
  const quoteForSource = (source: string) => analytics.quoteCandidates.find((quote) => {
    const normalized = normalizeSourceUrl(source);
    return normalized && (normalizeSourceUrl(quote.x_post_url) === normalized || normalizeSourceUrl(quoteUrlFromCandidate(quote)) === normalized);
  }) ?? null;
  const creatorKeyForCandidateSource = (candidate: { quoteXUrl: string; sourceXUrl: string; product: MyfansProduct | null }) => {
    const quote = quoteForSource(candidate.quoteXUrl || candidate.sourceXUrl);
    return quote ? creatorKeyFromQuote(quote) : candidate.product ? creatorKeyFromProduct(candidate.product) : "";
  };
  const attemptedCreatorKeys = new Set<string>();
  const trackCandidateAttempt = <T extends { quoteXUrl: string; sourceXUrl: string; product: MyfansProduct | null; quoteCandidateId?: number | null }>(candidate: T) => {
    const quote = candidate.quoteCandidateId == null
      ? null
      : analytics.quoteCandidates.find((row) => row.id === candidate.quoteCandidateId) ?? null;
    const creatorKey = creatorKeyForCandidateSource(candidate) || (quote ? creatorKeyFromQuote(quote) : "");
    if (creatorKey) attemptedCreatorKeys.add(creatorKey);
    return candidate;
  };
  const topicQuoteFor = (row: MyfansScoredProduct) => {
    const direct = analytics.quoteCandidates.find((candidate) => candidate.product_id === row.product.id && hasFreshTopicEvidence(candidate, planDate));
    if (direct) return direct;
    const creatorKey = creatorKeyFromProduct(row.product);
    const sameCreator = analytics.quoteCandidates.find((candidate) => hasFreshTopicEvidence(candidate, planDate) && creatorKeyFromQuote(candidate) === creatorKey);
    if (sameCreator) return sameCreator;
    return null;
  };
  const topicRows = products.flatMap((row) => {
    const quote = topicQuoteFor(row);
    const roles: CandidatePoolRole[] = input.isValidRevenueProduct(row.product)
      ? ["REVENUE", "DISCOVERY", "AUTHORITY", "ATTENTION"]
      : ["DISCOVERY", "AUTHORITY", "ATTENTION"];
    return roles.map((role) => {
      const topicValue = input.evaluateTopicValue({ product: row.product, quote, role, baselines: topicBaselines });
      return {
        productId: row.product.id,
        title: row.product.title,
        role,
        creatorKey: creatorKeyFromProduct(row.product),
        quoteCandidateId: quote?.id ?? null,
        sourceCandidate: quote ? quoteUrlFromCandidate(quote) : row.product.source_x_url || row.product.product_url,
        topicIdentity: topicIdentityFor(row.product, quote, topicValue.reasonToCare),
        topicSemanticKey: topicSemanticKeyFor(row.product, quote, topicValue),
        topicValue,
      };
    });
  }).sort((a, b) => b.topicValue.score - a.topicValue.score);
  const topicPassRows = topicRows.filter((row) => row.topicValue.verdict === "PASS");
  const candidateFunnel = {
    dbTotal: analytics.products.length,
    basicEligible: products.length,
    visualQuality: quotePool.funnel.qualified,
    topicValuePass: topicPassRows.length,
    shortlist: topicPassRows.slice(0, 10).length,
    final: 0,
  };
  const topicPassProductIds = topicPassRows.map((row) => row.productId);
  const usedProductIds = new Set<number>();
  const pickProduct = (needsAffiliateUrl: boolean, index: number, postType: string, exclude = usedProductIds) => {
    const pool = needsAffiliateUrl ? products.filter((row) => input.isRevenueTargetProduct(row.product)) : products;
    const role = postType === "reply_link_sales" || postType === "body_link_sales" ? "REVENUE" : input.roleForPostType(postType);
    const topicReady = (row: MyfansScoredProduct) => {
      const quote = topicQuoteFor(row);
      return input.evaluateTopicValue({ product: row.product, quote, role, baselines: topicBaselines }).verdict === "PASS";
    };
    return pickMyfansCandidateProduct({ pool, products, index, postType, exclude, topicPassProductIds, topicReady });
  };

  return {
    productForQuote,
    creatorKeyForCandidateSource,
    attemptedCreatorKeys,
    trackCandidateAttempt,
    topicRows,
    candidateFunnel,
    topicPassRows,
    allowSameProductAcrossDistinctRoles: false,
    usedProductIds,
    pickProduct,
  };
}
