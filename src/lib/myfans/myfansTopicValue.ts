import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import {
  creatorKeyFromProduct,
  isUsableQuoteMedia,
  priceBucket,
  sourceValueForQuote,
  type MyfansReasonToCare,
  type MyfansTopicValue,
} from "@/lib/myfans/myfansQuotePool";
import { hasBrowserVisibleVisual, visualUnderstandingFor, weakAttentionCue } from "@/lib/myfans/myfansCreativeEvidence";
import { publicCopyFactsFor } from "@/lib/myfans/myfansPublicCopyFacts";

export type DailyRole = "ATTENTION" | "DISCOVERY" | "AUTHORITY" | "REVENUE";
export const MYFANS_ATTENTION_VALUE_MINIMUM = 85;
export const MYFANS_TOPIC_VALUE_THRESHOLDS: Record<DailyRole, number> = { ATTENTION: 85, DISCOVERY: 80, AUTHORITY: 75, REVENUE: 75 };
function median(values: number[]) {
  const rows = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : Math.round((rows[mid - 1] + rows[mid]) / 2);
}

function percentileRank(value: number, values: number[]) {
  const rows = values.filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const belowOrEqual = rows.filter((item) => item <= value).length;
  return Math.round((belowOrEqual / rows.length) * 100);
}



export type MyfansTopicBaselines = {
  creatorMedianLikes: Map<string, number>;
  creatorMedianSaves: Map<string, number>;
  priceBucketMedianLikes: Map<string, number>;
  genreMedianLikes: Map<string, number>;
  allLikes: number[];
  allQuoteViews: number[];
  allQuoteLikes: number[];
};

export function buildTopicBaselines(analytics: MyfansAnalytics): MyfansTopicBaselines {
  const products = analytics.products.filter((product) => product.status !== "paused" && product.status !== "rejected");
  const creatorLikes = new Map<string, number[]>();
  const creatorSaves = new Map<string, number[]>();
  const bucketLikes = new Map<string, number[]>();
  const genreLikes = new Map<string, number[]>();
  for (const product of products) {
    const creatorKey = creatorKeyFromProduct(product);
    creatorLikes.set(creatorKey, [...(creatorLikes.get(creatorKey) ?? []), product.likes_count]);
    creatorSaves.set(creatorKey, [...(creatorSaves.get(creatorKey) ?? []), product.saves_count]);
    const bucket = priceBucket(product.price);
    bucketLikes.set(bucket, [...(bucketLikes.get(bucket) ?? []), product.likes_count]);
    if (product.genre) genreLikes.set(product.genre, [...(genreLikes.get(product.genre) ?? []), product.likes_count]);
  }
  const toMedianMap = (source: Map<string, number[]>) => new Map(Array.from(source.entries()).flatMap(([key, values]) => {
    const value = median(values);
    return value === null ? [] : [[key, value]];
  }));
  return {
    creatorMedianLikes: toMedianMap(creatorLikes),
    creatorMedianSaves: toMedianMap(creatorSaves),
    priceBucketMedianLikes: toMedianMap(bucketLikes),
    genreMedianLikes: toMedianMap(genreLikes),
    allLikes: products.map((product) => product.likes_count),
    allQuoteViews: analytics.quoteCandidates.map((quote) => quote.views ?? 0),
    allQuoteLikes: analytics.quoteCandidates.map((quote) => quote.likes ?? 0),
  };
}

export function topicThresholdFor(role: DailyRole) {
  return MYFANS_TOPIC_VALUE_THRESHOLDS[role];
}

function isMetricOnlySourceText(text: string) {
  return /^[\d\s.,、。!?！？%％¥￥円+-]+$/.test(text);
}

function hasStrongSourceValueEvidence(sourceValue: ReturnType<typeof sourceValueForQuote> | null) {
  return sourceValue?.verdict === "PASS"
    && sourceValue.breakdown.selfContainedContext >= 8
    && sourceValue.reactionAngles.length > 0;
}

