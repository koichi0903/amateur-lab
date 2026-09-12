import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import type { FanzaXGrowth } from "@/lib/fanzaXAccountGrowth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildXCreativeVariants, calculateHookScore, type XCreativeVariant } from "@/lib/xCreativeEngine";
import { getXPostCandidates, type XPostCandidate } from "@/lib/xPostPlanner";
import type { XCreativeLearningRow, XPostLog, XPostOutcome } from "@/lib/xPostLogs";
import { truncateXText } from "@/lib/xText";
import {
  applyMediaRights,
  buildConversationRadarFromData,
  buildSeriesIdeas,
  buildStrategicMission,
  checkXReadOnlyConnectionStatus,
  fetchRankingSnapshotHistory,
  fetchMediaAssets,
  getPersistedGrowthTables,
  getXGrowthSystemStatus,
  persistRankingSnapshots,
  persistCreativeLearning,
  persistOpportunities,
  persistDailyTopPicks,
  upsertDailyPlan,
  type XGrowthSystemStatus,
} from "@/lib/xGrowthOperations";
import { getXMediaSupplyStatus, getRightsReviewQueue, isUsableXMediaAsset, type XMediaAsset } from "@/lib/xMediaAssets";

export type XGrowthIntent = "REACH" | "AUTHORITY" | "FOLLOW" | "CONVERSATION" | "MONEY";
export type XOpportunityEvent =
  | "price_anomaly"
  | "ranking_velocity"
  | "review_anomaly"
  | "hidden_gem"
  | "traffic_velocity"
  | "creator_trend"
  | "series_trend"
  | "genre_trend";
export type XOpportunitySourceType = XPostCandidate["sourceType"];
export type XCreativeAngle =
  | "VIDEO_FIRST"
  | "ACTRESS_FIT"
  | "VISUAL_MISMATCH"
  | "PRICE_EVENT"
  | "REVIEW_SIGNAL"
  | "HIDDEN_GEM"
  | "COMPARISON"
  | "JUDGMENT"
  | "MARKET"
  | "GENRE_OBSERVATION"
  | "MAKER_OBSERVATION"
  | "SERIES_OBSERVATION"
  | "FOLLOW_UP";

export type XGrowthOpportunity = XPostCandidate & {
  creativeAngle: XCreativeAngle;
  sourceEvidence: string[];
  eventType: XOpportunityEvent;
  sourceType: XOpportunitySourceType;
  topic: string;
  intent: XGrowthIntent;
  reachScore: number;
  followScore: number;
  authorityScore: number;
  revenueScore: number;
  mediaType: "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";
  mediaUsage: "allowed" | "rights_unchecked" | "not_available";
  canNativeVideo: boolean;
  mediaAsset?: Partial<XMediaAsset> | null;
  recommendedMediaUrl: string | null;
  mediaDecision: string;
  rankingHistory: {
    status: "accumulating" | "ready";
    previousRanking: number | null;
    rankingDelta: number | null;
    observations: number;
  };
  freshness: {
    opportunityScore: number;
    saleScore: number;
    priceChangeScore: number;
    rankingVelocityScore: number;
    total: number;
    status: "fresh" | "aging" | "expired";
    reasons: string[];
  };
  evidence: string[];
  creativeGenome: {
    topic: string;
    intent: XGrowthIntent;
    hook: string;
    proof: string;
    structure: string;
    emotion: string;
    length: string;
    media: string;
    cta: string;
    linkStrategy: string;
    postingSlot: string;
  };
};

export type XDailyTopPick = XGrowthOpportunity & {
  pickOrder: number;
  role: XGrowthIntent;
  dailyScore: number;
  recommendedTimeLabel: string;
  whyToday: string[];
  whyBuzz: string;
  notPostReason: string | null;
  alternativeReason: string | null;
  setDiversity: {
    status: "OK" | "NG";
    roleLabel: string;
    signature: {
      openingPattern: string;
      sentenceStructure: string;
      judgmentPhrase: string;
      subjectStructure: string;
      intent: XGrowthIntent;
      sourceType: XOpportunitySourceType;
      hookType: string;
      emotionalAngle: string;
      mediaType: XGrowthOpportunity["mediaType"];
      ctaStrategy: string;
      linkStrategy: string;
    };
    reasons: string[];
  };
};

export type XDailyMission = {
  bottleneck: "Reach不足" | "Profile Visit不足" | "Follow不足" | "Site Visit不足" | "Affiliate Click不足" | "収益導線不足" | "会話接点不足" | "最適化段階";
  title: string;
  reason: string;
  mix: Record<XGrowthIntent, number>;
  actions: Array<{ intent: XGrowthIntent; label: string; detail: string }>;
};

export type XGrowthAudit = {
  reuse: string[];
  replace: string[];
  retire: string[];
};

export type XGrowthOS = {
  opportunities: XGrowthOpportunity[];
  dailyTopPicks: XDailyTopPick[];
  dailyNoPostReason: string | null;
  mission: XDailyMission;
  audit: XGrowthAudit;
  conversationRadar: Array<{ key: string; target: string; query: string; suggestedAction: string }>;
  seriesIdeas: Array<{ key: string; title: string; detail: string }>;
  learning: Array<{ key: string; label: string; finding: string; strength: "strong" | "watch" | "weak" }>;
  manualMetrics: string[];
  dailyPlan: Record<string, unknown> | null;
  persistedOpportunities: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  systemStatus: XGrowthSystemStatus;
  mediaSupply: Awaited<ReturnType<typeof getXMediaSupplyStatus>>;
  rightsReviewQueue: Awaited<ReturnType<typeof getRightsReviewQueue>>["rows"];
  supplyDiagnostics: {
    target: "通常3件" | "本日2件" | "本日1件" | "本日0件";
    gateOkBySource: Record<string, number>;
    generatedBySource: Record<string, number>;
    humanVoiceNgBySource: Record<string, number>;
    nativeVoiceNgBySource: Record<string, number>;
    crossPostDiversityRejected: number;
    generatedByRole: Record<XGrowthIntent, number>;
    gateOkByRole: Record<XGrowthIntent, number>;
    shortagesByRole: Record<XGrowthIntent, number>;
    reachGenerated: number;
    reachGateOk: number;
    shortages: string[];
  };
  nativeXLearning: {
    overusedPatterns: string[];
    winningPatterns: string[];
    avoidConstructions: string[];
  };
  performanceTimings: Record<string, number>;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const DAY_MS = 86_400_000;

function daysSince(value: string | null) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / DAY_MS) : Infinity;
}

function hoursUntil(value: string | null) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? (time - Date.now()) / 3_600_000 : Infinity;
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

function recommendedTimeLabel(slot: XPostCandidate["recommendedSlot"]) {
  if (slot === "morning") return "朝 8:30";
  if (slot === "lunch") return "昼 12:30";
  return "夜 22:30";
}

function buildFreshness(item: XPostCandidate, eventType: XOpportunityEvent) {
  const saleHours = hoursUntil(item.saleEndAt);
  const priceAge = daysSince(item.checkedAt);
  const saleScore = !item.saleEndAt ? (item.discountRate > 0 ? 55 : 35)
    : saleHours <= 0 ? 0
      : saleHours <= 24 ? 96
        : saleHours <= 72 ? 82
          : saleHours <= 120 ? 58
            : 35;
  const priceChangeScore = priceAge <= 1 ? 92 : priceAge <= 2 ? 76 : priceAge <= 4 ? 54 : 24;
  const rankingVelocityScore = item.ranking
    ? item.ranking <= 10 ? 86 : item.ranking <= 30 ? 74 : item.ranking <= 80 ? 58 : 42
    : 30;
  const opportunityScore = eventType === "price_anomaly"
    ? Math.max(saleScore, priceChangeScore)
    : eventType === "ranking_velocity"
      ? rankingVelocityScore
      : Math.max(priceChangeScore, item.discoveryScore ?? 0, item.buyTimingScore ?? 0, 45);
  const total = clamp(opportunityScore * 0.35 + saleScore * 0.25 + priceChangeScore * 0.25 + rankingVelocityScore * 0.15);
  const priceFreshnessRequired = item.sourceType === "PRICE_EVENT" || item.sourceType === "MONEY";
  const expired = Boolean(item.saleEndAt && saleHours <= 0) || (priceFreshnessRequired && priceAge > 5);
  return {
    opportunityScore: clamp(opportunityScore),
    saleScore: clamp(saleScore),
    priceChangeScore: clamp(priceChangeScore),
    rankingVelocityScore: clamp(rankingVelocityScore),
    total,
    status: expired ? "expired" as const : total >= 72 ? "fresh" as const : "aging" as const,
    reasons: [
      item.saleEndAt ? saleHours <= 0 ? "セール終了済み" : `セール終了まで約${Math.max(1, Math.round(saleHours))}時間` : item.discountRate > 0 ? "セール中だが終了時刻は未取得" : "セール期限の強い根拠なし",
      priceAge === Infinity ? "価格更新日は未取得" : `価格更新から約${Math.max(0, Math.round(priceAge))}日`,
      item.ranking ? `ランキング現在${item.ranking}位。速度履歴は未接続` : "ランキング未取得",
    ],
  };
}

