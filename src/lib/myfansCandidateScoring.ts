import { inPeriod } from "@/lib/myfansTime";
import { creatorKeyFromProduct, recentUsedCreatorKeys, recentUsedProductIds } from "@/lib/myfansQuotePool";
import { calculateMyfansOpportunityScores } from "@/lib/myfansScore";
import { stableHash } from "@/lib/myfansHash";
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

export function buildMyfansScoredProductPool(analytics: MyfansAnalytics, planKey: string): MyfansScoredProduct[] {
  const productStats = summarizeProductStats(analytics);
  const creatorProductCounts = new Map<number, number>();
  const observedUpdateCounts30d = new Map<number, number>();
  for (const product of analytics.products) {
    if (!product.creator_id) continue;
    creatorProductCounts.set(product.creator_id, (creatorProductCounts.get(product.creator_id) ?? 0) + 1);
    if (inPeriod(product.created_at, 30)) {
      observedUpdateCounts30d.set(product.creator_id, (observedUpdateCounts30d.get(product.creator_id) ?? 0) + 1);
    }
  }

  const planSignupEvidenceCounts = new Map<number, number>();
  for (const conversion of analytics.conversions) {
    if (!conversion.product_id || !conversion.conversion_type.includes("plan")) continue;
    planSignupEvidenceCounts.set(conversion.product_id, (planSignupEvidenceCounts.get(conversion.product_id) ?? 0) + 1);
  }
  const recentlyUsedProductIds = recentUsedProductIds(analytics, 3);
  const recentlyUsedCreatorKeys = recentUsedCreatorKeys(analytics);

  return analytics.products
    .filter((product) => product.status !== "paused" && product.status !== "rejected")
    .map((product) => {
      const stats = productStats.get(product.id);
      const scores = calculateMyfansOpportunityScores({
        price: product.price,
        rewardRate: product.reward_rate,
        planSignupReward: product.plan_signup_reward,
        recurringRewardRate: product.recurring_reward_rate,
        popularityRank: product.popularity_rank,
        likesCount: product.likes_count,
        savesCount: product.saves_count,
        isNew: product.is_new,
        hasAffiliateUrl: Boolean(product.affiliate_url),
        hasApprovedMedia: Boolean(product.approved_media_name || product.affiliate_media_id),
        source_x_url: product.source_x_url,
        createdAt: product.created_at,
        creatorProductCount: product.creator_id ? creatorProductCounts.get(product.creator_id) : 1,
        pastImpressions: stats?.impressions,
        pastClicks: stats?.clicks,
        pastConversions: stats?.conversions,
        pastReward: stats?.reward,
        observedUpdateCount30d: product.creator_id ? observedUpdateCounts30d.get(product.creator_id) ?? 0 : 0,
        planSignupEvidenceCount: planSignupEvidenceCounts.get(product.id) || undefined,
      });
      const recentProductPenalty = recentlyUsedProductIds.has(product.id) ? 35 : 0;
      const recentCreatorPenalty = recentlyUsedCreatorKeys.has(creatorKeyFromProduct(product)) ? 20 : 0;
      const dailyFreshnessJitter = stableHash(`${planKey}:${product.id}`) % 17;
      return {
        product,
        scores,
        plannerScore: scores.growthScore + scores.revenueScore + scores.creatorLtvScore + dailyFreshnessJitter - recentProductPenalty - recentCreatorPenalty,
      };
    })
    .sort((a, b) => b.plannerScore - a.plannerScore)
    .slice(0, 100);
}