function hasLegacySourceTextEvidence(text: string) {
  const hasTopic = /(新着|新作|更新|公開|発売|解禁|追加|再販|固定|本人|投稿|返信|リプ|変化|急上昇|ランキング|価格|続編|表情|衣装|シーン)/.test(text);
  const hasChange = /(変わ|違|出|上が|下が|伸び|残|見え|始ま|終わ|気にな|分かれ)/.test(text);
  const hasSentenceEnding = /[。！？!?]/.test(text);
  return hasTopic && (hasChange || hasSentenceEnding);
}

function hasConcreteSourceEvidence(quote: MyfansQuoteCandidate | null, text: string, sourceValue: ReturnType<typeof sourceValueForQuote> | null) {
  return isUsableQuoteMedia(quote)
    || hasStrongSourceValueEvidence(sourceValue)
    || hasLegacySourceTextEvidence(text);
}

export function hasConcreteSourceContext(quote: MyfansQuoteCandidate | null) {
  const text = quote?.text_excerpt?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return false;
  if (isMetricOnlySourceText(text)) return false;
  const sourceValue = quote ? sourceValueForQuote(quote) : null;
  return hasConcreteSourceEvidence(quote, text, sourceValue);
}

export function hasGroundedSourceText(quote: MyfansQuoteCandidate | null) {
  return Boolean(quote && sourceValueForQuote(quote).verdict === "PASS");
}





type TopicEvidenceAccumulator = { evidence: string[]; reasons: MyfansReasonToCare[] };

function topicBaselineLines(product: MyfansProduct, creatorMedianLikes: number | null, creatorMedianSaves: number | null, bucketMedianLikes: number | null, genreMedianLikes: number | null, quoteViewPercentile: number | null) {
  const lines: string[] = [];
  if (creatorMedianLikes !== null) lines.push(`creator median likes ${creatorMedianLikes} vs current ${product.likes_count}`);
  if (creatorMedianSaves !== null) lines.push(`creator median saves ${creatorMedianSaves} vs current ${product.saves_count}`);
  if (bucketMedianLikes !== null) lines.push(`price bucket ${priceBucket(product.price)} median likes ${bucketMedianLikes} vs current ${product.likes_count}`);
  if (genreMedianLikes !== null) lines.push(`genre median likes ${genreMedianLikes} vs current ${product.likes_count}`);
  if (quoteViewPercentile !== null) lines.push(`quote views percentile ${quoteViewPercentile}`);
  return lines;
}

function addCreatorTopicSignals(product: MyfansProduct, creatorMedianLikes: number | null, bucketMedianLikes: number | null, target: TopicEvidenceAccumulator) {
  if (creatorMedianLikes !== null && product.likes_count >= Math.max(80, creatorMedianLikes * 2)) {
    target.reasons.push("creator_outlier");
    target.evidence.push(`creator通常中央値${creatorMedianLikes}いいねに対して今回${product.likes_count}いいね`);
  }
  if (bucketMedianLikes !== null && product.likes_count >= Math.max(80, bucketMedianLikes * 1.8)) {
    target.reasons.push("clear_comparison");
    target.evidence.push(`同価格帯中央値${bucketMedianLikes}いいねに対して今回${product.likes_count}いいね`);
  }
}

function hasRankingPopularitySignal(product: MyfansProduct, productLikePercentile: number | null) {
  return Boolean(product.popularity_rank && product.popularity_rank <= 10 && product.likes_count >= 100
    && productLikePercentile !== null && productLikePercentile >= 50);
}

function hasNewProductPopularitySignal(product: MyfansProduct, productLikePercentile: number | null) {
  return Boolean(product.is_new && productLikePercentile !== null && productLikePercentile >= 75);
}