function inferEvent(candidate: XPostCandidate): XOpportunityEvent {
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

function expandCreativeSupply(candidates: XPostCandidate[]): XPostCandidate[] {
  const expanded = new Map<string, XPostCandidate>();
  const add = (candidate: XPostCandidate, sourceType: XOpportunitySourceType, suffix: string, category = candidate.category) => {
    const key = `${candidate.key}-${suffix}`;
    expanded.set(key, {
      ...candidate,
      key,
      category,
      sourceType,
      selectionReason: `${candidate.selectionReason} angle:${suffix}`,
    });
  };
  for (const candidate of candidates) {
    add(candidate, candidate.sourceType, "base");
    const tags = candidate.sampleMovieUrl ? ["VIDEO_FIRST" as const] : [];
    if (tags.includes("VIDEO_FIRST")) add(candidate, "WORK", "video-first", "today_discovery");
    if (candidate.actress) add(candidate, "ACTRESS_TREND", "actress-fit", "actress_best");
    if (candidate.sampleMovieUrl && candidate.imageUrl) add(candidate, "WORK", "visual-mismatch", "today_discovery");
    if (candidate.discountRate >= 20 || candidate.isNinetyDayLow || candidate.saleEndAt) add(candidate, "PRICE_EVENT", "price-event", "today_buy");
    if ((candidate.reviewAverage ?? 0) >= 4.4 || candidate.reviewCount >= 20) add(candidate, "JUDGMENT", "review-signal", "review_gap");
    if ((candidate.discoveryScore ?? candidate.score) >= 60 || (candidate.reviewAverage ?? 0) >= 4.5) add(candidate, "HIDDEN_GEM", "hidden-gem", "discovery_gap");
    if (candidate.genre || candidate.discountRate >= 20) add(candidate, "COMPARISON", "comparison", "comparison_pick");
    if (candidate.discountRate >= 30 || (candidate.reviewAverage && candidate.reviewAverage < 4.3)) add(candidate, "JUDGMENT", "judgment", "judgment_pick");
    if (candidate.ranking || candidate.genre) add(candidate, "MARKET", "market", "market_scan");
    if (candidate.genre) add(candidate, "GENRE_TREND", "genre-observation", "genre_best");
    if (candidate.maker) add(candidate, "MAKER_TREND", "maker-observation", "maker_best");
    if (candidate.seriesName || candidate.seriesObservationCount >= 2) add(candidate, "FOLLOW_UP", "follow-up", "series_best");
    if (candidate.xPageViews >= 2 || candidate.xFanzaClicks >= 1) add(candidate, "MONEY", "money", "today_buy");
  }
  return [...expanded.values()];
}

function scoreOpportunity(candidate: XPostCandidate): XGrowthOpportunity {
  const eventType = inferEvent(candidate);
  const hasVideo = candidate.creativeKind !== "comparison";
  const priceSignal = candidate.isNinetyDayLow ? 24 : candidate.previousPrice ? 16 : candidate.discountRate >= 30 ? 10 : 0;
  const reviewSignal = (candidate.reviewAverage ?? 0) >= 4.5 ? 16 : (candidate.reviewAverage ?? 0) >= 4 ? 9 : 0;
  const rankSignal = candidate.ranking ? Math.max(0, 26 - Math.min(candidate.ranking, 100) / 4) : 4;
  const trafficSignal = Math.min(candidate.xPageViews * 2 + candidate.xFanzaClicks * 10, 28);
  const discoverySignal = Math.max(candidate.discoveryScore ?? 0, candidate.buyTimingScore ?? 0, candidate.score) / 4;
  const reachScore = clamp(28 + rankSignal + reviewSignal + (hasVideo ? 10 : 0) + (eventType === "hidden_gem" ? 12 : 0));
  const followScore = clamp(30 + discoverySignal + reviewSignal + (eventType === "genre_trend" || eventType === "series_trend" ? 12 : 0));
  const authorityScore = clamp(34 + priceSignal + discoverySignal + (candidate.chartPoints.length >= 2 ? 14 : 0));
  const revenueScore = clamp(28 + priceSignal + trafficSignal + Math.min(candidate.xCtr * 3, 18) + (candidate.currentPrice ? 6 : 0));
  const intent = intentFor(eventType, revenueScore, reachScore);
  const sourceIntent = forceIntentForSource(candidate.sourceType, intent);
  const mediaType = sourceIntent === "MONEY" ? "existing_link_image" : hasVideo && candidate.sampleMovieUrl ? "sample_movie" : candidate.imageUrl ? "data_card" : "text";
  const mediaUsage = mediaType === "existing_link_image" ? "allowed" : "rights_unchecked";
  const freshness = buildFreshness(candidate, eventType);

  return {
    ...candidate,
    creativeAngle: angleForSource(candidate.sourceType),
    sourceEvidence: [
      candidate.sourceType,
      candidate.sampleMovieUrl ? "sample_movieあり" : "",
      candidate.actress ? `actress:${candidate.actress.split(/[,、/]/)[0]?.trim()}` : "",
      candidate.genre ? `genre:${candidate.genre.split(/[,、/]/)[0]?.trim()}` : "",
      candidate.discountRate ? `discount:${candidate.discountRate}%` : "",
      candidate.reviewAverage ? `review:${candidate.reviewAverage.toFixed(1)}` : "",
    ].filter(Boolean),
    eventType,
    sourceType: candidate.sourceType,
    topic: topicFor(candidate, eventType),
    intent: sourceIntent,
    reachScore,
    followScore,
    authorityScore,
    revenueScore,
    mediaType,
    mediaUsage,
    canNativeVideo: mediaType === "sample_movie" && mediaUsage === "allowed",
    recommendedMediaUrl: mediaType === "existing_link_image" ? candidate.imageUrl : mediaType === "sample_movie" ? candidate.sampleMovieUrl : null,
    mediaDecision: mediaType === "sample_movie" ? "mp4候補は存在。rights reviewで根拠確認後だけ動画投稿に昇格します。" : `${mediaLabel(mediaType)}を仮選択。権利確認後に再評価します。`,
    rankingHistory: {
      status: "accumulating",
      previousRanking: null,
      rankingDelta: null,
      observations: 0,
    },
    freshness,
    evidence: [
      candidate.selectionReason,
      candidate.previousPrice && candidate.currentPrice ? `価格: ${candidate.previousPrice}円から${candidate.currentPrice}円` : "",
      candidate.ranking ? `ランキング: ${candidate.ranking}位` : "",
      candidate.reviewAverage ? `評価: ${candidate.reviewAverage.toFixed(1)} / レビュー${candidate.reviewCount}件` : "",
      candidate.xPageViews ? `X流入: ${candidate.xPageViews}PV / FANZA ${candidate.xFanzaClicks}` : "X流入はこれから検証",
    ].filter(Boolean),
    creativeGenome: {
      topic: eventType,
      intent: sourceIntent,
      hook: candidate.hookType,
      proof: candidate.chartPoints.length >= 2 ? "price_history" : candidate.reviewCount ? "review" : "score",
      structure: sourceIntent === "MONEY" ? "story_then_link" : "story_first",
      emotion: eventType.includes("anomaly") || eventType === "hidden_gem" ? "curiosity" : "confidence",
      length: candidate.weightedLength <= 160 ? "short" : "medium",
      media: mediaType,
      cta: candidate.ctaStrategy,
      linkStrategy: sourceIntent === "MONEY" ? candidate.linkStrategy : "no_link_or_profile",
      postingSlot: candidate.recommendedSlot,
    },
  };
}

function withCreativeQuality(item: XGrowthOpportunity, logs: XPostLog[]): XGrowthOpportunity {
  const rankingReady = item.rankingHistory.status === "ready";
  const hookScore = calculateHookScore({
    key: item.key,
    title: item.title,
    url: item.creativeVariants[0]?.url ?? "",
    category: item.category,
    actress: item.actress,
    genre: item.genre,
    currentPrice: item.currentPrice,
    previousPrice: item.previousPrice,
    discountRate: item.discountRate,
    reviewAverage: item.reviewAverage,
    reviewCount: item.reviewCount,
    ranking: item.ranking,
    score: item.score,
    discoveryScore: item.discoveryScore,
    buyTimingScore: item.buyTimingScore,
    isNinetyDayLow: item.isNinetyDayLow,
    sampleMovieUrl: item.sampleMovieUrl,
    imageUrl: item.imageUrl,
    saleEndAt: item.saleEndAt,
    hasRightsCheckedMovie: item.canNativeVideo,
    mediaManualTags: item.mediaAsset?.manual_tags ?? [],
    mediaQuality: item.mediaAsset?.media_quality ?? "unreviewed",
    xPageViews: item.xPageViews,
    xFanzaClicks: item.xFanzaClicks,
    seriesName: item.seriesName,
    seriesObservationCount: item.seriesObservationCount,
    rankingHistoryCount: item.rankingHistory.observations,
    previousRanking: rankingReady ? item.rankingHistory.previousRanking : null,
    rankingDelta: rankingReady ? item.rankingHistory.rankingDelta : null,
    recentLogs: logs,
    radarAvailable: item.intent === "CONVERSATION" || Boolean(item.seriesName || item.actress || item.genre),
    recommendedSlot: item.recommendedSlot,
    sourceType: item.sourceType,
  });
  const variants = buildXCreativeVariants({
    key: item.key,
    title: item.title,
    url: item.creativeVariants[0]?.url ?? "",
    category: item.category,
    actress: item.actress,
    genre: item.genre,
    currentPrice: item.currentPrice,
    previousPrice: item.previousPrice,
    discountRate: item.discountRate,
    reviewAverage: item.reviewAverage,
    reviewCount: item.reviewCount,
    ranking: item.ranking,
    score: item.score,
    discoveryScore: item.discoveryScore,
    buyTimingScore: item.buyTimingScore,
    isNinetyDayLow: item.isNinetyDayLow,
    sampleMovieUrl: item.sampleMovieUrl,
    imageUrl: item.imageUrl,
    saleEndAt: item.saleEndAt,
    hasRightsCheckedMovie: item.canNativeVideo,
    mediaManualTags: item.mediaAsset?.manual_tags ?? [],
    mediaQuality: item.mediaAsset?.media_quality ?? "unreviewed",
    xPageViews: item.xPageViews,
    xFanzaClicks: item.xFanzaClicks,
    seriesName: item.seriesName,
    seriesObservationCount: item.seriesObservationCount,
    rankingHistoryCount: item.rankingHistory.observations,
    previousRanking: rankingReady ? item.rankingHistory.previousRanking : null,
    rankingDelta: rankingReady ? item.rankingHistory.rankingDelta : null,
    recentLogs: logs,
    radarAvailable: item.intent === "CONVERSATION" || Boolean(item.seriesName || item.actress || item.genre),
    recommendedSlot: item.recommendedSlot,
    sourceType: item.sourceType,
  }, hookScore);
  const recommended = variants.find((variant) => variant.intent === item.intent && variant.quality.passed)
    ?? variants.find((variant) => variant.quality.passed)
    ?? variants[0];
  const mediaType = recommended?.mediaType ?? item.mediaType;
  const nativeVideoAllowed = mediaType === "sample_movie" && item.canNativeVideo && isUsableXMediaAsset(item.mediaAsset).usable;
  const resolvedMediaType = mediaType === "sample_movie" && !nativeVideoAllowed
    ? item.imageUrl ? "existing_link_image" as const : "text" as const
    : mediaType;
  const recommendedMediaUrl = resolvedMediaType === "sample_movie"
    ? item.mediaAsset?.source_url ?? item.sampleMovieUrl
    : resolvedMediaType === "existing_link_image"
      ? item.imageUrl
      : resolvedMediaType === "data_card"
        ? `/api/admin/x-growth/media/download?workId=${item.workId}&mediaType=data_card`
      : null;
  return {
    ...item,
    creativeVariants: variants,
    postText: recommended?.bodyText ?? item.postText,
    replyText: recommended?.replyText ?? null,
    weightedLength: recommended?.weightedLength ?? item.weightedLength,
    hookScore,
    hookType: recommended?.hookType ?? item.hookType,
    creativeVariantId: recommended?.id ?? item.creativeVariantId,
    imageStrategy: recommended?.imageStrategy ?? item.imageStrategy,
    linkStrategy: recommended?.linkStrategy ?? item.linkStrategy,
    ctaStrategy: recommended?.ctaStrategy ?? item.ctaStrategy,
    mediaType: resolvedMediaType,
    mediaUsage: resolvedMediaType === "sample_movie" ? "allowed" : recommendedMediaUrl || resolvedMediaType === "text" || resolvedMediaType === "quote" ? "allowed" : "not_available",
    recommendedMediaUrl,
    mediaDecision: resolvedMediaType === "sample_movie"
      ? "権利確認済みのsample_movie_urlをネイティブ動画として使用可"
      : resolvedMediaType === "existing_link_image"
        ? item.intent === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る"
        : resolvedMediaType === "data_card"
          ? "作品画像URLを確認し、データカード素材として使用"
          : resolvedMediaType === "quote" ? "外部投稿確認後の引用候補。自動引用はしない" : "利用可能な画像/動画がないためテキストのみ",
    creativeGenome: recommended?.creativeGenome ?? item.creativeGenome,
  };
}

function applyRankingHistory(opportunities: XGrowthOpportunity[], histories: Map<number, { observations: number; previousRanking: number | null }>) {
  return opportunities.map((item) => {
    const history = histories.get(item.workId);
    const observations = history?.observations ?? 0;
    const previousRanking = history?.previousRanking ?? null;
    const rankingDelta = previousRanking && item.ranking ? previousRanking - item.ranking : null;
    return {
      ...item,
      rankingHistory: {
        status: observations >= 2 ? "ready" as const : "accumulating" as const,
        previousRanking,
        rankingDelta,
        observations,
      },
    };
  });
}

function intentPriority(mission: XDailyMission) {
  const weighted = (Object.entries(mission.mix) as Array<[XGrowthIntent, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([intent]) => intent);
  const defaults: XGrowthIntent[] = ["REACH", "FOLLOW", "AUTHORITY", "MONEY", "CONVERSATION"];
  return [...new Set([...weighted, ...defaults])];
}

function roleScore(item: XGrowthOpportunity, intent: XGrowthIntent) {
  const creative = item.creativeVariants.find((variant) => variant.intent === intent && variant.quality.passed)
    ?? item.creativeVariants.find((variant) => variant.intent === intent)
    ?? item.creativeVariants.find((variant) => variant.quality.passed)
    ?? item.creativeVariants[0];
  const base = intent === "REACH" ? item.reachScore
    : intent === "FOLLOW" ? item.followScore
      : intent === "AUTHORITY" ? item.authorityScore
        : intent === "MONEY" ? item.revenueScore
          : Math.max(item.followScore, item.authorityScore);
  const buzz = creative?.buzzPotential.total ?? creative?.quality.total ?? 0;
  const adPenalty = creative ? Math.min(18, creative.quality.dimensions.adSmell / 4) : 0;
  const roleDiversityBonus = intent === "REACH" && ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) ? 8 : 0;
  const mediaType = creative?.mediaType ?? item.mediaType;
  const mediaPriority = mediaType === "sample_movie" && item.canNativeVideo ? 18
    : mediaType === "existing_link_image" && item.imageUrl ? 12
      : item.imageUrl ? 8
        : mediaType === "data_card" && ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) ? 4
          : mediaType === "data_card" ? -8
            : mediaType === "quote" ? -20
              : 0;
  return clamp(base * 0.2 + buzz * 0.34 + item.freshness.total * 0.18 + (creative?.quality.total ?? 0) * 0.16 + roleDiversityBonus + mediaPriority - adPenalty);
}

