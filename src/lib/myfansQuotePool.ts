import { cutoffIso, daysBetweenDates, daysSinceIso } from "@/lib/myfansTime";
export { daysSinceIso } from "@/lib/myfansTime";
import { buildMyfansPastUsageIndex } from "@/lib/myfansPastUsage";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { evaluateMyfansSourceValue, type MyfansSourceValue } from "@/lib/myfansSourceValue";
import { compactSourceText, hasBrowserVisibleVisual, visualAnalysisForQuote } from "@/lib/myfansCreativeEvidence";

export type MyfansReasonToCare =
  | "unexpected_popularity"
  | "visual_gap"
  | "creator_outlier"
  | "ranking_anomaly"
  | "price_anomaly"
  | "rapid_growth"
  | "strong_human_story"
  | "clear_comparison"
  | "rare_visual_moment"
  | "conversation_worthy";

export type MyfansTopicValue = {
  score: number;
  verdict: "PASS" | "LOW_TOPIC_VALUE";
  reasonToCare: MyfansReasonToCare | null;
  evidence: string[];
  baseline: string[];
  whyRejected: string[];
  breakdown: {
    surprise: number;
    concreteDifference: number;
    humanCuriosity: number;
    socialProofMomentum: number;
    visualStoryValue: number;
    explainability: number;
  };
};