function addProductPopularitySignals(product: MyfansProduct, productLikePercentile: number | null, target: TopicEvidenceAccumulator) {
  if (hasRankingPopularitySignal(product, productLikePercentile)) {
    target.reasons.push("ranking_anomaly");
    target.evidence.push(`人気${product.popularity_rank}位で、いいねも全体上位${productLikePercentile}%`);
  }
  if (hasNewProductPopularitySignal(product, productLikePercentile)) {
    target.reasons.push("unexpected_popularity");
    target.evidence.push(`新着で、いいねが全体上位${productLikePercentile}%`);
  }
}

function hasHighViewQuoteSignal(quote: MyfansQuoteCandidate | null, percentile: number | null) {
  return Boolean(quote && (percentile ?? 0) >= 85 && (quote.views ?? 0) >= 50_000);
}

function hasHighLikeQuoteSignal(quote: MyfansQuoteCandidate | null, percentile: number | null) {
  return Boolean(quote && (percentile ?? 0) >= 85 && (quote.likes ?? 0) >= 1000);
}

function addQuotePopularitySignals(quote: MyfansQuoteCandidate | null, quoteViewPercentile: number | null, quoteLikePercentile: number | null, target: TopicEvidenceAccumulator) {
  if (hasHighViewQuoteSignal(quote, quoteViewPercentile)) {
    target.reasons.push("rapid_growth");
    target.evidence.push(`X表示${(quote?.views ?? 0).toLocaleString("ja-JP")}で全体上位${quoteViewPercentile}%`);
  }
  if (hasHighLikeQuoteSignal(quote, quoteLikePercentile)) {
    target.reasons.push("unexpected_popularity");
    target.evidence.push(`Xいいね${(quote?.likes ?? 0).toLocaleString("ja-JP")}で全体上位${quoteLikePercentile}%`);
  }
}

function addVisualTopicSignal(visual: ReturnType<typeof visualUnderstandingFor> | null, target: TopicEvidenceAccumulator) {
  if (visual?.visualAnalysisStatus === "verified" && visual.attentionMoment && !weakAttentionCue(visual.attentionMoment) && visual.attentionValue.score >= MYFANS_ATTENTION_VALUE_MINIMUM) {
    target.reasons.push(visual.visibleChangeOrContrast ? "visual_gap" : "rare_visual_moment");
    target.evidence.push(`verified visual: ${visual.attentionMoment}`);
  }
}

function addPriceTopicSignal(product: MyfansProduct, bucketMedianLikes: number | null, target: TopicEvidenceAccumulator) {
  if (product.price > 0 && bucketMedianLikes !== null && product.likes_count >= Math.max(80, bucketMedianLikes * 1.8)) {
    target.reasons.push("price_anomaly");
    target.evidence.push(`価格${product.price.toLocaleString("ja-JP")}円で同価格帯より反応が突出`);
  }
}

function genreMedianLikesFor(product: MyfansProduct, baselines: MyfansTopicBaselines) {
  return product.genre ? baselines.genreMedianLikes.get(product.genre) ?? null : null;
}

function quoteViewsPercentileFor(quote: MyfansQuoteCandidate | null, baselines: MyfansTopicBaselines) {
  return quote ? percentileRank(quote.views ?? 0, baselines.allQuoteViews) : null;
}

function quoteLikesPercentileFor(quote: MyfansQuoteCandidate | null, baselines: MyfansTopicBaselines) {
  return quote ? percentileRank(quote.likes ?? 0, baselines.allQuoteLikes) : null;
}

function visualUnderstandingForQuote(product: MyfansProduct, quote: MyfansQuoteCandidate | null) {
  return quote ? visualUnderstandingFor(publicCopyFactsFor(product, quote)) : null;
}