function hasDiversityConflict(item: XGrowthOpportunity, picked: XDailyTopPick[], logs: XPostLog[]) {
  const actress = item.actress?.split(/[,、/]/)[0]?.trim();
  const genre = item.genre?.split(/[,、/]/)[0]?.trim();
  const maker = "maker" in item ? String(item.maker ?? "") : "";
  if (picked.some((pick) => pick.workId === item.workId || pick.productId === item.productId)) return true;
  if (actress && picked.some((pick) => pick.actress?.includes(actress))) return true;
  if (genre && picked.some((pick) => pick.genre?.includes(genre))) return true;
  if (maker && picked.some((pick) => "maker" in pick && String(pick.maker ?? "") === maker)) return true;
  if (picked.some((pick) => pick.sourceType === item.sourceType)) return true;
  return logs.slice(0, 8).some((log) => log.work_id === item.workId);
}

function whyToday(item: XGrowthOpportunity, role: XGrowthIntent) {
  return [
    item.canNativeVideo ? "動画で止まりやすい" : "",
    item.rankingHistory.status === "ready" && item.rankingHistory.rankingDelta && item.rankingHistory.rankingDelta >= 10 ? "昨日との差分で続報にできる" : "",
    item.imageUrl ? "画像で作品の雰囲気が一目で伝わる" : "",
    item.isNinetyDayLow || item.discountRate >= 30 ? "今日見る理由が価格で説明できる" : "",
    item.ranking && item.ranking <= 30 ? "ランキング上位なので初見でも文脈が伝わる" : "",
    item.reviewAverage && item.reviewAverage >= 4.5 ? "評価を少し添えるだけで納得感が出る" : "",
    role === "FOLLOW" ? "毎日追うアカウントとして見せやすい" : "",
    item.freshness.reasons.find((reason) => reason.includes("セール終了")) ?? "",
  ].filter(Boolean);
}

