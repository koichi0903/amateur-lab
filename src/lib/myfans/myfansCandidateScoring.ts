import { inPeriod } from "@/lib/myfans/myfansTime";
import { creatorKeyFromProduct, recentUsedCreatorKeys, recentUsedProductIds } from "@/lib/myfans/myfansQuotePool";
import { calculateMyfansOpportunityScores } from "@/lib/myfansScore";
import { stableHash } from "@/lib/myfans/myfansHash";
import type { MyfansAnalytics, MyfansProduct } from "@/lib/myfansAnalytics";

type ProductPerformance = {
  impressions: number;
  clicks: number;
  conversions: number;
  reward: number;
};

export type MyfansScoredProduct = {
  product: MyfansProduct;
  scores: ReturnType<typeof calculateMyfansOpportunityScores>;
  plannerScore: number;
};

type MyfansScoringContext = {
  productStats: Map<number, ProductPerformance>;
  creatorProductCounts: Map<number, number>;
  observedUpdateCounts30d: Map<number, number>;
  planSignupEvidenceCounts: Map<number, number>;
  recentlyUsedProductIds: Set<number>;
  recentlyUsedCreatorKeys: Set<string>;
};

function summarizeProductStats(analytics: MyfansAnalytics) {
  const map = new Map<number, ProductPerformance>();
  for (const post of analytics.posts) {
    if (!post.product_id) continue;
    const row = map.get(post.product_id) ?? { impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.impressions += post.impressions;
    row.clicks += post.clicks ?? 0;
    map.set(post.product_id, row);
  }
  for (const conversion of analytics.conversions) {
    if (!conversion.product_id) continue;
    const row = map.get(conversion.product_id) ?? { impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    row.conversions += 1;
    row.reward += conversion.reward_amount;
    map.set(conversion.product_id, row);
  }
  return map;
}

function summarizeCreatorProductActivity(products: MyfansProduct[]) {
  const creatorProductCounts = new Map<number, number>();
  const observedUpdateCounts30d = new Map<number, number>();
  for (const product of products) {
    if (!product.creator_id) continue;
    creatorProductCounts.set(product.creator_id, (creatorProductCounts.get(product.creator_id) ?? 0) + 1);
    if (inPeriod(product.created_at, 30)) {
      observedUpdateCounts30d.set(product.creator_id, (observedUpdateCounts30d.get(product.creator_id) ?? 0) + 1);
    }
  }
  return { creatorProductCounts, observedUpdateCounts30d };
}

function countPlanSignupEvidence(conversions: MyfansAnalytics["conversions"]) {
  const counts = new Map<number, number>();
  for (const conversion of conversions) {
    if (!conversion.product_id || !conversion.conversion_type.includes("plan")) continue;
    counts.set(conversion.product_id, (counts.get(conversion.product_id) ?? 0) + 1);
  }
  return counts;
}

function myfansScoringContext(analytics: MyfansAnalytics): MyfansScoringContext {
  return {
    productStats: summarizeProductStats(analytics),
    ...summarizeCreatorProductActivity(analytics.products),
    planSignupEvidenceCounts: countPlanSignupEvidence(analytics.conversions),
    recentlyUsedProductIds: recentUsedProductIds(analytics, 3),
    recentlyUsedCreatorKeys: recentUsedCreatorKeys(analytics),
  };
}

function creatorProductCountFor(product: MyfansProduct, context: MyfansScoringContext) {
  return product.creator_id ? context.creatorProductCounts.get(product.creator_id) : 1;
}

function observedCreatorUpdatesFor(product: MyfansProduct, context: MyfansScoringContext) {
  return product.creator_id ? context.observedUpdateCounts30d.get(product.creator_id) ?? 0 : 0;
}

function approvedMediaFor(product: MyfansProduct) {
  return Boolean(product.approved_media_name || product.affiliate_media_id);
}

function planSignupEvidenceFor(product: MyfansProduct, context: MyfansScoringContext) {
  return context.planSignupEvidenceCounts.get(product.id) || undefined;
}

function opportunityScoreInputFor(product: MyfansProduct, context: MyfansScoringContext) {
  const stats = context.productStats.get(product.id);
  return {
    price: product.price,
    rewardRate: product.reward_rate,
    planSignupReward: product.plan_signup_reward,
    recurringRewardRate: product.recurring_reward_rate,
    popularityRank: product.popularity_rank,
    likesCount: product.likes_count,
    savesCount: product.saves_count,
    isNew: product.is_new,
    hasAffiliateUrl: Boolean(product.affiliate_url),
    hasApprovedMedia: approvedMediaFor(product),
    source_x_url: product.source_x_url,
    createdAt: product.created_at,
    creatorProductCount: creatorProductCountFor(product, context),
    pastImpressions: stats?.impressions,
    pastClicks: stats?.clicks,
    pastConversions: stats?.conversions,
    pastReward: stats?.reward,
    observedUpdateCount30d: observedCreatorUpdatesFor(product, context),
    planSignupEvidenceCount: planSignupEvidenceFor(product, context),
  };
}

function plannerScoreFor(product: MyfansProduct, planKey: string, scores: MyfansScoredProduct["scores"], context: MyfansScoringContext) {
  const recentProductPenalty = context.recentlyUsedProductIds.has(product.id) ? 35 : 0;
  const recentCreatorPenalty = context.recentlyUsedCreatorKeys.has(creatorKeyFromProduct(product)) ? 20 : 0;
  const dailyFreshnessJitter = stableHash(`${planKey}:${product.id}`) % 17;
  return scores.growthScore + scores.revenueScore + scores.creatorLtvScore + dailyFreshnessJitter - recentProductPenalty - recentCreatorPenalty;
}

function scoreProduct(product: MyfansProduct, planKey: string, context: MyfansScoringContext): MyfansScoredProduct {
  const scores = calculateMyfansOpportunityScores(opportunityScoreInputFor(product, context));

  return {
    product,
    scores,
    plannerScore: plannerScoreFor(product, planKey, scores, context),
  };
}

function isScorableProduct(product: MyfansProduct) {
  return product.status !== "paused" && product.status !== "rejected";
}

export function buildMyfansScoredProductPool(analytics: MyfansAnalytics, planKey: string): MyfansScoredProduct[] {
  const context = myfansScoringContext(analytics);
  return analytics.products
    .filter(isScorableProduct)
    .map((product) => scoreProduct(product, planKey, context))
    .sort((a, b) => b.plannerScore - a.plannerScore)
    .slice(0, 100);
}