function collectMyfansTopicEvidence(product: MyfansProduct, quote: MyfansQuoteCandidate | null, baselines: MyfansTopicBaselines) {
  const creatorKey = creatorKeyFromProduct(product);
  const creatorMedianLikes = baselines.creatorMedianLikes.get(creatorKey) ?? null;
  const creatorMedianSaves = baselines.creatorMedianSaves.get(creatorKey) ?? null;
  const bucketMedianLikes = baselines.priceBucketMedianLikes.get(priceBucket(product.price)) ?? null;
  const genreMedianLikes = genreMedianLikesFor(product, baselines);
  const productLikePercentile = percentileRank(product.likes_count, baselines.allLikes);
  const quoteViewPercentile = quoteViewsPercentileFor(quote, baselines);
  const quoteLikePercentile = quoteLikesPercentileFor(quote, baselines);
  const visual = visualUnderstandingForQuote(product, quote);
  const target: TopicEvidenceAccumulator = { evidence: [], reasons: [] };
  const baseline = topicBaselineLines(product, creatorMedianLikes, creatorMedianSaves, bucketMedianLikes, genreMedianLikes, quoteViewPercentile);
  addCreatorTopicSignals(product, creatorMedianLikes, bucketMedianLikes, target);
  addProductPopularitySignals(product, productLikePercentile, target);
  addQuotePopularitySignals(quote, quoteViewPercentile, quoteLikePercentile, target);
  addVisualTopicSignal(visual, target);
  addPriceTopicSignal(product, bucketMedianLikes, target);
  return { creatorMedianLikes, bucketMedianLikes, quoteViewPercentile, visual, evidence: target.evidence, baseline, reasons: target.reasons };
}

type TopicValueBreakdown = MyfansTopicValue["breakdown"];

function scoreSurprise(product: MyfansProduct, hasComparison: boolean, quoteViewPercentile: number | null) {
  return Math.min(20, (hasComparison ? 12 : 0) + (product.is_new && hasComparison ? 5 : 0) + (quoteViewPercentile !== null && quoteViewPercentile >= 90 ? 3 : 0));
}

function scoreConcreteDifference(product: MyfansProduct, creatorMedianLikes: number | null, bucketMedianLikes: number | null) {
  return Math.min(20, (creatorMedianLikes !== null && product.likes_count > creatorMedianLikes ? 8 : 0) + (bucketMedianLikes !== null && product.likes_count > bucketMedianLikes ? 8 : 0) + (product.popularity_rank && product.popularity_rank <= 10 ? 4 : 0));
}

function scoreHumanCuriosity(product: MyfansProduct, hasVisualEvidence: boolean, hasComparison: boolean) {
  return Math.min(20, (hasVisualEvidence ? 12 : 0) + (hasComparison ? 6 : 0) + (product.title.length >= 8 ? 2 : 0));
}

function scoreSocialProofMomentum(product: MyfansProduct, quote: MyfansQuoteCandidate | null) {
  return Math.min(15, ((quote?.views ?? 0) >= 50_000 ? 6 : 0) + ((quote?.likes ?? 0) >= 1000 ? 5 : 0) + (product.likes_count >= 80 ? 4 : 0));
}

function scoreVisualStoryValue(quote: MyfansQuoteCandidate | null, hasVisualEvidence: boolean) {
  return Math.min(15, hasVisualEvidence ? 15 : quote && hasBrowserVisibleVisual(quote) ? 8 : 0);
}

function topicValueBreakdown(product: MyfansProduct, quote: MyfansQuoteCandidate | null, signal: ReturnType<typeof collectMyfansTopicEvidence>): TopicValueBreakdown {
  const hasComparison = signal.evidence.some((item) => /中央値|上位|同価格帯|通常/.test(item));
  const hasVisualEvidence = signal.evidence.some((item) => item.startsWith("verified visual"));
  return {
    surprise: scoreSurprise(product, hasComparison, signal.quoteViewPercentile),
    concreteDifference: scoreConcreteDifference(product, signal.creatorMedianLikes, signal.bucketMedianLikes),
    humanCuriosity: scoreHumanCuriosity(product, hasVisualEvidence, hasComparison),
    socialProofMomentum: scoreSocialProofMomentum(product, quote),
    visualStoryValue: scoreVisualStoryValue(quote, hasVisualEvidence),
    explainability: Math.min(10, signal.evidence.length ? 10 : 0),
  };
}

