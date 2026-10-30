import type { XCreativeAngle, XGrowthIntent, XGrowthOpportunity, XOpportunityEvent, XOpportunitySourceType } from "./xGrowthOS";
import type { XPostCandidate } from "./xPostPlanner";
import { truncateXText } from "./xText";
import { buildVisualVideoFacts, visualFactScores } from "./xVisualVideoFacts";
import { decisionFactProofLine, type DecisionFacts } from "@/lib/domain/decisionFacts";
import { daysSince, hoursUntil } from "./xGrowthTime";

export const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function compareOpportunitiesByPeakScore(
  a: Pick<XGrowthOpportunity, "reachScore" | "followScore" | "authorityScore" | "revenueScore">,
  b: Pick<XGrowthOpportunity, "reachScore" | "followScore" | "authorityScore" | "revenueScore">,
) {
  const aMax = Math.max(a.reachScore, a.followScore, a.authorityScore, a.revenueScore);
  const bMax = Math.max(b.reachScore, b.followScore, b.authorityScore, b.revenueScore);
  return bMax - aMax;
}

export function presentationDecisionFactsForSource(
  facts: DecisionFacts | null | undefined,
  sourceType: XOpportunitySourceType,
): DecisionFacts | null | undefined {
  if (!facts) return facts;
  const primary = sourceType === "HIDDEN_GEM" && facts.eligibleDecisionTypes.includes("HIDDEN_VALUE")
    ? "HIDDEN_VALUE"
    : facts.decisionType;
  return primary === facts.decisionType ? facts : { ...facts, decisionType: primary };
}


function mediaLabel(mediaType: XGrowthOpportunity["mediaType"]) {
  const labels: Record<XGrowthOpportunity["mediaType"], string> = {
    existing_link_image: "既存リンク画像",
    sample_movie: "権利確認済みmp4",
    data_card: "データカード",
    text: "テキストのみ",
    quote: "引用候補",
  };
  return labels[mediaType];
}

export function recommendedTimeLabel(slot: XPostCandidate["recommendedSlot"]) {
  if (slot === "morning") return "朝 8:30";
  if (slot === "lunch") return "昼 12:30";
  return "夜 22:30";
}

function saleFreshnessScore(item: XPostCandidate, saleHours: number) {
  if (!item.saleEndAt) return item.discountRate > 0 ? 55 : 35;
  if (saleHours <= 0) return 0;
  if (saleHours <= 24) return 96;
  if (saleHours <= 72) return 82;
  if (saleHours <= 120) return 58;
  return 35;
}

function priceChangeFreshnessScore(priceAge: number) {
  return priceAge <= 1 ? 92 : priceAge <= 2 ? 76 : priceAge <= 4 ? 54 : 24;
}

function rankingVelocityFreshnessScore(item: XPostCandidate) {
  if (!item.ranking) return 30;
  if (item.ranking <= 10) return 86;
  if (item.ranking <= 30) return 74;
  if (item.ranking <= 80) return 58;
  return 42;
}

function opportunityFreshnessScore(item: XPostCandidate, eventType: XOpportunityEvent, saleScore: number, priceChangeScore: number, rankingVelocityScore: number) {
  if (eventType === "price_anomaly") return Math.max(saleScore, priceChangeScore);
  if (eventType === "ranking_velocity") return rankingVelocityScore;
  return Math.max(priceChangeScore, item.discoveryScore ?? 0, item.buyTimingScore ?? 0, 45);
}

function freshnessExpired(item: XPostCandidate, saleHours: number, priceAge: number) {
  const priceFreshnessRequired = item.sourceType === "PRICE_EVENT" || item.sourceType === "MONEY";
  return Boolean(item.saleEndAt && saleHours <= 0) || (priceFreshnessRequired && priceAge > 5);
}