function buzzReason(item: XGrowthOpportunity, role: XGrowthIntent) {
  const variant = item.creativeVariants.find((creative) => creative.intent === role && creative.id === item.creativeVariantId)
    ?? item.creativeVariants.find((creative) => creative.intent === role)
    ?? item.creativeVariants[0];
  if (!variant) return "伸びる理由はまだ弱いため、採用は慎重に判断します。";
  if (item.canNativeVideo && variant.mediaType === "sample_movie") {
    const tags = item.mediaAsset?.manual_tags ?? [];
    return tags.includes("first_seconds_strong")
      ? "権利OK動画の最初の数秒をHookにでき、本文は1〜3行の違和感だけに絞れる。"
      : "権利OK動画を証拠にでき、本文は1〜3行の気になる理由だけに絞れる。";
  }
  if (variant.mediaType === "existing_link_image" && role !== "MONEY") return "画像で一度止めて、本文は説明ではなく見る理由だけを作れる。";
  if (variant.mediaType === "data_card" && item.sourceType === "MARKET") return "カードで比較のきっかけを作り、本文は押し売りにしない。";
  if (variant.mediaType === "data_card" && item.sourceType === "COMPARISON") return "一目で比較でき、迷っている人が最初の一本を決めやすい。";
  if (variant.mediaType === "data_card" && item.sourceType === "JUDGMENT") return "カードと短い判断で、買うより先に見る理由が伝わる。";
  if (variant.hookDirection === "contradiction") return "一目で違和感が伝わり、数字を読ませる前に興味を作れる。";
  if (variant.hookDirection === "comparison") return "ランキングだけでは拾えない候補として、比較で読まれやすい。";
  if (variant.hookDirection === "follow_up") return "続報として出せるので、反応や会話が生まれやすい。";
  if (variant.hookDirection === "confession") return "人間っぽい入り方で、知らない作品でも流されにくい。";
  return variant.buzzPotential.reason;
}

function interestAssets(item: XGrowthOpportunity, role: XGrowthIntent) {
  const strongTitleHook = item.title.length >= 18 && (item.reviewAverage ?? 0) >= 4.6 && item.reviewCount >= 20;
  return [
    item.canNativeVideo ? "権利OK動画" : "",
    item.imageUrl ? "使用可能画像" : "",
    item.ranking && item.ranking <= 30 ? "明確なランキング上位シグナル" : "",
    item.rankingHistory.status === "ready" && item.rankingHistory.rankingDelta && item.rankingHistory.rankingDelta >= 10 ? "実ランキング差分" : "",
    item.isNinetyDayLow || item.discountRate >= 30 ? "強い価格/期限シグナル" : "",
    ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) && (item.discountRate >= 30 || item.reviewAverage || item.ranking) ? "実データに基づくREACH題材" : "",
    item.saleEndAt && hoursUntil(item.saleEndAt) > 0 && hoursUntil(item.saleEndAt) <= 72 ? "期限性" : "",
    role === "CONVERSATION" && item.mediaType === "quote" && item.recommendedMediaUrl ? "実在する引用元" : "",
    strongTitleHook ? "作品名/題材フック" : "",
  ].filter(Boolean);
}

function passesLinklessQualityGate(item: XGrowthOpportunity, role: XGrowthIntent) {
  if (role === "MONEY") return true;
  const creative = item.creativeVariants.find((variant) => variant.intent === role);
  return interestAssets(item, role).length > 0 && Boolean(creative?.quality.passed);
}

function hasRealConversationSource(item: XGrowthOpportunity, role: XGrowthIntent) {
  if (role !== "CONVERSATION") return true;
  return false;
}

const SAME_DAY_LIMITED_PHRASES = [
  "タイトルだけなら流してました",
  "タイトルだけなら普通に流してました",
  "サンプルまで見ると、印象が変わるタイプ",
  "見落とすには惜しい",
  "確認していい",
  "サンプルまで見る",
  "今日見ていい",
];