function applyReasonTopicScoreFloors(score: number, reasons: MyfansReasonToCare[]) {
  if (reasons.includes("ranking_anomaly")) score = Math.max(score, 82);
  if (reasons.includes("creator_outlier") || reasons.includes("clear_comparison")) score = Math.max(score, 84);
  if (reasons.includes("rapid_growth") || reasons.includes("visual_gap") || reasons.includes("rare_visual_moment")) score = Math.max(score, 86);
  return score;
}

function applyAuthorityTopicScoreFloor(score: number, role: DailyRole, evidence: string[]) {
  if (role === "AUTHORITY" && evidence.length >= 2) return Math.min(100, score + 8);
  return score;
}

function applyTopicScoreFloors(score: number, reasons: MyfansReasonToCare[], role: DailyRole, evidence: string[]) {
  return applyAuthorityTopicScoreFloor(applyReasonTopicScoreFloors(score, reasons), role, evidence);
}

function joinedVisualEvidence(visual: ReturnType<typeof visualUnderstandingFor> | null) {
  if (!visual) return "";
  return [visual.attentionMoment, visual.humanObservation, visual.concreteVisualCue, visual.rawVisualEvidence].join(" ");
}

function hasWeakBackgroundOnlyEvidence(visual: ReturnType<typeof visualUnderstandingFor> | null, joined: string) {
  return Boolean(visual && /白い部屋|白っぽい部屋|プロフィール画面|タイトル|条件/.test(joined)
    && !/くま|踊|青|赤|黒|ランジェリー|向かい合|近さ|近め|全身|制服|階段|表情|切り替わ|変わる/.test(joined));
}

function hasPriceOnlyRejection(product: MyfansProduct, hasComparison: boolean, hasVisualEvidence: boolean) {
  return product.price > 0 && !hasComparison && !hasVisualEvidence;
}

function hasMetricsOnlyRejection(product: MyfansProduct, hasComparison: boolean, hasVisualEvidence: boolean) {
  return !hasComparison && !hasVisualEvidence
    && Boolean(product.likes_count > 0 || product.saves_count > 0 || product.popularity_rank);
}

function hasWeakBackgroundOnlyRejection(
  visual: ReturnType<typeof visualUnderstandingFor> | null,
  hasComparison: boolean,
) {
  return hasWeakBackgroundOnlyEvidence(visual, joinedVisualEvidence(visual)) && !hasComparison;
}

function topicValueRejectionReasons(product: MyfansProduct, hasComparison: boolean, hasVisualEvidence: boolean, reasons: MyfansReasonToCare[], visual: ReturnType<typeof visualUnderstandingFor> | null) {
  const rejectionCandidates = [
    { rejected: hasPriceOnlyRejection(product, hasComparison, hasVisualEvidence), reason: "価格単独で比較根拠なし" },
    { rejected: hasMetricsOnlyRejection(product, hasComparison, hasVisualEvidence), reason: "数字単独でbaseline差なし" },
    { rejected: hasWeakBackgroundOnlyRejection(visual, hasComparison), reason: "背景/プロフィール/距離感だけで話す価値が弱い" },
    { rejected: !reasons.length, reason: "reason_to_careを根拠付きで選べません" },
  ];
  return rejectionCandidates.filter((candidate) => candidate.rejected).map((candidate) => candidate.reason);
}

function topicValueVerdict(score: number, threshold: number, reasons: MyfansReasonToCare[], evidence: string[], whyRejected: string[]) {
  return score >= threshold && reasons.length && evidence.length && !whyRejected.length ? "PASS" : "LOW_TOPIC_VALUE";
}