export function currentPlanDate(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export function priceBucket(price: number) {
  if (price <= 0) return "unknown";
  if (price <= 1500) return "low";
  if (price <= 3980) return "mid";
  return "high";
}

export function sourceValueForQuote(quote: MyfansQuoteCandidate): MyfansSourceValue {
  return evaluateMyfansSourceValue({
    text: quote.text_excerpt,
    postedAt: quote.posted_at,
    collectedAt: quote.collected_at,
    mediaType: quote.media_type,
    mediaPermalink: quote.media_permalink,
    quoteVisualReady: quote.quote_visual_ready,
    visualAnalysisStatus: quote.visual_analysis_status,
    views: quote.views,
    likes: quote.likes,
    reposts: quote.reposts,
    replies: quote.replies,
    isRepost: quote.is_repost,
    isReply: quote.is_reply,
    isQuote: quote.is_quote,
  });
}

export function hasFreshTopicEvidence(quote: MyfansQuoteCandidate, planDate = currentPlanDate()) {
  const age = daysSinceIsoAtPlanDate(quote.posted_at ?? quote.collected_at, planDate);
  return !quote.is_repost && !quote.last_used_at && !quote.cooldown_until && age !== null && age <= MYFANS_DAILY_FRESH_DAYS
    && isUsableQuoteMedia(quote);
}

function metricBand(value: number | null | undefined) {
  if (!value || value <= 0) return "";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) * 10}万`;
  if (value >= 100_000) return `${Math.round(value / 10_000)}万`;
  if (value >= 10_000) return `${Math.round(value / 1000)}千`;
  return `${Math.round(value / 100) * 100}`;
}

export function topicIdentityFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, reasonToCare: MyfansReasonToCare | null | undefined) {
  if (quote?.id) return `quote:${quote.id}`;
  if (quote?.x_post_url) return `source:${quote.x_post_url.toLowerCase()}`;
  if (reasonToCare === "creator_outlier") return `${creatorKeyFromProduct(product)}:creator-outlier`;
  if (reasonToCare === "ranking_anomaly") return `product:${product.id}:ranking-anomaly:${product.popularity_rank ?? "none"}`;
  if (reasonToCare === "clear_comparison" || reasonToCare === "price_anomaly") return `product:${product.id}:${reasonToCare}:${priceBucket(product.price)}`;
  return `product:${product.id}:${reasonToCare ?? "topic"}`;
}

export function topicSemanticKeyFor(product: MyfansProduct, quote: MyfansQuoteCandidate | null, topicValue: MyfansTopicValue | null | undefined) {
  const reason = topicValue?.reasonToCare ?? "unknown";
  if (quote) {
    const views = metricBand(quote.views);
    const likes = metricBand(quote.likes);
    const source = (() => {
      try {
        return quote.x_post_url ? new URL(quote.x_post_url).pathname.toLowerCase() : `quote-${quote.id}`;
      } catch {
        return quote.x_post_url?.toLowerCase() || `quote-${quote.id}`;
      }
    })();
    return [`quote-event`, source, views ? `views:${views}` : "", likes ? `likes:${likes}` : ""].filter(Boolean).join(":");
  }
  if (reason === "creator_outlier") return `${creatorKeyFromProduct(product)}:creator-outlier`;
  if (reason === "ranking_anomaly") return `ranking:${product.popularity_rank ?? "none"}:${product.genre}`;
  if (reason === "clear_comparison" || reason === "price_anomaly") return `comparison:${priceBucket(product.price)}:${metricBand(product.likes_count)}`;
  return `product:${product.id}:${reason}`;
}

export function semanticTopicSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftParts = new Set(left.split(/[:/|]+/).filter((part) => part.length >= 3));
  const rightParts = right.split(/[:/|]+/).filter((part) => part.length >= 3);
  if (!leftParts.size || !rightParts.length) return 0;
  const overlap = rightParts.filter((part) => leftParts.has(part)).length;
  return overlap / Math.max(leftParts.size, rightParts.length);
}

export function buildPastUsageIndex(analytics: MyfansAnalytics, planDate: string) {
  return buildMyfansPastUsageIndex(analytics, planDate, {
    normalizeSourceUrl,
    normalizeBodyFingerprint,
    quoteUrlFromCandidate,
    creatorKeyFromQuote,
    creatorKeyFromProduct,
    topicSemanticKeyFor,
    semanticTopicSimilarity,
  });
}

export const MYFANS_DAILY_FRESH_DAYS = 14;

export const QUOTE_MIN_SCORE = 55;

export const QUOTE_STRONG_SCORE = 78;

const QUOTE_CREATOR_COOLDOWN_DAYS = 2;

export const POSTED_SOURCE_COOLDOWN_DAYS = 7;

export const SELECTED_SOURCE_SOFT_COOLDOWN_DAYS = 3;

export const TOPIC_COOLDOWN_DAYS = 3;

function jstDateKey(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return JST_DATE_KEY_FORMATTER.format(new Date(time));
}

const JST_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function daysSinceIsoAtPlanDate(value: string | null | undefined, planDate: string) {
  const dateKey = jstDateKey(value);
  const planTime = new Date(`${planDate}T00:00:00+09:00`).getTime();
  const dateTime = dateKey ? new Date(`${dateKey}T00:00:00+09:00`).getTime() : Number.NaN;
  if (!Number.isFinite(planTime) || !Number.isFinite(dateTime)) return null;
  return Math.max(0, Math.floor((planTime - dateTime) / 86_400_000));
}

export function creatorKeyFromProduct(product: Pick<MyfansProduct, "creator_id" | "creator_x_url">) {
  return product.creator_id ? `creator:${product.creator_id}` : `x:${(product.creator_x_url ?? "").toLowerCase()}`;
}

export function creatorKeyFromCreator(creator: Pick<MyfansAnalytics["creators"][number], "id">) {
  return `creator:${creator.id}`;
}

export function creatorKeyFromQuote(candidate: MyfansQuoteCandidate) {
  return candidate.creator_id ? `creator:${candidate.creator_id}` : `x:${candidate.creator_x_url.toLowerCase()}`;
}

export function quoteUrlFromCandidate(candidate: MyfansQuoteCandidate) {
  return candidate.x_post_url;
}

export function sourceAuthorHandleFromQuote(candidate: MyfansQuoteCandidate | null | undefined) {
  return (candidate?.source_x_handle || candidate?.creator_x_url?.match(/(?:x|twitter)\.com\/([^/?#]+)/i)?.[1] || "")
    .replace(/^@/, "")
    .trim();
}

export function sourceAuthorLabelFromQuote(candidate: MyfansQuoteCandidate | null | undefined) {
  const handle = sourceAuthorHandleFromQuote(candidate);
  return handle ? `@${handle}` : "引用元X投稿者不明";
}

export function normalizeSourceUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hostname = url.hostname.replace(/^twitter\.com$/i, "x.com").toLowerCase();
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.toLowerCase().replace(/\?.*$/, "").replace(/#.*$/, "").replace(/\/$/, "");
  }
}

function normalizeBodyFingerprint(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{Letter}\p{Number}ぁ-んァ-ヶー一-龠]+/gu, "")
    .trim();
}

export function visualPriority(candidate: MyfansQuoteCandidate) {
  const analysis = visualAnalysisForQuote(candidate);
  if (hasBrowserVisibleVisual(candidate) && analysis?.status === "verified") return 4;
  if (hasBrowserVisibleVisual(candidate) && analysis?.status === "partial") return 3;
  if (hasBrowserVisibleVisual(candidate)) return 2;
  if (candidate.has_video || candidate.has_image) return 1;
  return 0;
}

function isValidSourceStatusUrl(value: string | null | undefined) {
  return /^https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+(?:[/?#].*)?$/i.test(String(value ?? "").trim());
}

export function isUsableQuoteMedia(candidate: MyfansQuoteCandidate | null | undefined) {
  if (!candidate) return false;
  if (candidate.media_type !== "image" && candidate.media_type !== "video") return false;
  if (!String(candidate.media_permalink ?? "").trim() || !candidate.quote_visual_ready) return false;
  const validation = `${candidate.media_permalink_validation_status ?? ""} ${candidate.visual_render_status ?? ""}`;
  return !/blocked|sensitive|timeout|no_result|not_rendered|app_only/i.test(validation);
}

export function quoteOpportunityTopicValue(candidate: MyfansQuoteCandidate): MyfansTopicValue | null {
  const sourceValue = sourceValueForQuote(candidate);
  const visual = visualPriority(candidate);
  if (!isUsableQuoteMedia(candidate)) return null;
  if (candidate.score < QUOTE_MIN_SCORE) return null;
  const sourceText = compactSourceText(candidate.text_excerpt ?? "", 42);
  return {
    score: quoteOpportunityScore(candidate, visual, sourceValue),
    verdict: "PASS",
    reasonToCare: visual >= 2 ? "rare_visual_moment" : "conversation_worthy",
    evidence: quoteOpportunityEvidence(candidate, visual, sourceText),
    baseline: ["商品未紐付けのため収益候補にはしない", "元投稿の引用・発見候補として扱う"],
    whyRejected: [],
    breakdown: quoteOpportunityBreakdown(candidate, visual, sourceText),
  };
}

function quoteOpportunityScore(candidate: MyfansQuoteCandidate, visual: number, sourceValue: MyfansSourceValue) {
  return Math.min(100, Math.max(80, candidate.score + (visual >= 3 ? 8 : 0) + Math.round(sourceValue.score / 20) + (sourceValue.verdict === "PASS" ? 4 : 0)));
}

function quoteOpportunityEvidence(candidate: MyfansQuoteCandidate, visual: number, sourceText: string) {
  return [
    visual >= 2 ? `visual ${candidate.media_type ?? (candidate.has_video ? "video" : "image")}` : "公開反応シグナルあり",
    sourceText,
    candidate.views && candidate.views > 0 ? `X表示${candidate.views.toLocaleString("ja-JP")}` : "",
  ].filter(Boolean);
}

function quoteOpportunityBreakdown(candidate: MyfansQuoteCandidate, visual: number, sourceText: string) {
  return {
      surprise: visual >= 2 ? 18 : 12,
      concreteDifference: sourceText ? 18 : 10,
      humanCuriosity: 18,
      socialProofMomentum: candidate.views && candidate.views >= 50_000 ? 20 : 12,
      visualStoryValue: visual >= 2 ? 24 : 12,
      explainability: 16,
  };
}

export function quoteOpportunityBody(candidate: MyfansQuoteCandidate, variant: number) {
  const source = compactSourceText(candidate.text_excerpt ?? "", 34);
  const media = candidate.media_type === "video" || candidate.has_video ? "動画" : candidate.media_type === "image" || candidate.has_image ? "画像" : "投稿";
  const lines = source
    ? [`「${source}」の出し方が気になってしまう。`, `${media}の入り方で一回止まる。`, `この${media}、流れてきたら一度開く。`]
    : [`この${media}、最初の置き方がうまい。`, `タイムラインで見たら一回戻る。`, `説明より先に${media}で引っかかる。`];
  return lines[variant % lines.length];
}

export function recentUsedCreatorKeys(analytics: MyfansAnalytics) {
  const cutoff = cutoffIso(QUOTE_CREATOR_COOLDOWN_DAYS);
  const keys = new Set<string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy !== "quote_post" || !post.quote_x_url || !((post.posted_at ?? post.created_at) >= cutoff)) continue;
    const product = analytics.products.find((item) => item.id === post.product_id);
    if (product) keys.add(creatorKeyFromProduct(product));
  }
  return keys;
}

export function recentUsedProductIds(analytics: MyfansAnalytics, days: number) {
  const cutoff = cutoffIso(days);
  return new Set(analytics.posts
    .filter((post) => (post.posted_at ?? post.created_at) >= cutoff && post.product_id)
    .map((post) => post.product_id as number));
}

export function usedQuoteUrls(analytics: MyfansAnalytics) {
  const urls = new Set<string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy === "quote_post" && post.quote_x_url) urls.add(post.quote_x_url);
  }
  return urls;
}

type ScoredQuoteCandidate = { candidate: MyfansQuoteCandidate; globalScore: number };
type QuotePoolHistory = ReturnType<typeof buildPastUsageIndex>;

function creatorLastUsedMap(analytics: MyfansAnalytics) {
  const creatorLastUsed = new Map<string, string>();
  for (const post of analytics.posts) {
    if (post.creative_strategy !== "quote_post") continue;
    const product = analytics.products.find((item) => item.id === post.product_id);
    if (!product) continue;
    const key = creatorKeyFromProduct(product);
    const usedAt = post.posted_at ?? post.created_at;
    if (usedAt && (!creatorLastUsed.has(key) || usedAt > String(creatorLastUsed.get(key)))) creatorLastUsed.set(key, usedAt);
  }
  return creatorLastUsed;
}

function quoteAgeAtPlanDate(candidate: MyfansQuoteCandidate, planDate: string) {
  return daysSinceIsoAtPlanDate(candidate.posted_at ?? candidate.collected_at, planDate);
}

function isFreshQuoteAtPlanDate(candidate: MyfansQuoteCandidate, planDate: string) {
  const age = quoteAgeAtPlanDate(candidate, planDate);
  return age === null || age <= MYFANS_DAILY_FRESH_DAYS;
}

function quoteUsageAtPlanDate(candidate: MyfansQuoteCandidate, analytics: MyfansAnalytics, planDate: string, pastUsage: QuotePoolHistory) {
  const sourceUsage = pastUsage.latestSource(candidate.x_post_url) ?? pastUsage.latestSource(quoteUrlFromCandidate(candidate));
  const sourceAge = sourceUsage ? daysBetweenDates(planDate, sourceUsage.date) : null;
  const topicProduct = analytics.products.find((product) => product.id === candidate.product_id) ?? analytics.products[0] ?? null;
  const topicUsage = topicProduct ? pastUsage.latestTopic(`quote:${candidate.id}`, topicSemanticKeyFor(topicProduct, candidate, null)) : null;
  const topicAge = topicUsage ? daysBetweenDates(planDate, topicUsage.date) : null;
  return { sourceUsage, sourceAge, topicUsage, topicAge };
}

function isBaseQuoteContentValid(candidate: MyfansQuoteCandidate, age: number | null) {
  return isValidSourceStatusUrl(candidate.x_post_url) &&
    isUsableQuoteMedia(candidate) &&
    (age === null || age <= MYFANS_DAILY_FRESH_DAYS) &&
    !candidate.is_repost;
}

function isQuoteAvailableForUse(candidate: MyfansQuoteCandidate, now: string, usedUrls: Set<string>) {
  return (!candidate.cooldown_until || candidate.cooldown_until <= now) &&
    !usedUrls.has(candidate.x_post_url) &&
    !usedUrls.has(quoteUrlFromCandidate(candidate)) &&
    !candidate.last_used_at;
}

function isOutsideSourceCooldown(sourceUsage: ReturnType<QuotePoolHistory["latestSource"]>, sourceAge: number | null) {
  if (sourceUsage?.actualPosted && sourceAge !== null && sourceAge < POSTED_SOURCE_COOLDOWN_DAYS) return false;
  return !(sourceUsage && sourceAge !== null && sourceAge < SELECTED_SOURCE_SOFT_COOLDOWN_DAYS);
}

function isOutsideTopicCooldown(topicUsage: ReturnType<QuotePoolHistory["latestTopic"]> | null, topicAge: number | null) {
  return !(topicUsage && topicAge !== null && topicAge < TOPIC_COOLDOWN_DAYS);
}

function isBaseEligibleQuote(candidate: MyfansQuoteCandidate, input: {
  analytics: MyfansAnalytics;
  planDate: string;
  now: string;
  usedUrls: Set<string>;
  pastUsage: QuotePoolHistory;
}) {
  const { analytics, planDate, now, usedUrls, pastUsage } = input;
  const age = quoteAgeAtPlanDate(candidate, planDate);
  const usage = quoteUsageAtPlanDate(candidate, analytics, planDate, pastUsage);
  return isBaseQuoteContentValid(candidate, age) &&
    isQuoteAvailableForUse(candidate, now, usedUrls) &&
    isOutsideSourceCooldown(usage.sourceUsage, usage.sourceAge) &&
    isOutsideTopicCooldown(usage.topicUsage, usage.topicAge);
}

function visualScoreBoost(visual: number) {
  return visual === 4 ? 28 : visual === 3 ? 18 : visual === 2 ? 8 : visual === 1 ? 2 : -24;
}

function creatorHistoryPenalty(age: number | null) {
  if (age !== null && age < 1) return 38;
  if (age !== null && age < 2) return 24;
  if (age !== null && age < 3) return 12;
  return 0;
}

function scoreGlobalQuote(candidate: MyfansQuoteCandidate, input: {
  planDate: string;
  recentCreators: Set<string>;
  creatorLastUsed: Map<string, string>;
  pastUsage: QuotePoolHistory;
}): ScoredQuoteCandidate {
  const { planDate, recentCreators, creatorLastUsed, pastUsage } = input;
  const key = creatorKeyFromQuote(candidate);
  const freshnessAge = quoteAgeAtPlanDate(candidate, planDate) ?? MYFANS_DAILY_FRESH_DAYS;
  const unusedDays = daysSinceIso(creatorLastUsed.get(key)) ?? 30;
  const creatorUsage = pastUsage.latestCreator(key);
  const creatorUsageAge = creatorUsage ? daysBetweenDates(planDate, creatorUsage.date) : null;
  const sourceValue = sourceValueForQuote(candidate);
  const globalScore = Math.round(Math.max(0, Math.min(120,
    candidate.score
    + visualScoreBoost(visualPriority(candidate))
    + Math.round(sourceValue.score / 4)
    + (sourceValue.verdict === "PASS" ? 8 : -4)
    + Math.max(0, 10 - freshnessAge)
    + Math.min(8, unusedDays / 3)
    - (recentCreators.has(key) ? 18 : 0)
    - creatorHistoryPenalty(creatorUsageAge)
    - Math.max(0, (candidate.use_count ?? 0) * 12)
    - ((candidate.creator_rank ?? 3) - 1) * 4,
  )));
  return { candidate, globalScore };
}

function rankGlobalQuotes(qualified: MyfansQuoteCandidate[], input: {
  planDate: string;
  recentCreators: Set<string>;
  creatorLastUsed: Map<string, string>;
  pastUsage: QuotePoolHistory;
}) {
  return qualified
    .map((candidate) => scoreGlobalQuote(candidate, input))
    .sort((a, b) =>
      b.globalScore - a.globalScore ||
      visualPriority(b.candidate) - visualPriority(a.candidate) ||
      b.candidate.score - a.candidate.score
    );
}

function globalQuotesWithSourceDiversity(scoredQuotes: ScoredQuoteCandidate[]) {
  const global: ScoredQuoteCandidate[] = [];
  const creatorCounts = new Map<string, number>();
  const seenSources = new Set<string>();
  const seenMedia = new Set<string>();
  for (const row of scoredQuotes) {
    const sourceKey = normalizeSourceUrl(row.candidate.x_post_url);
    const mediaKey = normalizeSourceUrl(row.candidate.media_permalink);
    if (!sourceKey || seenSources.has(sourceKey) || (mediaKey && seenMedia.has(mediaKey))) continue;
    const key = creatorKeyFromQuote(row.candidate);
    const count = creatorCounts.get(key) ?? 0;
    if (global.length < 3 && count >= 2) continue;
    global.push(row);
    seenSources.add(sourceKey);
    if (mediaKey) seenMedia.add(mediaKey);
    creatorCounts.set(key, count + 1);
  }
  for (const row of scoredQuotes) {
    if (global.includes(row)) continue;
    global.push({ ...row, globalScore: Math.max(0, row.globalScore - 35) });
  }
  return global;
}

function selectVisualQuoteCandidates(global: ScoredQuoteCandidate[]) {
  const selected: ScoredQuoteCandidate[] = [];
  const selectedCreators = new Set<string>();
  for (const row of global) {
    const key = creatorKeyFromQuote(row.candidate);
    const visual = visualPriority(row.candidate);
    if (selectedCreators.has(key)) continue;
    if (selected.length === 0 && visual >= 2 && row.globalScore >= QUOTE_MIN_SCORE) {
      selected.push(row);
      selectedCreators.add(key);
      continue;
    }
    if (selected.length === 1 && visual >= 2 && row.globalScore >= QUOTE_STRONG_SCORE) {
      selected.push(row);
      selectedCreators.add(key);
    }
    if (selected.length >= 2) break;
  }
  return selected;
}

function freshnessCooldownCount(candidates: MyfansQuoteCandidate[], planDate: string, now: string) {
  return candidates.filter((candidate) => {
    const age = quoteAgeAtPlanDate(candidate, planDate);
    return (age === null || age <= MYFANS_DAILY_FRESH_DAYS) &&
      !candidate.is_repost &&
      !candidate.last_used_at &&
      (!candidate.cooldown_until || candidate.cooldown_until <= now);
  }).length;
}

function rejectionCountsForQuotes(candidates: MyfansQuoteCandidate[], products: MyfansProduct[], planDate: string, now: string) {
  const rejectionCounts = new Map<string, number>();
  const addRejection = (reason: string) => rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1);
  for (const candidate of candidates) {
    const age = quoteAgeAtPlanDate(candidate, planDate);
    const sourceValue = sourceValueForQuote(candidate);
    if (age !== null && age > MYFANS_DAILY_FRESH_DAYS) addRejection("期限切れ(14日超)");
    if (!isValidSourceStatusUrl(candidate.x_post_url)) addRejection("source URL不正/欠落");
    if (!isUsableQuoteMedia(candidate)) addRejection("利用可能mediaなし");
    if (candidate.is_repost) addRejection("repost");
    if (candidate.last_used_at || (candidate.cooldown_until && candidate.cooldown_until > now)) addRejection("再利用cooldown");
    if (sourceValue.verdict !== "PASS") addRejection("LOW_SOURCE_VALUE（ランキング減点のみ）");
    if (candidate.score < QUOTE_MIN_SCORE) addRejection("score不足(<55)");
    if (!candidate.product_id && !products.some((product) => creatorKeyFromProduct(product) === creatorKeyFromQuote(candidate))) addRejection("商品/creator未紐付け");
  }
  return rejectionCounts;
}

function buildQuotePoolFunnel(input: {
  analytics: MyfansAnalytics;
  planDate: string;
  now: string;
  rawFreshCount: number;
  baseEligible: MyfansQuoteCandidate[];
  qualified: MyfansQuoteCandidate[];
  global: ScoredQuoteCandidate[];
  selected: ScoredQuoteCandidate[];
}) {
  const { analytics, planDate, now, rawFreshCount, baseEligible, qualified, global, selected } = input;
  const rejectionCounts = rejectionCountsForQuotes(analytics.quoteCandidates, analytics.products, planDate, now);
  return {
    dbTotal: analytics.quoteCandidateSource.dbCount,
    loaded: analytics.quoteCandidateSource.loadedCount,
    rawFresh14d: rawFreshCount,
    mediaScoped: analytics.quoteCandidates.length,
    baseEligible: baseEligible.length,
    qualified: qualified.length,
    sourceValuePass: analytics.quoteCandidates.filter((candidate) => sourceValueForQuote(candidate).verdict === "PASS").length,
    sourceValueLow: analytics.quoteCandidates.filter((candidate) => sourceValueForQuote(candidate).verdict !== "PASS").length,
    attentionShortlist: global.filter((row) => row.globalScore >= QUOTE_MIN_SCORE).slice(0, 10).length,
    selected: selected.length,
    loadedAll: analytics.quoteCandidateSource.loadedAll,
    latestCollectedAt: analytics.quoteCandidateSource.latestCollectedAt,
    pageSize: analytics.quoteCandidateSource.pageSize,
    rejectionReasons: [...rejectionCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    candidatePoolLimit: 12,
    hardEligible: baseEligible.length,
    ranked12: global.slice(0, 12).length,
    freshnessCooldownCount: freshnessCooldownCount(analytics.quoteCandidates, planDate, now),
    qualifiedDiscoveryIds: qualified.map((candidate) => candidate.id),
    productLinkedCount: qualified.filter((candidate) => Boolean(candidate.product_id && analytics.products.some((product) => product.id === candidate.product_id))).length,
    creatorMapHitCount: qualified.filter((candidate) => analytics.products.some((product) => creatorKeyFromProduct(product) === creatorKeyFromQuote(candidate))).length,
  };
}

export function buildMyfansQuotePool(analytics: MyfansAnalytics, planDate = currentPlanDate()) {
  const recentCreators = recentUsedCreatorKeys(analytics);
  const usedUrls = usedQuoteUrls(analytics);
  const pastUsage = buildPastUsageIndex(analytics, planDate);
  const creatorLastUsed = creatorLastUsedMap(analytics);
  const now = new Date().toISOString();
  const rawFresh14d = analytics.quoteCandidates.filter((candidate) => isFreshQuoteAtPlanDate(candidate, planDate));
  const eligibilityContext = { analytics, planDate, now, usedUrls, pastUsage };
  const baseEligible = rawFresh14d.filter((candidate) => isBaseEligibleQuote(candidate, eligibilityContext));
  const qualified = baseEligible.filter((candidate) => candidate.score >= QUOTE_MIN_SCORE);
  const globalContext = { planDate, recentCreators, creatorLastUsed, pastUsage };
  const scoredGlobal = rankGlobalQuotes(qualified, globalContext);
  const global = globalQuotesWithSourceDiversity(scoredGlobal);
  const selected = selectVisualQuoteCandidates(global);
  return {
    global,
    selected,
    funnel: buildQuotePoolFunnel({ analytics, planDate, now, rawFreshCount: rawFresh14d.length, baseEligible, qualified, global, selected }),
  };
}
