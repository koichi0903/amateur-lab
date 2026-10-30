import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { stableHash } from "@/lib/myfansHash";
import type { DailyRole } from "@/lib/myfansTopicValue";
import type { MyfansCreativeStrategy, MyfansLinkStrategy } from "@/lib/myfansXExecution";
export function roleFor(postType: string, linkStrategy: MyfansLinkStrategy, creativeStrategy: MyfansCreativeStrategy): DailyRole {
  if (creativeStrategy === "quote_post") return "ATTENTION";
  if (linkStrategy === "reply_link" || linkStrategy === "body_link" || postType === "reply_link_sales" || postType === "body_link_sales") return "REVENUE";
  if (postType === "ranking_note" || creativeStrategy === "ranking_card" || creativeStrategy === "discovery_card") return "DISCOVERY";
  if (postType === "profile_cta" || postType === "comparison_review" || creativeStrategy === "comparison_card") return "AUTHORITY";
  return "DISCOVERY";
}

export function discoveryInsightFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, variant = 0) {
  const rank = product.popularity_rank;
  const likes = product.likes_count;
  const saves = product.saves_count;
  const quoteLikes = quote?.likes ?? 0;
  const quoteViews = quote?.views ?? 0;
  const rows = discoveryInsightRows(product, { rank, likes, saves, quoteLikes, quoteViews });
  if (!rows.length) return null;
  return rows[(variant + stableHash(`${product.id}:${likes}:${saves}:${rank ?? 0}`)) % rows.length];
}

type DiscoverySignals = { rank: number | null; likes: number; saves: number; quoteLikes: number; quoteViews: number };
type DiscoveryInsight = { score: number; line: string; value: string };

function discoveryInsightRows(product: MyfansProduct, signals: DiscoverySignals) {
  return [
    newReleaseInsight(product, signals),
    rankAndReactionInsight(signals),
    savedReactionInsight(signals),
    externalReactionInsight(signals),
    premiumPriceInsight(product),
    entryPriceInsight(product),
    lowPriceReactionInsight(product, signals),
  ].filter((row): row is DiscoveryInsight => row !== null);
}

function newReleaseInsight(product: MyfansProduct, { likes, saves }: DiscoverySignals): DiscoveryInsight | null {
  if (!product.is_new || !productIsNewEnough(likes, saves)) return null;
  return { score: 96, line: `新着なのに、いいね${likes.toLocaleString("ja-JP")}まで伸びている。`, value: "新着の中で反応が先に立っている。" };
}

function productIsNewEnough(likes: number, saves: number) {
  return likes >= 80 || saves >= 20;
}

function rankAndReactionInsight({ rank, likes }: DiscoverySignals): DiscoveryInsight | null {
  if (!rank || rank > 10 || likes < 50) return null;
  return { score: 94, line: `人気${rank}位で、いいねも${likes.toLocaleString("ja-JP")}まで乗っている。`, value: "順位だけでなく反応も伴っている。" };
}

function savedReactionInsight({ likes, saves }: DiscoverySignals): DiscoveryInsight | null {
  if (saves < 20 || likes < 80) return null;
  return { score: 92, line: `いいね${likes.toLocaleString("ja-JP")}に対して保存${saves.toLocaleString("ja-JP")}が強い。`, value: "流し見より、あとで戻る反応がある。" };
}

function externalReactionInsight({ quoteLikes, quoteViews }: DiscoverySignals): DiscoveryInsight | null {
  if (quoteViews < 50_000 || quoteLikes < 1000) return null;
  return { score: 91, line: `X側で${Math.floor(quoteViews / 10_000)}万表示を超えて、いいねも${quoteLikes.toLocaleString("ja-JP")}まで出ている。`, value: "myfans外でも引きが確認できる。" };
}

function premiumPriceInsight(product: MyfansProduct): DiscoveryInsight | null {
  if (product.price < 3980 || !/顔|晒し|インフルエンサー|女王様|本編/.test(product.title)) return null;
  return { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}なので、軽く試すより目的がはっきりした人向き。`, value: "価格が高めでも、内容の方向性が先に分かる。" };
}

function entryPriceInsight(product: MyfansProduct): DiscoveryInsight | null {
  if (product.price <= 0 || product.price > 1500) return null;
  return { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}なら、入口としては軽い。`, value: "価格が判断に効く日だけ、先に見ておける。" };
}

function lowPriceReactionInsight(product: MyfansProduct, { rank, likes }: DiscoverySignals): DiscoveryInsight | null {
  if (product.price <= 0 || product.price > 1200 || (!rank && likes < 100)) return null;
  return { score: 90, line: `¥${product.price.toLocaleString("ja-JP")}で、反応が先に立っている。`, value: "価格だけでなく反応が付いている時だけ見る価値がある。" };
}

export function replyFor(product: MyfansProduct, linkStrategy: MyfansLinkStrategy) {
  if (linkStrategy !== "reply_link" || !isValidRevenueProduct(product)) return "";
  return `#PR\n詳細はこちら\n${product.affiliate_url}`.trim();
}

function isValidMfcoLink(value: string) {
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+(?:[/?#].*)?$/.test(value.trim());
}

export function isValidRevenueProduct(product: MyfansProduct) {
  return isValidMfcoLink(product.affiliate_url) && (product.reward_rate > 0 || product.estimated_reward > 0 || product.plan_signup_reward > 0);
}