export function evaluateMyfansTopicValue(input: {
  product: MyfansProduct;
  quote: MyfansQuoteCandidate | null;
  role: DailyRole;
  baselines: MyfansTopicBaselines;
}): MyfansTopicValue {
  const { product, quote, role, baselines } = input;
  const signal = collectMyfansTopicEvidence(product, quote, baselines);
  const breakdown = topicValueBreakdown(product, quote, signal);
  const initialScore = breakdown.surprise + breakdown.concreteDifference + breakdown.humanCuriosity + breakdown.socialProofMomentum + breakdown.visualStoryValue + breakdown.explainability;
  let score = applyTopicScoreFloors(initialScore, signal.reasons, role, signal.evidence);
  const hasComparison = signal.evidence.some((item) => /中央値|上位|同価格帯|通常/.test(item));
  const hasVisualEvidence = signal.evidence.some((item) => item.startsWith("verified visual"));
  const whyRejected = topicValueRejectionReasons(product, hasComparison, hasVisualEvidence, signal.reasons, signal.visual);
  if (whyRejected.length) score = Math.min(score, 74);
  const threshold = topicThresholdFor(role);
  const verdict = topicValueVerdict(score, threshold, signal.reasons, signal.evidence, whyRejected);
  return {
    score,
    verdict,
    reasonToCare: verdict === "PASS" ? signal.reasons[0] : null,
    evidence: signal.evidence,
    baseline: signal.baseline,
    whyRejected: verdict === "PASS" ? [] : (whyRejected.length ? whyRejected : [`Topic Value ${threshold}未満`]),
    breakdown,
  };
}

function quoteViewDiscoveryInsight(reason: MyfansReasonToCare, evidence: string) {
  const quoteViews = evidence.match(/X表示([0-9,，]+)/)?.[1]?.replace(/[，,]/g, "");
  if (!(reason === "rapid_growth" || reason === "unexpected_popularity") || !quoteViews) return null;
  const views = Number(quoteViews);
  const line = Number.isFinite(views) && views >= 10_000
    ? `${Math.floor(views / 10_000)}万回も見られているなら、流れてきた理由がある。`
    : evidence;
  return { line, value: "桁だけで押さず、元投稿の場面まで確認できる時だけ使いたい。" };
}

type TopicReasonInsight = {
  value: string;
  lineFromEvidence?: (evidence: string) => string;
};

const comparisonTopicInsight: TopicReasonInsight = { value: "価格だけではなく、同じ条件の中で反応が違う。" };
const popularityTopicInsight: TopicReasonInsight = { value: "数字だけでなく、元投稿の見せ場まで見えてから出したい。" };
const visualTopicInsight: TopicReasonInsight = {
  value: "数字より先に、見た瞬間の違いがある。",
  lineFromEvidence: (evidence) => evidence.replace(/^verified visual: /, ""),
};

const topicReasonInsights: Partial<Record<MyfansReasonToCare, TopicReasonInsight>> = {
  creator_outlier: {
    value: "普段との差が見えるから、ただの新着より先に引っかかる。",
    lineFromEvidence: (evidence) => evidence.replace(/^creator/, "creator"),
  },
  clear_comparison: comparisonTopicInsight,
  price_anomaly: comparisonTopicInsight,
  ranking_anomaly: { value: "順位だけでなく、反応まで一緒に上がっている。" },
  rapid_growth: popularityTopicInsight,
  unexpected_popularity: popularityTopicInsight,
  visual_gap: visualTopicInsight,
  rare_visual_moment: visualTopicInsight,
};

function insightForTopicReason(reason: MyfansReasonToCare, evidence: string) {
  const insight = topicReasonInsights[reason];
  return {
    line: insight?.lineFromEvidence?.(evidence) ?? evidence,
    value: insight?.value ?? "単なる条件ではなく、見た人が話せる差がある。",
  };
}

export function discoveryInsightFromTopic(topicValue: MyfansTopicValue) {
  const evidence = topicValue.evidence[0] ?? "";
  if (!topicValue.reasonToCare || !evidence) return null;
  return quoteViewDiscoveryInsight(topicValue.reasonToCare, evidence) ?? insightForTopicReason(topicValue.reasonToCare, evidence);
}