function freshnessReasons(item: XPostCandidate, saleHours: number, priceAge: number) {
  const saleReason = item.saleEndAt
    ? saleHours <= 0 ? "セール終了済み" : `セール終了まで約${Math.max(1, Math.round(saleHours))}時間`
    : item.discountRate > 0 ? "セール中だが終了時刻は未取得" : "セール期限の強い根拠なし";
  return [
    saleReason,
    priceAge === Infinity ? "価格更新日は未取得" : `価格更新から約${Math.max(0, Math.round(priceAge))}日`,
    item.ranking ? `ランキング現在${item.ranking}位。速度履歴は未接続` : "ランキング未取得",
  ];
}

function buildFreshness(item: XPostCandidate, eventType: XOpportunityEvent) {
  const saleHours = hoursUntil(item.saleEndAt);
  const priceAge = daysSince(item.checkedAt);
  const saleScore = saleFreshnessScore(item, saleHours);
  const priceChangeScore = priceChangeFreshnessScore(priceAge);
  const rankingVelocityScore = rankingVelocityFreshnessScore(item);
  const opportunityScore = opportunityFreshnessScore(item, eventType, saleScore, priceChangeScore, rankingVelocityScore);
  const total = clamp(opportunityScore * 0.35 + saleScore * 0.25 + priceChangeScore * 0.25 + rankingVelocityScore * 0.15);
  const expired = freshnessExpired(item, saleHours, priceAge);
  return {
    opportunityScore: clamp(opportunityScore),
    saleScore: clamp(saleScore),
    priceChangeScore: clamp(priceChangeScore),
    rankingVelocityScore: clamp(rankingVelocityScore),
    total,
    status: expired ? "expired" as const : total >= 72 ? "fresh" as const : "aging" as const,
    reasons: freshnessReasons(item, saleHours, priceAge),
  };
}

function inferEvent(candidate: XPostCandidate): XOpportunityEvent {
  if (candidate.decisionFacts?.decisionType === "RECORD_LOW" || candidate.decisionFacts?.decisionType === "HIGH_DISCOUNT_NOT_LOW") return "price_anomaly";
  if (candidate.decisionFacts?.decisionType === "HIDDEN_VALUE") return "hidden_gem";
  if (candidate.category === "today_buy" || candidate.category === "deal") return "price_anomaly";
  if (candidate.category === "today_discovery" || candidate.category === "hidden_gem") return "hidden_gem";
  if (candidate.category === "actress_best" || candidate.category === "maker_best") return "creator_trend";
  if (candidate.category === "series_best") return "series_trend";
  if (candidate.category === "genre_best") return "genre_trend";
  if ((candidate.ranking ?? 999) <= 30) return "ranking_velocity";
  if ((candidate.reviewAverage ?? 0) >= 4.5 && candidate.reviewCount >= 10) return "review_anomaly";
  return "traffic_velocity";
}

function intentFor(eventType: XOpportunityEvent, revenueScore: number, reachScore: number): XGrowthIntent {
  if (revenueScore >= 82 && reachScore < 78) return "MONEY";
  if (eventType === "creator_trend") return "CONVERSATION";
  if (eventType === "genre_trend" || eventType === "series_trend") return "AUTHORITY";
  if (reachScore >= 82) return "REACH";
  return "FOLLOW";
}

function topicFor(candidate: XPostCandidate, eventType: XOpportunityEvent) {
  const title = truncateXText(candidate.title, 46);
  const topics: Record<XOpportunityEvent, string> = {
    price_anomaly: `過去価格と比べて今日話す価値がある値動き: ${title}`,
    ranking_velocity: `ランキング上位化を追う価値がある作品: ${title}`,
    review_anomaly: `評価とレビュー数のズレが目立つ作品: ${title}`,
    hidden_gem: `高評価なのに埋もれている候補: ${title}`,
    traffic_velocity: `X経由の反応を検証する候補: ${title}`,
    creator_trend: `女優・メーカー軸で拾う候補: ${title}`,
    series_trend: `シリーズ単位で続報化できる候補: ${candidate.seriesName ?? title}`,
    genre_trend: `ジャンル単位で比較できる候補: ${candidate.title}`,
  };
  return topics[eventType];
}

