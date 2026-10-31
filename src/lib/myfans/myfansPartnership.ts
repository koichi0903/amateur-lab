import type { MyfansAnalytics, MyfansProduct } from "@/lib/myfansAnalytics";
import { calculateMyfansOpportunityScores } from "@/lib/myfansScore";

export function buildCreatorPartnershipCandidates(analytics: MyfansAnalytics) {
  const productsByCreator = new Map<number, MyfansProduct[]>();
  for (const product of analytics.products) {
    if (!product.creator_id) continue;
    productsByCreator.set(product.creator_id, [...(productsByCreator.get(product.creator_id) ?? []), product]);
  }
  return analytics.creators.map((creator) => {
    const products = productsByCreator.get(creator.id) ?? [];
    const productIds = new Set(products.map((product) => product.id));
    const posts = analytics.posts.filter((post) => post.product_id && productIds.has(post.product_id));
    const conversions = analytics.conversions.filter((conversion) => conversion.product_id && productIds.has(conversion.product_id));
    const impressions = posts.reduce((sum, post) => sum + post.impressions, 0);
    const clicks = posts.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
    const reward = conversions.reduce((sum, conversion) => sum + conversion.reward_amount, 0);
    const avgScores = products.map((product) =>
      calculateMyfansOpportunityScores({
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
        creatorProductCount: products.length,
        pastImpressions: impressions,
        pastClicks: clicks,
        pastConversions: conversions.length,
        pastReward: reward,
      }),
    );
    const revenueScore = avgScores.length ? Math.round(avgScores.reduce((sum, row) => sum + row.revenueScore, 0) / avgScores.length) : 0;
    const creatorLtvScore = avgScores.length ? Math.round(avgScores.reduce((sum, row) => sum + row.creatorLtvScore, 0) / avgScores.length) : 0;
    const priority = reward > 0 || clicks >= 5 || creatorLtvScore >= 65 ? "直接提携候補" : revenueScore >= 55 || creatorLtvScore >= 55 ? "個別報酬率交渉候補" : "継続観測";
    return {
      creator,
      products: products.length,
      impressions,
      clicks,
      conversions: conversions.length,
      reward,
      revenueScore,
      creatorLtvScore,
      priority,
      reason: `${products.length}商品 / ${clicks}クリック / ${conversions.length}成果。実績が少ない場合は候補止まりで扱います。`,
      messageDraft: `${creator.display_name}様\nいつも作品を拝見しています。Xの発見・比較投稿で反応が出ているため、掲載条件や個別報酬率についてご相談できればと思いご連絡しました。`,
    };
  }).sort((a, b) => b.reward - a.reward || b.clicks - a.clicks || b.creatorLtvScore - a.creatorLtvScore).slice(0, 8);
}