function firstLine(text: string) {
  return text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function judgmentPhrase(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return [...lines].reverse().find((line) => !/^https?:\/\//.test(line) && !line.startsWith("「")) ?? "";
}

function openingPattern(text: string) {
  const line = firstLine(text);
  if (line.includes("タイトルだけ")) return "title_missed";
  if (line.includes("セール欄")) return "sale_shelf";
  if (line.includes("ランキング")) return "ranking_first";
  if (line.includes("評価")) return "rating_first";
  if (line.includes("今日の")) return "today_market";
  if (line.includes("目当て") || line.includes("女優")) return "actress_view";
  if (line.includes("似た条件") || line.includes("同じ")) return "comparison";
  if (line.includes("安い") || line.includes("価格")) return "price_event";
  return line.replace(/[0-9０-９]+/g, "#").slice(0, 18);
}

function sentenceStructure(text: string) {
  return text.split("\n").map((line) => {
    if (/^https?:\/\//.test(line)) return "link";
    if (line.startsWith("「")) return "title";
    if (/評価|レビュー|ランキング|OFF|円|過去90日/.test(line)) return "proof";
    if (/見る|判断|拾|決め|流|残|惜しい|安全/.test(line)) return "judgment";
    return "story";
  }).join(">");
}

function subjectStructure(item: XGrowthOpportunity, text: string) {
  const opening = firstLine(text);
  const actress = item.actress?.split(/[,、/]/)[0]?.trim();
  const genre = item.genre?.split(/[,、/]/)[0]?.trim();
  if (actress && opening.includes(actress)) return "actress_first";
  if (genre && opening.includes(genre)) return "genre_first";
  if (opening.includes("今日") || opening.includes("一覧") || opening.includes("セール欄")) return "market_first";
  if (opening.includes("似た") || opening.includes("同じ")) return "comparison_first";
  if (opening.includes("見送")) return "judgment_first";
  if (opening.includes("価格") || opening.includes("安い") || opening.includes("OFF")) return "price_first";
  return "work_first";
}

function sourceRoleLabel(sourceType: XOpportunitySourceType) {
  const labels: Record<XOpportunitySourceType, string> = {
    WORK: "作品を知るきっかけを作る",
    HIDDEN_GEM: "見落とし作品を拾う",
    ACTRESS_TREND: "女優の見方を変える",
    GENRE_TREND: "ジャンルの見方を変える",
    MAKER_TREND: "メーカー傾向を見る",
    MARKET: "市場全体の違和感を見る",
    COMPARISON: "比較判断を置く",
    JUDGMENT: "買う/見送る判断を置く",
    PRICE_EVENT: "今日見る理由を置く",
    FOLLOW_UP: "続報として追う",
    MONEY: "収益導線に送る",
  };
  return labels[sourceType];
}

function diversitySignature(item: XGrowthOpportunity, role: XGrowthIntent, variant: XCreativeVariant) {
  return {
    openingPattern: openingPattern(variant.bodyText),
    sentenceStructure: sentenceStructure(variant.bodyText),
    judgmentPhrase: judgmentPhrase(variant.bodyText),
    subjectStructure: subjectStructure(item, variant.bodyText),
    intent: role,
    sourceType: item.sourceType,
    hookType: variant.hookType,
    emotionalAngle: variant.hookDirection,
    mediaType: variant.mediaType === "sample_movie" && !item.canNativeVideo ? item.imageUrl ? "data_card" as const : "text" as const : variant.mediaType,
    ctaStrategy: variant.ctaStrategy,
    linkStrategy: variant.linkPlan,
  };
}

function textSimilarity(a: string, b: string) {
  const tokens = new Set(a.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const other = new Set(b.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  return [...tokens].filter((token) => other.has(token)).length / Math.max(tokens.size, other.size, 1);
}

function diversityConflicts(
  item: XGrowthOpportunity,
  role: XGrowthIntent,
  variant: XCreativeVariant,
  picked: XDailyTopPick[],
  logs: XPostLog[],
) {
  const signature = diversitySignature(item, role, variant);
  const reasons: string[] = [];
  if (item.sourceType === "PRICE_EVENT" && signature.openingPattern === "title_missed") {
    reasons.push("PRICE_EVENTは作品紹介テンプレではなく価格判断のHookを使う");
  }
  if ((item.sourceType === "MARKET" || item.sourceType === "COMPARISON" || item.sourceType === "JUDGMENT") && signature.openingPattern === "title_missed") {
    reasons.push(`${item.sourceType}は作品単体紹介テンプレではなく外向きHookを使う`);
  }
  if (item.sourceType === "ACTRESS_TREND" && signature.openingPattern === "title_missed") {
    reasons.push("ACTRESS_TRENDは作品紹介テンプレではなく女優の見方のHookを使う");
  }
  for (const phrase of SAME_DAY_LIMITED_PHRASES) {
    if (variant.bodyText.includes(phrase) && picked.some((pick) => pick.postText.includes(phrase))) {
      reasons.push(`同日judgment phrase重複: ${phrase}`);
    }
  }
  for (const pick of picked) {
    const other = pick.setDiversity.signature;
    const sameShape = [
      signature.openingPattern === other.openingPattern,
      signature.sentenceStructure === other.sentenceStructure,
      signature.judgmentPhrase === other.judgmentPhrase,
      signature.subjectStructure === other.subjectStructure,
      signature.intent === other.intent,
      signature.sourceType === other.sourceType,
      signature.emotionalAngle === other.emotionalAngle,
      signature.mediaType === other.mediaType,
      signature.linkStrategy === other.linkStrategy,
    ].filter(Boolean).length;
    if (sameShape >= 5) reasons.push(`当日セット類似: ${pick.pickOrder}件目と構造が近い`);
    if (textSimilarity(variant.bodyText, pick.postText) >= 0.58) reasons.push(`当日セット本文類似: ${pick.pickOrder}件目と近い`);
  }
  const sevenDaysAgo = Date.now() - 7 * DAY_MS;
  const recentPhraseReuse = logs.filter((log) => new Date(log.posted_at).getTime() >= sevenDaysAgo)
    .filter((log) => openingPattern(log.post_text) === signature.openingPattern || judgmentPhrase(log.post_text) === signature.judgmentPhrase)
    .length;
  if (recentPhraseReuse >= 2) reasons.push(`直近7日Novelty減点: opening/judgment同型 ${recentPhraseReuse}件`);
  return { ok: reasons.length === 0, signature, reasons };
}

function selectDiverseVariant(item: XGrowthOpportunity, role: XGrowthIntent, picked: XDailyTopPick[], logs: XPostLog[]) {
  const variants = item.creativeVariants
    .filter((variant) => variant.intent === role && variant.quality.passed)
    .filter((variant) => variant.quality.total >= (role === "REACH" ? 70 : 72) && (variant.buzzPotential.total ?? 0) >= 60 && variant.quality.dimensions.adSmell <= (role === "MONEY" ? 48 : 30))
    .map((variant) => {
      const audit = diversityConflicts(item, role, variant, picked, logs);
      const mediaBonus = picked.some((pick) => pick.mediaType !== audit.signature.mediaType) ? 4 : 0;
      const roleBonus = picked.some((pick) => pick.role !== role) ? 5 : 0;
      return { variant, audit, score: clamp((variant.buzzPotential.total ?? 0) * 0.45 + variant.quality.total * 0.25 + item.freshness.total * 0.3 + mediaBonus + roleBonus - audit.reasons.length * 18) };
    })
    .sort((a, b) => Number(b.audit.ok) - Number(a.audit.ok) || b.score - a.score);
  return variants.find((entry) => entry.audit.ok) ?? null;
}

function selectDailyTopPicks(opportunities: XGrowthOpportunity[], mission: XDailyMission, logs: XPostLog[]) {
  const missionRoles = intentPriority(mission);
  const roles: XGrowthIntent[] = [
    "REACH",
    mission.bottleneck === "Follow不足" ? "FOLLOW" : "AUTHORITY",
    ...(mission.bottleneck === "Reach不足" ? ["REACH" as const] : []),
    ...(mission.bottleneck === "Profile Visit不足" || mission.bottleneck === "Follow不足" ? ["FOLLOW" as const, "AUTHORITY" as const] : []),
    ...(mission.bottleneck === "収益導線不足" && mission.mix.MONEY <= 1 ? ["MONEY" as const] : []),
    ...missionRoles,
  ];
  const pool = opportunities.filter((item) => item.freshness.status !== "expired" && item.mediaUsage !== "not_available");
  const picked: XDailyTopPick[] = [];
  const reachVideoTier = (item: XGrowthOpportunity) => {
    const asset = item.mediaAsset;
    const tags = asset?.manual_tags ?? [];
    if (!item.canNativeVideo || !isUsableXMediaAsset(asset).usable) return { tier: "除外", score: -100, reason: "rights unusable" };
    if (tags.includes("too_explicit_for_reach") || tags.includes("weak_visual") || asset?.media_quality === "weak") return { tier: "除外", score: -90, reason: "REACH不向き/weak" };
    if (asset?.media_quality === "strong" && tags.includes("first_seconds_strong")) return { tier: "A", score: 58, reason: "冒頭1〜3秒が強い strong 動画" };
    if (asset?.media_quality === "strong" && (tags.includes("actress_fit") || tags.includes("scene_surprise") || tags.includes("visual_mismatch"))) return { tier: "B", score: 44, reason: "strong 動画に作品固有Hookあり" };
    if (asset?.media_quality === "normal" && (tags.includes("first_seconds_strong") || tags.includes("visual_mismatch") || tags.includes("actress_fit"))) return { tier: "C", score: 32, reason: "normal 動画に使えるHookあり" };
    return { tier: "C", score: 18, reason: "manual review済み動画" };
  };
  const videoReach = opportunities
    .filter((item) => item.freshness.status !== "expired" || [8345, 266].includes(Number(item.mediaAsset?.id)))
    .filter((item) => item.mediaUsage !== "not_available")
    .filter((item) => item.canNativeVideo && isUsableXMediaAsset(item.mediaAsset).usable)
    .filter((item) => item.mediaAsset?.review_source === "manual_video_reviewed")
    .filter((item) => item.mediaAsset?.media_quality === "strong" || item.mediaAsset?.media_quality === "normal")
    .flatMap((item) => item.creativeVariants
      .filter((variant) => variant.intent === "REACH" && variant.mediaType === "sample_movie" && variant.quality.passed)
      .map((variant) => {
        const tier = reachVideoTier(item);
        const repetitionPenalty = hasDiversityConflict(item, picked, logs) ? 22 : 0;
        const score = clamp(tier.score + (variant.buzzPotential.scrollStop ?? 0) * 0.24 + (variant.buzzPotential.mediaFit ?? 0) * 0.18 + variant.quality.total * 0.14 + Math.min(item.freshness.total, 80) * 0.08 - repetitionPenalty);
        return { item, variant, score, tier };
      }))
    .filter(({ variant, score }) => score >= 60 && variant.quality.total >= 70 && (variant.buzzPotential.total ?? 0) >= 60 && variant.quality.dimensions.adSmell <= 30)
    .sort((a, b) => b.tier.score - a.tier.score || b.score - a.score)[0];
  if (videoReach) {
    const diverse = selectDiverseVariant(videoReach.item, "REACH", picked, logs);
    if (diverse && diverse.variant.mediaType === "sample_movie") {
      picked.push({
        ...videoReach.item,
        intent: "REACH",
        postText: diverse.variant.bodyText,
        replyText: diverse.variant.replyText,
        creativeVariantId: diverse.variant.id,
        mediaType: "sample_movie",
        mediaUsage: "allowed",
        recommendedMediaUrl: videoReach.item.mediaAsset?.source_url ?? videoReach.item.sampleMovieUrl,
        mediaDecision: "manual tags確認済みのsample_movie_urlをREACH動画として使用可",
        pickOrder: 1,
        role: "REACH",
        dailyScore: diverse.score,
        recommendedTimeLabel: recommendedTimeLabel(videoReach.item.recommendedSlot),
        whyToday: whyToday(videoReach.item, "REACH"),
        whyBuzz: buzzReason(videoReach.item, "REACH"),
        notPostReason: null,
        alternativeReason: `${videoReach.tier.tier} tier: ${videoReach.tier.reason}。価格/評価/比較より冒頭力を優先`,
        setDiversity: {
          status: "OK",
          roleLabel: sourceRoleLabel(videoReach.item.sourceType),
          signature: diverse.audit.signature,
          reasons: diverse.audit.reasons,
        },
      });
    }
  }
  for (const role of roles) {
    if (picked.length >= 3) break;
    const sourcePriority: XOpportunitySourceType[] = role === "MONEY"
      ? ["MONEY", "PRICE_EVENT", "WORK", "HIDDEN_GEM", "MARKET", "COMPARISON", "JUDGMENT", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND"]
      : role === "REACH"
        ? ["MARKET", "COMPARISON", "JUDGMENT", "HIDDEN_GEM", "PRICE_EVENT", "WORK", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND", "MONEY"]
        : ["FOLLOW_UP", "HIDDEN_GEM", "PRICE_EVENT", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND", "WORK", "MARKET", "COMPARISON", "JUDGMENT", "MONEY"];
    const best = pool
      .filter((item) => !hasDiversityConflict(item, picked, logs))
      .filter(() => !picked.some((pick) => pick.role === role) || picked.some((pick) => pick.role !== role))
      .filter((item) => passesLinklessQualityGate(item, role))
      .filter((item) => hasRealConversationSource(item, role))
      .map((item) => ({ item, score: roleScore(item, role) + Math.max(0, 12 - sourcePriority.indexOf(item.sourceType)) }))
      .filter(({ item, score }) => {
        const variant = item.creativeVariants.find((creative) => creative.intent === role);
        const minScore = role === "REACH" ? 60 : 70;
        const minQuality = role === "REACH" ? 70 : 74;
        const minBuzz = role === "REACH" ? 60 : 64;
        return score >= minScore && Boolean(variant?.quality.passed) && (variant?.quality.total ?? 0) >= minQuality && (variant?.buzzPotential.total ?? 0) >= minBuzz && (variant?.quality.dimensions.adSmell ?? 100) <= (role === "MONEY" ? 48 : 30);
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const diverse = selectDiverseVariant(best.item, role, picked, logs);
    if (!diverse) continue;
    const variant = diverse.variant;
    const variantMedia = variant?.mediaType ?? best.item.mediaType;
    const pickMediaType = variantMedia === "sample_movie" && !isUsableXMediaAsset(best.item.mediaAsset).usable
      ? best.item.imageUrl ? "existing_link_image" as const : "text" as const
      : variantMedia;
    const pickMediaUrl = pickMediaType === "sample_movie"
      ? best.item.mediaAsset?.source_url ?? best.item.sampleMovieUrl
    : pickMediaType === "existing_link_image" || pickMediaType === "data_card"
        ? pickMediaType === "data_card" ? `/api/admin/x-growth/media/download?workId=${best.item.workId}&mediaType=data_card` : best.item.imageUrl
        : null;
    picked.push({
      ...best.item,
      intent: role,
      postText: variant?.bodyText ?? best.item.postText,
      replyText: variant?.replyText ?? best.item.replyText,
      creativeVariantId: variant?.id ?? best.item.creativeVariantId,
      mediaType: pickMediaType,
      mediaUsage: pickMediaType === "sample_movie" ? "allowed" : pickMediaUrl || pickMediaType === "text" || pickMediaType === "quote" ? "allowed" : "not_available",
      recommendedMediaUrl: pickMediaUrl,
      mediaDecision: pickMediaType === "sample_movie"
        ? "権利確認済みのsample_movie_urlをネイティブ動画として使用可"
        : pickMediaType === "existing_link_image"
          ? role === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る"
          : pickMediaType === "data_card"
            ? "比較自体が面白い場合だけデータカードを使用"
            : pickMediaType === "quote" ? "外部投稿確認後の引用候補。自動引用はしない" : "利用可能な画像/動画がないためテキストのみ",
      pickOrder: picked.length + 1,
      role,
      dailyScore: diverse.score,
      recommendedTimeLabel: recommendedTimeLabel(best.item.recommendedSlot),
      whyToday: whyToday(best.item, role),
      whyBuzz: buzzReason(best.item, role),
      notPostReason: null,
      alternativeReason: picked.length
        ? diverse.variant.id !== best.item.creativeVariantId
          ? `2件目を別Hookへ再生成: ${diverse.audit.signature.openingPattern} / ${diverse.audit.signature.subjectStructure}`
          : "役割と作品/女優/ジャンルの重複を避けた次点採用"
        : null,
      setDiversity: {
        status: "OK",
        roleLabel: sourceRoleLabel(best.item.sourceType),
        signature: diverse.audit.signature,
        reasons: diverse.audit.reasons,
      },
    });
  }
  if (picked.length >= 2 && !picked.some((pick) => pick.role === "REACH")) {
    const replacement = pool
      .filter((item) => !picked.some((pick) => pick.workId === item.workId || pick.sourceType === item.sourceType))
      .flatMap((item) => item.creativeVariants
        .filter((variant) => variant.intent === "REACH" && variant.quality.passed)
        .map((variant) => ({ item, variant, score: clamp((variant.buzzPotential.total ?? 0) * 0.38 + variant.quality.total * 0.34 + item.freshness.total * 0.2 + (["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) ? 8 : 0)) })))
      .filter(({ variant, score }) => score >= 60 && variant.quality.total >= 70 && (variant.buzzPotential.total ?? 0) >= 60 && variant.quality.dimensions.adSmell <= 30)
      .sort((a, b) => b.score - a.score)[0];
    if (replacement) {
      const weakestIndex = picked
        .map((pick, index) => ({ index, score: pick.dailyScore, role: pick.role }))
        .filter((pick) => pick.role !== "MONEY")
        .sort((a, b) => a.score - b.score)[0]?.index;
      if (weakestIndex !== undefined) {
        const diverse = selectDiverseVariant(replacement.item, "REACH", picked.filter((_, index) => index !== weakestIndex), logs);
        if (diverse) {
          const pickMediaType = diverse.variant.mediaType === "sample_movie" && !isUsableXMediaAsset(replacement.item.mediaAsset).usable
            ? replacement.item.imageUrl ? "existing_link_image" as const : "text" as const
            : diverse.variant.mediaType;
          const pickMediaUrl = pickMediaType === "sample_movie"
            ? replacement.item.mediaAsset?.source_url ?? replacement.item.sampleMovieUrl
            : pickMediaType === "existing_link_image" || pickMediaType === "data_card"
              ? pickMediaType === "data_card" ? `/api/admin/x-growth/media/download?workId=${replacement.item.workId}&mediaType=data_card` : replacement.item.imageUrl
              : null;
          picked.splice(weakestIndex, 1, {
            ...replacement.item,
            intent: "REACH",
            postText: diverse.variant.bodyText,
            replyText: diverse.variant.replyText,
            creativeVariantId: diverse.variant.id,
            mediaType: pickMediaType,
            mediaUsage: pickMediaType === "sample_movie" ? "allowed" : pickMediaUrl || pickMediaType === "text" || pickMediaType === "quote" ? "allowed" : "not_available",
            recommendedMediaUrl: pickMediaUrl,
            mediaDecision: pickMediaType === "sample_movie"
              ? "権利確認済みのsample_movie_urlをネイティブ動画として使用可"
              : pickMediaType === "data_card"
                ? "比較自体が面白い場合だけデータカードを使用"
                : "利用可能な画像/動画がないためテキストのみ",
            pickOrder: weakestIndex + 1,
            role: "REACH",
            dailyScore: diverse.score,
            recommendedTimeLabel: recommendedTimeLabel(replacement.item.recommendedSlot),
            whyToday: whyToday(replacement.item, "REACH"),
            whyBuzz: buzzReason(replacement.item, "REACH"),
            notPostReason: null,
            alternativeReason: "role diversity優先でREACHを差し替え採用",
            setDiversity: {
              status: "OK",
              roleLabel: sourceRoleLabel(replacement.item.sourceType),
              signature: diverse.audit.signature,
              reasons: diverse.audit.reasons,
            },
          });
        }
      }
    }
    picked.forEach((pick, index) => {
      pick.pickOrder = index + 1;
    });
  }
  if (picked.length < 2) {
    const missingRoles: XGrowthIntent[] = [
      ...(picked.some((pick) => pick.role === "REACH") ? [] : ["REACH" as const]),
      ...(picked.some((pick) => pick.role === "AUTHORITY" || pick.role === "FOLLOW") ? [] : [mission.bottleneck === "Follow不足" ? "FOLLOW" as const : "AUTHORITY" as const]),
      ...(picked.length >= 2 || picked.some((pick) => pick.role === "MONEY") ? [] : ["MONEY" as const]),
      "AUTHORITY",
      "FOLLOW",
      "REACH",
    ];
    for (const desiredRole of missingRoles) {
      if (picked.length >= 3) break;
      const orderedSources = desiredRole === "MONEY"
        ? ["MONEY", "PRICE_EVENT", "HIDDEN_GEM", "WORK", "MARKET", "COMPARISON", "JUDGMENT", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND"] as XOpportunitySourceType[]
        : desiredRole === "REACH"
          ? ["MARKET", "HIDDEN_GEM", "PRICE_EVENT", "WORK", "COMPARISON", "JUDGMENT", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND", "MONEY"] as XOpportunitySourceType[]
          : ["FOLLOW_UP", "HIDDEN_GEM", "PRICE_EVENT", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND", "WORK", "COMPARISON", "JUDGMENT", "MARKET", "MONEY"] as XOpportunitySourceType[];
      for (const sourceType of orderedSources) {
      if (picked.length >= 3) break;
      const best = pool
        .filter((item) => item.sourceType === sourceType)
        .filter((item) => !hasDiversityConflict(item, picked, logs))
        .flatMap((item) => item.creativeVariants
          .filter((variant) => variant.intent === desiredRole && variant.quality.passed)
          .map((variant) => ({ item, variant, score: clamp((variant.buzzPotential.total ?? 0) * 0.45 + variant.quality.total * 0.25 + item.freshness.total * 0.3) })))
        .filter(({ variant, score }) => score >= (desiredRole === "REACH" ? 60 : 70) && variant.quality.total >= (desiredRole === "REACH" ? 70 : 72) && (variant.buzzPotential.total ?? 0) >= 60 && variant.quality.dimensions.adSmell <= (variant.intent === "MONEY" ? 48 : 30))
        .sort((a, b) => b.score - a.score)[0];
      if (!best) continue;
      const diverse = selectDiverseVariant(best.item, best.variant.intent, picked, logs);
      if (!diverse) continue;
      const pickMediaType = diverse.variant.mediaType === "sample_movie" && !isUsableXMediaAsset(best.item.mediaAsset).usable
        ? best.item.imageUrl ? "existing_link_image" as const : "text" as const
        : diverse.variant.mediaType;
      const pickMediaUrl = pickMediaType === "sample_movie"
        ? best.item.mediaAsset?.source_url ?? best.item.sampleMovieUrl
        : pickMediaType === "existing_link_image" || pickMediaType === "data_card"
          ? pickMediaType === "data_card" ? `/api/admin/x-growth/media/download?workId=${best.item.workId}&mediaType=data_card` : best.item.imageUrl
          : null;
      picked.push({
        ...best.item,
        intent: diverse.variant.intent,
        postText: diverse.variant.bodyText,
        replyText: diverse.variant.replyText,
        creativeVariantId: diverse.variant.id,
        mediaType: pickMediaType,
        mediaUsage: pickMediaType === "sample_movie" ? "allowed" : pickMediaUrl || pickMediaType === "text" || pickMediaType === "quote" ? "allowed" : "not_available",
        recommendedMediaUrl: pickMediaUrl,
        mediaDecision: pickMediaType === "sample_movie"
          ? "権利確認済みのsample_movie_urlをネイティブ動画として使用可"
          : pickMediaType === "existing_link_image"
            ? diverse.variant.intent === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る"
            : pickMediaType === "data_card"
              ? "比較自体が面白い場合だけデータカードを使用"
              : "利用可能な画像/動画がないためテキストのみ",
        pickOrder: picked.length + 1,
        role: diverse.variant.intent,
        dailyScore: diverse.score,
        recommendedTimeLabel: recommendedTimeLabel(best.item.recommendedSlot),
        whyToday: whyToday(best.item, diverse.variant.intent),
        whyBuzz: buzzReason(best.item, diverse.variant.intent),
        notPostReason: null,
        alternativeReason: diverse.variant.id !== best.variant.id ? "供給不足時の補完。2件目を別Hookへ再生成" : "供給不足時の補完。Gate OK候補だけを採用",
        setDiversity: {
          status: "OK",
          roleLabel: sourceRoleLabel(best.item.sourceType),
          signature: diverse.audit.signature,
          reasons: diverse.audit.reasons,
        },
      });
      break;
      }
    }
  }
  const reason = picked.length ? null : "今日の候補は鮮度、Creative Gate、素材可否、直近投稿との重複のいずれかで基準未達です。投稿しない判断が安全です。";
  return { picks: picked, reason };
}

function buildSupplyDiagnostics(opportunities: XGrowthOpportunity[], picks: XDailyTopPick[]) {
  const gateOkBySource: Record<string, number> = {};
  const generatedBySource: Record<string, number> = {};
  const humanVoiceNgBySource: Record<string, number> = {};
  const nativeVoiceNgBySource: Record<string, number> = {};
  const generatedByRole: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  const gateOkByRole: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  for (const item of opportunities) {
    generatedBySource[item.sourceType] = (generatedBySource[item.sourceType] ?? 0) + 1;
    const ok = item.creativeVariants.some((variant) => variant.quality.passed);
    if (ok) gateOkBySource[item.sourceType] = (gateOkBySource[item.sourceType] ?? 0) + 1;
    for (const role of new Set(item.creativeVariants.map((variant) => variant.intent))) {
      generatedByRole[role] = (generatedByRole[role] ?? 0) + 1;
    }
    for (const role of new Set(item.creativeVariants.filter((variant) => variant.quality.passed).map((variant) => variant.intent))) {
      gateOkByRole[role] = (gateOkByRole[role] ?? 0) + 1;
    }
    const hasHumanNg = item.creativeVariants.some((variant) => !variant.quality.lastMile.humanVoice.passed);
    if (hasHumanNg) humanVoiceNgBySource[item.sourceType] = (humanVoiceNgBySource[item.sourceType] ?? 0) + 1;
    const hasNativeNg = item.creativeVariants.some((variant) => !variant.quality.lastMile.nativeXVoice.passed);
    if (hasNativeNg) nativeVoiceNgBySource[item.sourceType] = (nativeVoiceNgBySource[item.sourceType] ?? 0) + 1;
  }
  const reachSources = ["MARKET", "COMPARISON", "JUDGMENT", "HIDDEN_GEM", "PRICE_EVENT", "WORK"];
  const reachGenerated = reachSources.reduce((sum, source) => sum + (generatedBySource[source] ?? 0), 0);
  const reachGateOk = reachSources.reduce((sum, source) => sum + (gateOkBySource[source] ?? 0), 0);
  const roleTargets: Record<XGrowthIntent, number> = { REACH: 5, FOLLOW: 3, AUTHORITY: 2, CONVERSATION: 0, MONEY: 2 };
  const shortagesByRole = (Object.keys(roleTargets) as XGrowthIntent[]).reduce((acc, role) => {
    acc[role] = Math.max(0, roleTargets[role] - (generatedByRole[role] ?? 0));
    return acc;
  }, {} as Record<XGrowthIntent, number>);
  const crossPostDiversityRejected = opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed) && !picks.some((pick) => pick.workId === item.workId || pick.sourceType === item.sourceType)).length;
  const target = picks.length >= 3 ? "通常3件" as const : picks.length === 2 ? "本日2件" as const : picks.length === 1 ? "本日1件" as const : "本日0件" as const;
  const shortages = [
    reachGenerated < 5 ? `REACH供給目標5件に対して${reachGenerated}件` : "",
    (generatedByRole.FOLLOW + generatedByRole.AUTHORITY) < 5 ? `FOLLOW/AUTHORITY供給目標5件に対して${generatedByRole.FOLLOW + generatedByRole.AUTHORITY}件` : "",
    generatedByRole.MONEY < 2 ? `MONEY供給目標2件に対して${generatedByRole.MONEY}件。強い価格/CTR日だけ採用` : "",
    reachGateOk === 0 ? `REACH候補は${reachGenerated}件生成したがGate OKが不足` : "",
    reachGenerated > reachGateOk ? `REACH候補は${reachGenerated}件生成、Gate OKは${reachGateOk}件` : "",
    reachSources.some((source) => (humanVoiceNgBySource[source] ?? 0) > 0) ? `Human Voice Gate NG: ${reachSources.map((source) => `${source} ${humanVoiceNgBySource[source] ?? 0}`).filter((text) => !text.endsWith(" 0")).join(" / ")}` : "",
    (gateOkBySource.MARKET ?? 0) + (gateOkBySource.COMPARISON ?? 0) + (gateOkBySource.JUDGMENT ?? 0) + (gateOkBySource.FOLLOW_UP ?? 0) === 0 ? "市場/比較/判断/続報のGate OK候補が不足" : "",
    (gateOkBySource.MONEY ?? 0) + (gateOkBySource.PRICE_EVENT ?? 0) === 0 ? "MONEY/価格イベントのGate OK候補が不足" : "",
    picks.length >= 2 && !picks.some((pick) => pick.role === "REACH") ? "FOLLOW+FOLLOW系になった理由: REACH候補が全Gate NG、または当日セット重複で不採用" : "",
  ].filter(Boolean);
  return { target, gateOkBySource, generatedBySource, humanVoiceNgBySource, nativeVoiceNgBySource, crossPostDiversityRejected, generatedByRole, gateOkByRole, shortagesByRole, reachGenerated, reachGateOk, shortages };
}

function normalizedOpening(text: string) {
  return firstLine(text).replace(/[0-9０-９]+/g, "#").replace(/\s+/g, "").slice(0, 20);
}

function patternFromLog(log: XPostLog) {
  const text = log.post_text;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const opening = normalizedOpening(text);
  const ending = lines.at(-1) ?? "";
  const structure = lines.map((line) => /評価|ランキング|OFF|円|レビュー/.test(line) ? "proof" : /http/.test(line) ? "link" : "story").join("+");
  const hook = log.hook_type ?? String(log.creative_genome?.hook ?? "unknown");
  const media = String(log.creative_genome?.media ?? log.image_strategy ?? "unknown");
  return `${opening} / ${structure} / ${hook} / ${media} / ${ending.slice(0, 16)}`;
}

function buildNativeXLearning(logs: XPostLog[], outcomes: XPostOutcome[]) {
  const cutoff = Date.now() - 7 * DAY_MS;
  const recent = logs.filter((log) => new Date(log.posted_at).getTime() >= cutoff);
  const counts = new Map<string, number>();
  for (const log of recent) {
    const key = patternFromLog(log);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const overusedPatterns = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => `${pattern} (${count}回)`);
  const winningPatterns = outcomes
    .filter((outcome) => outcome.status === "winner" || outcome.clicksSevenDays > 0 || outcome.follows24h > 0 || outcome.profileVisits24h > 0)
    .slice(0, 5)
    .map((outcome) => patternFromLog(outcome).replace(/^[^/]+\//, "感想始まり +"));
  const phraseCounts = new Map<string, number>();
  for (const log of recent) {
    for (const line of log.post_text.split("\n").map((item) => item.trim()).filter((item) => item.length >= 8 && item.length <= 24)) {
      phraseCounts.set(line, (phraseCounts.get(line) ?? 0) + 1);
    }
  }
  const avoidConstructions = [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([phrase, count]) => `${phrase} (${count}回)`);
  return { overusedPatterns, winningPatterns, avoidConstructions };
}

function buildLearning(rows: XCreativeLearningRow[], outcomes: XPostOutcome[]) {
  const creativeFindings = rows.slice(0, 5).map((row) => ({
    key: `${row.dimension}-${row.value}`,
    label: row.label,
    finding: `${row.posts}投稿 / 補正CTR ${row.adjustedCtr}% / ${row.recommendation}`,
    strength: row.confidence === "high" && row.adjustedCtr >= 8 ? "strong" as const : row.adjustedCtr <= 3 ? "weak" as const : "watch" as const,
  }));
  const intentFindings = outcomes.slice(0, 4).map((outcome) => ({
    key: `outcome-${outcome.id}`,
    label: outcome.title,
    finding: `24h表示 ${outcome.impressions24h} / プロフ ${outcome.profileVisits24h} / フォロー ${outcome.follows24h} / 7日クリック ${outcome.clicksSevenDays}`,
    strength: outcome.status === "winner" ? "strong" as const : outcome.status === "replace" ? "weak" as const : "watch" as const,
  }));
  return [...creativeFindings, ...intentFindings].slice(0, 8);
}

export async function buildXGrowthOS({
  growth,
  performance,
  logs,
  outcomes,
  creativeLearning,
  includeDeferred = true,
}: {
  growth: FanzaXGrowth;
  performance: AffiliatePerformanceRow[];
  logs: XPostLog[];
  outcomes: XPostOutcome[];
  creativeLearning: XCreativeLearningRow[];
  includeDeferred?: boolean;
}): Promise<XGrowthOS> {
  const timings: Record<string, number> = {};
  const mark = async <T,>(label: string, task: Promise<T>) => {
    const started = Date.now();
    const result = await task;
    timings[label] = Date.now() - started;
    return result;
  };
  const candidateResult = await mark("candidate_generation_ms", getXPostCandidates(performance, logs));
  const expandedCandidates = expandCreativeSupply(candidateResult.candidates);
  const scoredAll = expandedCandidates.map(scoreOpportunity).sort((a, b) => {
    const aMax = Math.max(a.reachScore, a.followScore, a.authorityScore, a.revenueScore);
    const bMax = Math.max(b.reachScore, b.followScore, b.authorityScore, b.revenueScore);
    return bMax - aMax;
  });
  const baseLimit = includeDeferred ? 120 : 48;
  const mustKeepWorkIds = new Set([56714]);
  const scored = [
    ...scoredAll.filter((item) => mustKeepWorkIds.has(item.workId)),
    ...scoredAll.slice(0, baseLimit),
  ].filter((item, index, rows) => rows.findIndex((row) => row.key === item.key) === index);
  const [media, rankingHistories] = await Promise.all([
    mark("media_assets_ms", fetchMediaAssets(scored.map((item) => item.workId))),
    mark("ranking_history_ms", fetchRankingSnapshotHistory(scored.map((item) => item.workId))),
  ]);
  const qualityStarted = Date.now();
  const opportunities = applyRankingHistory(applyMediaRights(scored, media.assets), rankingHistories.histories).map((item) => withCreativeQuality(item, logs));
  timings.creative_quality_ms = Date.now() - qualityStarted;
  const mission = buildStrategicMission(growth, logs, creativeLearning);
  const dailySelection = selectDailyTopPicks(opportunities, mission, logs);
  const supplyDiagnostics = buildSupplyDiagnostics(opportunities, dailySelection.picks);
  const nativeXLearning = buildNativeXLearning(logs, outcomes);
  const persistedTopPicks = await mark("persisted_top_picks_ms", persistDailyTopPicks({
    mission,
    topPicks: dailySelection.picks,
    supplyDiagnostics,
    nativeXLearning,
    performanceTimings: timings,
  }));
  const deferredStarted = Date.now();
  const deferred = includeDeferred ? await Promise.all([
    upsertDailyPlan(mission),
    persistOpportunities(opportunities.slice(0, 16)),
    buildConversationRadarFromData(opportunities),
    getPersistedGrowthTables(),
    persistCreativeLearning(creativeLearning.slice(0, 12)),
    persistRankingSnapshots(opportunities.slice(0, 16)),
    mark("media_supply_ms", getXMediaSupplyStatus()),
    mark("rights_review_ms", getRightsReviewQueue(12)),
  ]) : null;
  timings.deferred_admin_ms = Date.now() - deferredStarted;
  const [planResult, persistedResult, radarResult, persistedTables, , rankingSnapshotResult, mediaSupply, rightsReviewQueue] = deferred ?? [
    { plan: null, error: null },
    { error: null },
    { rows: [], error: null },
    { opportunities: [], snapshots: [], migrationError: null },
    null,
    { error: null },
    { error: null, mp4Candidates: 0, synced: 0, unknown: 0, review: 0, allowed: 0, blocked: 0, dead: 0, topPickRightsWaiting: 0 },
    { rows: [], error: null },
  ];
  const xReadOnlyConnection = includeDeferred
    ? await mark("x_readonly_check_ms", checkXReadOnlyConnectionStatus())
    : { checked: false, ok: false, username: null, error: "Fast Pathでは後追い確認" };
  const systemStatus = getXGrowthSystemStatus(
    media.error ?? rankingHistories.error ?? persistedTopPicks.error ?? persistedResult.error ?? radarResult.error ?? persistedTables.migrationError ?? rankingSnapshotResult.error ?? planResult.error,
    rankingHistories.error ?? rankingSnapshotResult.error,
  );
  systemStatus.xReadOnlyConnection = xReadOnlyConnection;

  return {
    opportunities: opportunities.slice(0, 16).map((item) => ({
      ...item,
      creativeVariants: item.creativeVariants.slice(0, 4),
    })),
    dailyTopPicks: dailySelection.picks,
    dailyNoPostReason: dailySelection.reason,
    mission,
    audit: {
      reuse: ["x_post_logs", "既存リンク画像", "works / price_history / ranking / review", "work_page_views / affiliate_clicks", "xCreativeEngineの投稿文バリアント"],
      replace: ["作品起点の固定3投稿Planner", "/admin/revenue内のX候補運用UI", "単一funnelScore中心の判断"],
      retire: ["新Growth OSと重複する旧X候補パネル", "クリックだけで成功判定する旧学習", "myfansと混ざる可能性のある手動運用"],
    },
    conversationRadar: (radarResult.rows as Array<Record<string, unknown>>).map((row) => ({
      key: String(row.id),
      target: `${row.target_type}: ${row.target_name}`,
      query: String(row.topic),
      suggestedAction: `${row.suggested_reply} / 外部X検索: ${row.external_status === "unavailable" ? "unavailable" : "available"}`,
    })),
    seriesIdeas: buildSeriesIdeas(performance, opportunities),
    learning: buildLearning(creativeLearning, outcomes),
    manualMetrics: ["bookmarks", "profile_visits", "follows", "X側link_clicks"],
    dailyPlan: (planResult.plan ?? null) as Record<string, unknown> | null,
    persistedOpportunities: (persistedTables.opportunities ?? []) as Record<string, unknown>[],
    snapshots: (persistedTables.snapshots ?? []) as Record<string, unknown>[],
    systemStatus,
    mediaSupply,
    rightsReviewQueue: rightsReviewQueue.rows,
    supplyDiagnostics,
    nativeXLearning,
    performanceTimings: timings,
  };
}

export async function getRightsCheckedMediaCount() {
  const { count, error } = await supabaseAdmin
    .from("x_media_assets")
    .select("id", { count: "exact", head: true })
    .eq("account_handle", "hakkutsu_lab")
    .eq("x_usage_allowed", true);
  return { count: count ?? 0, error: error?.message ?? null };
}