function forceIntentForSource(sourceType: XOpportunitySourceType, fallback: XGrowthIntent): XGrowthIntent {
  if (sourceType === "MARKET" || sourceType === "COMPARISON" || sourceType === "JUDGMENT" || sourceType === "HIDDEN_GEM" || sourceType === "PRICE_EVENT") return "REACH";
  if (sourceType === "FOLLOW_UP" || sourceType === "ACTRESS_TREND" || sourceType === "GENRE_TREND" || sourceType === "MAKER_TREND") return "AUTHORITY";
  if (sourceType === "MONEY") return "MONEY";
  return fallback;
}

function angleForSource(sourceType: XOpportunitySourceType): XCreativeAngle {
  const map: Record<XOpportunitySourceType, XCreativeAngle> = {
    WORK: "HIDDEN_GEM",
    MARKET: "MARKET",
    FOLLOW_UP: "FOLLOW_UP",
    COMPARISON: "COMPARISON",
    JUDGMENT: "JUDGMENT",
    ACTRESS_TREND: "ACTRESS_FIT",
    GENRE_TREND: "GENRE_OBSERVATION",
    MAKER_TREND: "MAKER_OBSERVATION",
    PRICE_EVENT: "PRICE_EVENT",
    HIDDEN_GEM: "HIDDEN_GEM",
    MONEY: "PRICE_EVENT",
  };
  return map[sourceType];
}

type AddCreativeSupplyAngle = (candidate: XPostCandidate, sourceType: XOpportunitySourceType, suffix: string, category?: XPostCandidate["category"]) => void;

function addVisualSupplyAngles(candidate: XPostCandidate, add: AddCreativeSupplyAngle) {
  const tags = candidate.sampleMovieUrl ? ["VIDEO_FIRST" as const] : [];
  if (tags.includes("VIDEO_FIRST")) add(candidate, "WORK", "video-first", "today_discovery");
  if (candidate.actress) add(candidate, "ACTRESS_TREND", "actress-fit", "actress_best");
  if (candidate.sampleMovieUrl && candidate.imageUrl) add(candidate, "WORK", "visual-mismatch", "today_discovery");
}

function addEvidenceSupplyAngles(candidate: XPostCandidate, add: AddCreativeSupplyAngle) {
  if (candidate.discountRate >= 20 || candidate.isNinetyDayLow || candidate.saleEndAt) add(candidate, "PRICE_EVENT", "price-event", "today_buy");
  if ((candidate.reviewAverage ?? 0) >= 4.4 || candidate.reviewCount >= 20) add(candidate, "JUDGMENT", "review-signal", "review_gap");
  if ((candidate.discoveryScore ?? candidate.score) >= 60 || (candidate.reviewAverage ?? 0) >= 4.5) add(candidate, "HIDDEN_GEM", "hidden-gem", "discovery_gap");
  if (candidate.genre || candidate.discountRate >= 20) add(candidate, "COMPARISON", "comparison", "comparison_pick");
  if (candidate.discountRate >= 30 || (candidate.reviewAverage && candidate.reviewAverage < 4.3)) add(candidate, "JUDGMENT", "judgment", "judgment_pick");
}

function addContextSupplyAngles(candidate: XPostCandidate, add: AddCreativeSupplyAngle) {
  if (candidate.ranking || candidate.genre) add(candidate, "MARKET", "market", "market_scan");
  if (candidate.genre) add(candidate, "GENRE_TREND", "genre-observation", "genre_best");
  if (candidate.maker) add(candidate, "MAKER_TREND", "maker-observation", "maker_best");
  if (candidate.seriesName || candidate.seriesObservationCount >= 2) add(candidate, "FOLLOW_UP", "follow-up", "series_best");
  if (candidate.xPageViews >= 2 || candidate.xFanzaClicks >= 1) add(candidate, "MONEY", "money", "today_buy");
}

export function expandCreativeSupply(candidates: XPostCandidate[]): XPostCandidate[] {
  const expanded = new Map<string, XPostCandidate>();
  const add: AddCreativeSupplyAngle = (candidate, sourceType, suffix, category = candidate.category) => {
    const key = `${candidate.key}-${suffix}`;
    expanded.set(key, {
      ...candidate,
      key,
      category,
      sourceType,
      decisionFacts: presentationDecisionFactsForSource(candidate.decisionFacts, sourceType) ?? candidate.decisionFacts,
      selectionReason: `${candidate.selectionReason} angle:${suffix}`,
    });
  };
  for (const candidate of candidates) {
    add(candidate, candidate.sourceType, "base");
    addVisualSupplyAngles(candidate, add);
    addEvidenceSupplyAngles(candidate, add);
    addContextSupplyAngles(candidate, add);
  }
  return [...expanded.values()];
}

function baseOpportunityScoreSignals(candidate: XPostCandidate) {
  return {
    priceSignal: candidate.decisionFacts?.decisionType === "RECORD_LOW" ? 24 : candidate.isNinetyDayLow ? 24 : candidate.previousPrice ? 16 : candidate.discountRate >= 30 ? 10 : 0,
    reviewSignal: (candidate.reviewAverage ?? 0) >= 4.5 ? 16 : (candidate.reviewAverage ?? 0) >= 4 ? 9 : 0,
    rankSignal: candidate.ranking ? Math.max(0, 26 - Math.min(candidate.ranking, 100) / 4) : 4,
    trafficSignal: Math.min(candidate.xPageViews * 2 + candidate.xFanzaClicks * 10, 28),
    discoverySignal: Math.max(candidate.discoveryScore ?? 0, candidate.buyTimingScore ?? 0, candidate.score) / 4,
  };
}

function opportunityScores(candidate: XPostCandidate, eventType: XOpportunityEvent, base: ReturnType<typeof baseOpportunityScoreSignals>) {
  const hasVideo = candidate.creativeKind !== "comparison";
  return {
    reachScore: clamp(28 + base.rankSignal + base.reviewSignal + (hasVideo ? 10 : 0) + (eventType === "hidden_gem" ? 12 : 0)),
    followScore: clamp(30 + base.discoverySignal + base.reviewSignal + (eventType === "genre_trend" || eventType === "series_trend" ? 12 : 0)),
    authorityScore: clamp(34 + base.priceSignal + base.discoverySignal + (candidate.chartPoints.length >= 2 ? 14 : 0)),
    revenueScore: clamp(28 + base.priceSignal + base.trafficSignal + Math.min(candidate.xCtr * 3, 18) + (candidate.currentPrice ? 6 : 0) + (candidate.salesScoreBonus ?? 0)),
  };
}

function chooseOpportunityMedia(candidate: XPostCandidate, sourceIntent: XGrowthIntent, hasVideo: boolean): { mediaType: XGrowthOpportunity["mediaType"], mediaUsage: XGrowthOpportunity["mediaUsage"] } {
  const mediaType = sourceIntent === "MONEY" ? "existing_link_image" : hasVideo && candidate.sampleMovieUrl ? "sample_movie" : candidate.imageUrl ? "data_card" : "text";
  return { mediaType, mediaUsage: mediaType === "existing_link_image" ? "allowed" as const : "technical_unchecked" as const };
}

function sourceEvidenceFor(candidate: XPostCandidate) {
  return [
    candidate.sourceType,
    candidate.sampleMovieUrl ? "sample_movieあり" : "",
    candidate.actress ? `actress:${candidate.actress.split(/[,、/]/)[0]?.trim()}` : "",
    candidate.genre ? `genre:${candidate.genre.split(/[,、/]/)[0]?.trim()}` : "",
    candidate.discountRate ? `discount:${candidate.discountRate}%` : "",
    candidate.reviewAverage ? `review:${candidate.reviewAverage.toFixed(1)}` : "",
    candidate.salesScoreBonus ? candidate.salesReason ?? "" : "",
    decisionFactProofLine(candidate.decisionFacts),
  ].filter(Boolean);
}

function opportunityEvidenceFor(candidate: XPostCandidate) {
  return [
    candidate.selectionReason,
    decisionFactProofLine(candidate.decisionFacts),
    candidate.previousPrice && candidate.currentPrice ? `価格: ${candidate.previousPrice}円から${candidate.currentPrice}円` : "",
    candidate.ranking ? `ランキング: ${candidate.ranking}位` : "",
    candidate.reviewAverage ? `評価: ${candidate.reviewAverage.toFixed(1)} / レビュー${candidate.reviewCount}件` : "",
    candidate.xPageViews ? `X流入: ${candidate.xPageViews}PV / FANZA ${candidate.xFanzaClicks}` : "X流入はこれから検証",
  ].filter(Boolean);
}

function creativeGenomeFor(candidate: XPostCandidate, eventType: XOpportunityEvent, intent: XGrowthIntent, mediaType: XGrowthOpportunity["mediaType"]) {
  return {
    topic: eventType,
    intent,
    hook: candidate.hookType,
    proof: candidate.chartPoints.length >= 2 ? "price_history" : candidate.reviewCount ? "review" : "score",
    structure: intent === "MONEY" ? "story_then_link" : "story_first",
    emotion: eventType.includes("anomaly") || eventType === "hidden_gem" ? "curiosity" : "confidence",
    length: candidate.weightedLength <= 160 ? "short" : "medium",
    media: mediaType,
    cta: candidate.ctaStrategy,
    linkStrategy: intent === "MONEY" ? candidate.linkStrategy : "no_link_or_profile",
    postingSlot: candidate.recommendedSlot,
  };
}

export function scoreOpportunity(candidate: XPostCandidate): XGrowthOpportunity {
  const eventType = inferEvent(candidate);
  const hasVideo = candidate.creativeKind !== "comparison";
  const scores = opportunityScores(candidate, eventType, baseOpportunityScoreSignals(candidate));
  const intent = intentFor(eventType, scores.revenueScore, scores.reachScore);
  const sourceIntent = forceIntentForSource(candidate.sourceType, intent);
  const { mediaType, mediaUsage } = chooseOpportunityMedia(candidate, sourceIntent, hasVideo);
  const freshness = buildFreshness(candidate, eventType);
  const visualFacts = buildVisualVideoFacts({ imageUrl: candidate.imageUrl, sampleMovieUrl: candidate.sampleMovieUrl });
  return {
    ...candidate,
    creativeAngle: angleForSource(candidate.sourceType),
    sourceEvidence: sourceEvidenceFor(candidate),
    eventType,
    sourceType: candidate.sourceType,
    topic: topicFor(candidate, eventType),
    intent: sourceIntent,
    ...scores,
    mediaType,
    mediaUsage,
    canNativeVideo: mediaType === "sample_movie" && mediaUsage === "allowed",
    recommendedMediaUrl: mediaType === "existing_link_image" ? candidate.imageUrl : mediaType === "sample_movie" ? candidate.sampleMovieUrl : null,
    mediaDecision: mediaType === "sample_movie" ? "mp4候補は存在。technical probe後に動画供給へ判定します。" : `${mediaLabel(mediaType)}を仮選択。素材状態を再評価します。`,
    visualFacts,
    visualScoring: visualFactScores(visualFacts),
    rankingHistory: {
      status: "accumulating",
      previousRanking: null,
      rankingDelta: null,
      observations: 0,
    },
    freshness,
    evidence: opportunityEvidenceFor(candidate),
    creativeGenome: creativeGenomeFor(candidate, eventType, sourceIntent, mediaType),
  };
}

