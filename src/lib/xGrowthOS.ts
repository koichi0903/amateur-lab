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
  analyzeUncachedVideoFacts,
  getPersistedGrowthTables,
  getXGrowthSystemStatus,
  persistRankingSnapshots,
  persistCreativeLearning,
  persistOpportunities,
  persistDailyTopPicks,
  getPostedWorkIds,
  upsertDailyPlan,
  type XGrowthSystemStatus,
} from "@/lib/xGrowthOperations";
import { getXMediaSupplyStatus, getRightsReviewQueue, isPostableOfficialSampleMovie, type XMediaAsset } from "@/lib/xMediaAssets";
import { isVideoCandidate } from "@/lib/xVideoCandidate";
import { buildVisualVideoFacts, primaryUsableVisualFact, type XVisualVideoFacts, visualFactScores } from "@/lib/xVisualVideoFacts";
import { assignSemanticHook, SEMANTIC_CATEGORY_QUOTA } from "./xGrowthSemantic";
import { decisionFactProofLine, type DecisionType } from "@/lib/domain/decisionFacts";

export type XGrowthIntent = "REACH" | "AUTHORITY" | "FOLLOW" | "CONVERSATION" | "MONEY";
export type XMoneyGateReason = "missing_affiliate_url" | "price_truth_unavailable" | "last_mile_ng" | "native_x_voice_ng" | "unsafe_or_too_explicit" | "duplicate_or_posted" | "stale_or_expired" | "media_mismatch" | "other";
export type XSemanticHookCategory = "motion_shift" | "brightness_shift" | "jacket_video_mismatch" | "opening_change" | "pacing_change" | "visual_contrast" | "hidden_find" | "actress_focus" | "price_reason" | "social_proof" | "comparison" | "dry_observation" | "changed_mind" | "generic_reaction";
export { assignSemanticHook, SEMANTIC_CATEGORY_QUOTA, semanticHookCategory } from "./xGrowthSemantic";

export function isAllowedXGrowthMediaType(mediaType: XGrowthOpportunity["mediaType"]) {
  return mediaType === "sample_movie" || mediaType === "existing_link_image";
}
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
  visualFacts: XVisualVideoFacts;
  visualScoring: ReturnType<typeof visualFactScores>;
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

const DECISION_TYPES: readonly DecisionType[] = ["RECORD_LOW", "HIGH_DISCOUNT_NOT_LOW", "HIDDEN_VALUE"];

export function isDecisionFactEligible(candidate: Pick<XGrowthOpportunity, "decisionFacts">) {
  const facts = candidate.decisionFacts;
  return Boolean(facts && decisionTypesForCandidate(candidate).length > 0 && decisionFactProofLine(facts).trim());
}

export function decisionTypeForCandidate(candidate: Pick<XGrowthOpportunity, "decisionFacts"> & { category?: string }): DecisionType {
  const facts = candidate.decisionFacts;
  if (candidate.category === "hidden_gem" && facts?.eligibleDecisionTypes?.includes("HIDDEN_VALUE")) return "HIDDEN_VALUE";
  return facts?.decisionType ?? "UNKNOWN";
}

export function decisionTypesForCandidate(candidate: Pick<XGrowthOpportunity, "decisionFacts">): DecisionType[] {
  const facts = candidate.decisionFacts;
  if (!facts) return [];
  return facts.eligibleDecisionTypes?.length
    ? facts.eligibleDecisionTypes
    : DECISION_TYPES.includes(facts.decisionType) ? [facts.decisionType] : [];
}

function isEligibleForDecisionType(candidate: Pick<XGrowthOpportunity, "decisionFacts">, type: DecisionType) {
  return decisionTypesForCandidate(candidate).includes(type);
}

export function decisionCoverageScore(
  decisionType: DecisionType,
  selectedByType: Partial<Record<DecisionType, number>>,
  eligibleByType: Partial<Record<DecisionType, number>>,
) {
  const missing = DECISION_TYPES.some((type) => (eligibleByType[type] ?? 0) > 0 && (selectedByType[type] ?? 0) === 0);
  return missing && (eligibleByType[decisionType] ?? 0) > 0 && (selectedByType[decisionType] ?? 0) === 0 ? 100 : 0;
}

export type XDailyTopPick = XGrowthOpportunity & {
  pickOrder: number;
  slotId?: "slot_1" | "slot_2" | "slot_3";
  slotRole?: "REACH" | "FOLLOW_OR_AUTHORITY" | "MONEY_OR_REACH";
  slotLabel?: string;
  candidateRank?: "A" | "B" | "C";
  candidateId?: string;
  isSelected?: boolean;
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
      endingPhrase: string;
      numberPlacement: string;
      semanticHookCategory: XSemanticHookCategory;
      reactionType: string;
      judgmentShape: string;
      primaryFactKind: string;
      abstractFallback: boolean;
      semanticMappingReason?: string;
    };
    reasons: string[];
  };
};

export type XGrowthVariantDiagnostic = {
  workId: number;
  slot: XDailyTopPick["slotId"] | null;
  role: XGrowthIntent;
  variantId: string;
  mediaType: XCreativeVariant["mediaType"];
  sampleMovie: {
    isSampleMovie: boolean;
    mediaAssetId: number | null;
    sourceUrl: string | null;
  };
  factTypes: string[];
  videoEligibility: {
    eligible: boolean;
    reasons: string[];
  } | null;
  postText: string;
  humanVoice: XCreativeVariant["quality"]["lastMile"]["humanVoice"];
  nativeXVoice: XCreativeVariant["quality"]["lastMile"]["nativeXVoice"];
  lastMile: {
    passed: boolean;
    verdict: XCreativeVariant["quality"]["lastMile"]["verdict"];
    checks: {
      humanVoice: boolean;
      nativeXVoice: boolean;
      noReasons: boolean;
    };
    reasons: string[];
  };
  quality: {
    passed: boolean;
    recommendation: XCreativeVariant["quality"]["recommendation"];
    score: number;
    failedReasons: string[];
  };
  isSoftQualityEligible: boolean;
  videoSupply: {
    officialEligible: boolean;
    strongSafeEligible: boolean;
    finalCandidate: boolean;
    selected: boolean;
    reason: string;
  } | null;
  selected: boolean;
  selectedReason: string;
};

export function summarizeXGrowthVariantDiagnostics(diagnostics: readonly XGrowthVariantDiagnostic[]) {
  const humanVoiceNgByCheck: Record<string, number> = {};
  const nativeXVoiceNgByCheck: Record<string, number> = {};
  const lastMileNgReasons: Record<string, number> = {};
  const qualityNgReasons: Record<string, number> = {};
  const factTypeCounts: Record<string, number> = {};
  const videoRejectionReasons: Record<string, number> = {};
  const mediaTypeCounts: Record<string, number> = {};
  const selectedByMediaType: Record<string, number> = {};
  for (const diagnostic of diagnostics) {
    mediaTypeCounts[diagnostic.mediaType] = (mediaTypeCounts[diagnostic.mediaType] ?? 0) + 1;
    if (diagnostic.selected) selectedByMediaType[diagnostic.mediaType] = (selectedByMediaType[diagnostic.mediaType] ?? 0) + 1;
    for (const factType of diagnostic.factTypes) factTypeCounts[factType] = (factTypeCounts[factType] ?? 0) + 1;
    for (const [check, passed] of Object.entries(diagnostic.humanVoice.checks)) if (!passed) humanVoiceNgByCheck[check] = (humanVoiceNgByCheck[check] ?? 0) + 1;
    for (const [check, passed] of Object.entries(diagnostic.nativeXVoice.checks)) if (!passed) nativeXVoiceNgByCheck[check] = (nativeXVoiceNgByCheck[check] ?? 0) + 1;
    for (const reason of diagnostic.lastMile.reasons) lastMileNgReasons[reason] = (lastMileNgReasons[reason] ?? 0) + 1;
    for (const reason of diagnostic.quality.failedReasons) qualityNgReasons[reason] = (qualityNgReasons[reason] ?? 0) + 1;
    for (const reason of diagnostic.videoSupply?.reason.split(" / ") ?? []) {
      if (diagnostic.videoSupply && !diagnostic.videoSupply.finalCandidate && reason) videoRejectionReasons[reason] = (videoRejectionReasons[reason] ?? 0) + 1;
    }
  }
  return {
    totalVariants: diagnostics.length,
    mediaTypeCounts,
    selectedByMediaType,
    humanVoiceNgByCheck,
    nativeXVoiceNgByCheck,
    lastMileNgReasons,
    qualityNgReasons,
    factTypeCounts,
    videoRejectionReasons,
  };
}

type CandidateIdentity = Pick<XGrowthOpportunity, "workId" | "productId" | "sampleMovieUrl" | "mediaAsset"> & {
  candidateId?: string | null;
  imageUrl?: string | null;
};

/** Stable identity used by all daily candidate diversity checks. */
export function candidateDedupeKey(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  if (Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0) return `media_asset:${mediaAssetId}`;
  const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
  if (sampleMovieUrl) return `sample_movie_url:${sampleMovieUrl}`;
  if (Number.isSafeInteger(candidate.workId) && candidate.workId > 0) return `work:${candidate.workId}`;
  if (candidate.candidateId) return `candidate:${candidate.candidateId}`;
  return `product:${candidate.productId}`;
}

export function candidateMediaDedupeKey(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  if (Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0) return `media_asset:${mediaAssetId}`;
  const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
  if (sampleMovieUrl) return `sample_movie_url:${sampleMovieUrl}`;
  return candidate.imageUrl?.trim() ? `image_url:${candidate.imageUrl.trim()}` : null;
}

function candidateIdentityKeys(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  return {
    workId: candidate.workId,
    mediaAssetId: Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0 ? mediaAssetId : null,
    sampleMovieUrl: candidate.sampleMovieUrl?.trim() || null,
    imageUrl: candidate.imageUrl?.trim() || null,
  };
}

/** Enforces media/url uniqueness first, then work uniqueness for a candidate set. */
export function isDistinctCandidate(candidate: CandidateIdentity, selectedSet: CandidateIdentity[]) {
  return !selectedSet.some((selected) => {
    const identity = candidateIdentityKeys(candidate);
    const selectedIdentity = candidateIdentityKeys(selected);
    return selectedIdentity.workId === identity.workId
      || (identity.mediaAssetId !== null && selectedIdentity.mediaAssetId === identity.mediaAssetId)
      || (identity.sampleMovieUrl !== null && selectedIdentity.sampleMovieUrl === identity.sampleMovieUrl)
      || (identity.imageUrl !== null && selectedIdentity.imageUrl === identity.imageUrl);
  });
}

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
    target: "3slot × 最大3候補" | "候補不足";
    sourcePoolTotal: number;
    sourcePoolAfterPosted: number;
    prefilterCount: number;
    humanVoiceTargetCount: number;
    diversityTargetCount: number;
    postedExcluded: number;
    postedOverlap: number;
    urlOrMediaAvailable: number;
    hardGatePassed: number;
    eligibleByIntent: Record<XGrowthIntent, number>;
    mediaTypeCounts: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
    creativeAngleCounts: Record<string, number>;
    slotAllocation: Record<string, number>;
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
    moneyGenerated: number;
    moneyHardGatePassed: number;
    moneyAllocationEligible: number;
    moneyPlaced: number;
    moneyGateReasons: Array<{ workId: number; candidateId: string | null; reasons: XMoneyGateReason[] }>;
    moneyTopFailureReason: XMoneyGateReason | null;
    semanticSupply: Record<XSemanticHookCategory, number>;
    semanticSelected: Record<XSemanticHookCategory, number>;
    semanticQuota: Record<XSemanticHookCategory, number>;
    semanticQuotaOverflowReasons: string[];
    semanticMappingReasons: Record<string, number>;
    decisionPipeline: {
      rawSupply: number;
      classified: number;
      eligible: number;
      dedupedEligible: number;
      selectedBeforeReplenishment: number;
      replenished: number;
      selected: number;
      persisted: number;
      eligibleByType: Record<string, number>;
      selectedByType: Record<string, number>;
      byType: Record<string, {
        dbFetchedWorks: number;
        dbRawWorks: number;
        baseXFilters: number;
        postedCooldown: number;
        mediaEligible: number;
        uniqueWorks: number;
        uniqueMedia: number;
        uniqueUrls: number;
        chartEligible: number;
        creativeVariants: number;
        qualityEligible: number;
        firstDropReasonCounts: Record<string, number>;
        firstDropByWorkId: Record<string, string>;
        selected: number;
        persisted: number;
      }>;
    };
    pipeline: Record<string, number>;
    mediaMix: {
      totalVideoCandidates: number;
      videoRaw: number;
      videoEligible: number;
      videoAfterDedupe: number;
      slotEligibleVideo: number;
      eligibleStrongVideos: number;
      eligibleOfficialVideos: number;
      officialCandidateCount: number;
      officialVariantEligibleCount: number;
      selectedVideos: number;
      fallbackOfficialSelected: number;
      selectedVideosBySlot: Record<string, number>;
      rejectionReasons: Record<string, number>;
      uniqueAudit: ReturnType<typeof auditCandidateUniqueness>;
      targetVideos: number;
      unmetReason: string | null;
    };
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
const POSTED_WORK_COOLDOWN_DAYS = 14;
const DAILY_PICK_COOLDOWN_DAYS = 1;

function tokyoDate(daysOffset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + daysOffset * DAY_MS));
}

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

export function expandCreativeSupply(candidates: XPostCandidate[]): XPostCandidate[] {
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

export function scoreOpportunity(candidate: XPostCandidate): XGrowthOpportunity {
  const eventType = inferEvent(candidate);
  const hasVideo = candidate.creativeKind !== "comparison";
  const priceSignal = candidate.decisionFacts?.decisionType === "RECORD_LOW" ? 24 : candidate.isNinetyDayLow ? 24 : candidate.previousPrice ? 16 : candidate.discountRate >= 30 ? 10 : 0;
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

  const visualFacts = buildVisualVideoFacts({
    imageUrl: candidate.imageUrl,
    sampleMovieUrl: candidate.sampleMovieUrl,
  });
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
      decisionFactProofLine(candidate.decisionFacts),
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
    visualFacts,
    visualScoring: visualFactScores(visualFacts),
    rankingHistory: {
      status: "accumulating",
      previousRanking: null,
      rankingDelta: null,
      observations: 0,
    },
    freshness,
    evidence: [
      candidate.selectionReason,
      decisionFactProofLine(candidate.decisionFacts),
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
  const visualFacts = (item.mediaAsset?.visual_video_facts as XVisualVideoFacts | null | undefined) ?? buildVisualVideoFacts({
    imageUrl: item.imageUrl,
    sampleMovieUrl: item.sampleMovieUrl,
    manualTags: item.mediaAsset?.manual_tags ?? [],
    mediaQuality: item.mediaAsset?.media_quality,
  });
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
    decisionFacts: item.decisionFacts,
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
    visualFacts,
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
    decisionFacts: item.decisionFacts,
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
    visualFacts,
  }, hookScore);
  const realMediaVariants = variants.map((variant) => variant.mediaType === "data_card" && item.imageUrl
    ? { ...variant, mediaType: "existing_link_image" as const, imageStrategy: "original_work_image" as const }
    : variant);
  const recommended = realMediaVariants.find((variant) => variant.intent === item.intent && variant.quality.passed)
    ?? realMediaVariants.find((variant) => variant.quality.passed)
    ?? realMediaVariants[0];
  const mediaType = recommended?.mediaType ?? item.mediaType;
  const nativeVideoAllowed = mediaType === "sample_movie" && item.canNativeVideo && isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable;
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
    visualFacts,
    visualScoring: visualFactScores(visualFacts),
    creativeVariants: realMediaVariants,
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
      ? "公式FANZA/DMM sample_movie_urlを無加工投稿用のネイティブ動画として使用可"
      : resolvedMediaType === "existing_link_image"
        ? item.intent === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る"
        : resolvedMediaType === "data_card"
          ? "作品画像URLを確認し、データカード素材として使用"
          : resolvedMediaType === "quote" ? "外部投稿確認後の引用候補。自動引用はしない" : "利用可能な画像/動画がないためテキストのみ",
    creativeGenome: recommended?.creativeGenome ?? item.creativeGenome,
  };
}

/** A video is strong only when the existing safety, quality, and visual evidence agree. */
export function isStrongSafeVideoCandidate(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "visualFacts" | "visualScoring" | "mediaType" | "recommendedMediaUrl">,
  variant?: Pick<XCreativeVariant, "mediaType" | "quality"> | null,
) {
  return videoEligibilityReasons(item, variant).length === 0;
}

/** Official sample movies remain selectable when automated strong/safe evidence is incomplete. */
export function isOfficialEligibleVideoCandidate(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "mediaType" | "recommendedMediaUrl">,
) {
  return isVideoCandidate({ ...item, mediaType: "sample_movie" })
    && item.canNativeVideo
    && isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable;
}

export function auditCandidateUniqueness(candidates: readonly CandidateIdentity[], postedWorkIds: ReadonlySet<number> = new Set()) {
  const workIds = new Set<number>();
  const mediaIds = new Set<number>();
  const mediaUrls = new Set<string>();
  const sampleMovieUrls = new Set<string>();
  const imageUrls = new Set<string>();
  const duplicateWorkIds = new Set<number>();
  const duplicateMediaIds = new Set<number>();
  const duplicateMediaUrls = new Set<string>();
  const duplicateSampleMovieUrls = new Set<string>();
  const duplicateImageUrls = new Set<string>();
  let postedOverlap = 0;
  for (const candidate of candidates) {
    if (postedWorkIds.has(candidate.workId)) postedOverlap += 1;
    if (workIds.has(candidate.workId)) duplicateWorkIds.add(candidate.workId);
    workIds.add(candidate.workId);
    const mediaId = Number(candidate.mediaAsset?.id);
    if (Number.isSafeInteger(mediaId) && mediaId > 0) {
      if (mediaIds.has(mediaId)) duplicateMediaIds.add(mediaId);
      mediaIds.add(mediaId);
    }
    const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
    if (sampleMovieUrl) {
      if (sampleMovieUrls.has(sampleMovieUrl)) duplicateSampleMovieUrls.add(sampleMovieUrl);
      sampleMovieUrls.add(sampleMovieUrl);
      if (mediaUrls.has(sampleMovieUrl)) duplicateMediaUrls.add(sampleMovieUrl);
      mediaUrls.add(sampleMovieUrl);
    }
    const imageUrl = candidate.imageUrl?.trim();
    if (imageUrl) {
      if (imageUrls.has(imageUrl)) duplicateImageUrls.add(imageUrl);
      imageUrls.add(imageUrl);
      if (mediaUrls.has(imageUrl)) duplicateMediaUrls.add(imageUrl);
      mediaUrls.add(imageUrl);
    }
  }
  return {
    workDuplicateCount: duplicateWorkIds.size,
    mediaDuplicateCount: duplicateMediaIds.size,
    urlDuplicateCount: duplicateMediaUrls.size,
    sampleMovieDuplicateCount: duplicateSampleMovieUrls.size,
    imageDuplicateCount: duplicateImageUrls.size,
    postedOverlap,
    duplicateWorkIds: [...duplicateWorkIds],
    duplicateMediaIds: [...duplicateMediaIds],
    duplicateUrls: [...duplicateMediaUrls],
    duplicateSampleMovieUrls: [...duplicateSampleMovieUrls],
    duplicateImageUrls: [...duplicateImageUrls],
    passed: duplicateWorkIds.size === 0 && duplicateMediaIds.size === 0 && duplicateMediaUrls.size === 0
      && duplicateSampleMovieUrls.size === 0 && duplicateImageUrls.size === 0 && postedOverlap === 0,
  };
}

export function videoEligibilityReasons(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "visualFacts" | "visualScoring" | "mediaType" | "recommendedMediaUrl">,
  variant?: Pick<XCreativeVariant, "mediaType" | "quality"> | null,
) {
  const reasons: string[] = [];
  const asset = item.mediaAsset;
  const tags = asset?.manual_tags ?? [];
  const candidate = { ...item, mediaType: variant?.mediaType ?? item.mediaType };
  if (!isVideoCandidate(candidate)) reasons.push("video media/sample_movie_urlなし");
  if (variant?.mediaType !== "sample_movie") reasons.push("creative variantが動画ではない");
  if (!item.canNativeVideo) reasons.push("rightsまたはX使用可否未確認");
  if (!isPostableOfficialSampleMovie(asset, item.sampleMovieUrl).usable) reasons.push("official sample / fetch / safety gate NG");
  if (asset?.media_quality === "weak") reasons.push("media_quality=weak");
  // null/undefined and unreviewed are intentionally not weak.
  if (tags.includes("too_explicit_for_reach")) reasons.push("too_explicit_for_reach");
  if (tags.includes("weak_visual")) reasons.push("weak_visual");
  if (!variant?.quality.passed) reasons.push("creative quality gate NG");
  if (variant && !variant.quality.lastMile.humanVoice.passed) reasons.push("human voice gate NG");
  if (variant && !variant.quality.lastMile.nativeXVoice.passed) reasons.push("native X voice gate NG");
  const hasUsableVideoFact = (item.visualFacts?.usableFacts ?? []).some((fact) =>
    fact.source === "sample_video" || fact.source === "manual_tag" || fact.kind === "notable_video_hook",
  );
  if (!(item.visualScoring.videoHookStrength >= 80 || hasUsableVideoFact || tags.some((tag) =>
    ["first_seconds_strong", "scene_surprise", "actress_fit", "visual_mismatch", "safe_preview"].includes(tag),
  ))) reasons.push("video hook / fact strength不足");
  return [...new Set(reasons)];
}

/** Cheap, deterministic narrowing before the expensive Human Voice matrix. */
export function cheapCandidatePrefilter(items: XGrowthOpportunity[], limit = 300) {
  const ranked = [...items].sort((a, b) => {
    const visual = (candidate: XGrowthOpportunity) => candidate.visualScoring.videoHookStrength + candidate.visualScoring.visualSpecificity;
    const score = (candidate: XGrowthOpportunity) => Math.max(candidate.reachScore, candidate.followScore, candidate.authorityScore, candidate.revenueScore) + visual(candidate) * 0.08;
    return score(b) - score(a);
  });
  const selected = new Map<string, XGrowthOpportunity>();
  const add = (item: XGrowthOpportunity) => { if (selected.size < limit) selected.set(item.key, item); };
  // Decision Facts lanes are a hard supply requirement, not a score-only
  // preference. Reserve each available lane before role/source ranking fills
  // the bounded prefilter. Otherwise a large RECORD_LOW pool can consume all
  // slots and make the later lane-preservation pass a no-op.
  for (const decisionType of DECISION_TYPES) {
    const lane = ranked.filter((candidate) => isEligibleForDecisionType(candidate, decisionType));
    if (lane[0]) add(lane[0]);
  }
  for (const decisionType of DECISION_TYPES) {
    ranked.filter((candidate) => isEligibleForDecisionType(candidate, decisionType)).slice(1, 30).forEach(add);
  }
  for (const item of ranked.filter((candidate) => candidate.sourceType === "MONEY").slice(0, 30)) add(item);
  for (const role of ["REACH", "FOLLOW", "AUTHORITY", "MONEY"] as const) {
    [...ranked].sort((a, b) => {
      const score = (item: XGrowthOpportunity) => role === "REACH" ? item.reachScore : role === "FOLLOW" ? item.followScore : role === "AUTHORITY" ? item.authorityScore : item.revenueScore;
      return score(b) - score(a);
    }).slice(0, 30).forEach(add);
  }
  const perSource = new Map<string, number>();
  for (const item of ranked) {
    if ((perSource.get(item.sourceType) ?? 0) >= 3) continue;
    add(item);
    perSource.set(item.sourceType, (perSource.get(item.sourceType) ?? 0) + 1);
  }
  return ranked.filter((item) => selected.has(item.key)).slice(0, limit);
}

/** Keep Decision Facts lanes alive before applying the bounded score window. */
export function preserveDecisionLanesBeforeLimit(
  items: XGrowthOpportunity[],
  limit = 500,
  mustKeepWorkIds: ReadonlySet<number> = new Set(),
) {
  const selected = new Map<string, XGrowthOpportunity>();
  const add = (item: XGrowthOpportunity) => {
    if (selected.size < limit) selected.set(item.key, item);
  };
  for (const item of items) if (mustKeepWorkIds.has(item.workId)) add(item);
  for (const decisionType of DECISION_TYPES) {
    items.filter((item) => isEligibleForDecisionType(item, decisionType)).slice(0, 30).forEach(add);
  }
  for (const item of items) add(item);
  return [...selected.values()];
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
  const visualBoost = intent === "MONEY"
    ? item.visualScoring.mediaTextFit * 0.04
    : (item.visualScoring.videoHookStrength + item.visualScoring.visualSpecificity) * 0.05;
  return clamp(base * 0.2 + buzz * 0.34 + item.freshness.total * 0.18 + (creative?.quality.total ?? 0) * 0.16 + roleDiversityBonus + mediaPriority + visualBoost - adPenalty);
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
  const creative = item.creativeVariants.find((variant) => variant.intent === role && isSoftQualityEligible(variant))
    ?? item.creativeVariants.find((variant) => variant.intent === role);
  return interestAssets(item, role).length > 0 && Boolean(creative && isSoftQualityEligible(creative));
}

export function isSoftQualityEligible(variant: XCreativeVariant) {
  return variant.quality.passed
    || (variant.quality.recommendation === "revise"
      && variant.quality.lastMile.passed
      && variant.quality.lastMile.humanVoice.passed
      && variant.quality.lastMile.nativeXVoice.passed);
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

function concreteFactPhrase(text: string) {
  return text
    .replaceAll("入り方が少し予想と違う。", "冒頭の展開が予想と少し違う。")
    .replaceAll("ジャケとサンプルで印象が違う。", "ジャケとサンプルで見え方が違う.")
    .replaceAll("ジャケとサンプルで見え方が違う.", "ジャケとサンプルで見え方が違う。");
}

function endingPhrase(text: string) {
  return (text.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) ?? "")
    .replace(/[0-9０-９]+/g, "#")
    .slice(0, 18);
}

function numberPlacement(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const positions = lines.map((line, index) => /[0-9０-９]/.test(line) ? String(index + 1) : "").filter(Boolean);
  return positions.length ? positions.join(",") : "none";
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

function semanticCategoryForSlot(slotId: "slot_1" | "slot_2" | "slot_3", role: XGrowthIntent, category: XSemanticHookCategory) {
  const priority = slotId === "slot_1"
    ? ["jacket_video_mismatch", "brightness_shift", "opening_change", "pacing_change", "motion_shift", "visual_contrast", "hidden_find", "dry_observation"]
    : slotId === "slot_2"
      ? ["changed_mind", "visual_contrast", "hidden_find", "dry_observation", "motion_shift"]
      : role === "MONEY"
        ? ["price_reason", "social_proof", "comparison"]
        : ["brightness_shift", "opening_change", "pacing_change", "motion_shift", "visual_contrast", "hidden_find", "dry_observation", "changed_mind"];
  const index = priority.indexOf(category);
  return index < 0 ? 0 : priority.length - index;
}

function reactionType(variant: XCreativeVariant) {
  const reactions: Record<XCreativeVariant["hookDirection"], string> = {
    curiosity: "discovery", contradiction: "tension", hot_take: "changed_mind", follow_up: "conversation",
    comparison: "comparison", social_proof: "social_proof", confession: "confession", missed: "missed_then_noticed",
    surprise: "surprise", empathy: "empathy", question: "question", surprising_concentration: "market_pattern",
    contrast: "contrast", curation: "curation", anti_obvious: "anti_obvious", pattern_break: "pattern_break", selection_tension: "selection_tension",
  };
  return reactions[variant.hookDirection];
}

function judgmentShape(text: string, direction?: XCreativeVariant["hookDirection"]) {
  if (direction === "follow_up" || direction === "question") return "conversation_open";
  if (direction === "comparison" || direction === "contrast") return "compare_then_choose";
  if (direction === "hot_take" || direction === "anti_obvious") return "reject_obvious";
  if (direction === "missed" || direction === "confession") return "reconsider";
  if (direction === "social_proof") return "trust_signal";
  if (direction === "surprise" || direction === "pattern_break") return "notice_change";
  if (/見送|急がなくて|即決/.test(text)) return "defer";
  if (/見ておきたい|見たい|戻りそう/.test(text)) return "watch_next";
  if (/止める|残る|気になる/.test(text)) return "stop_on_reaction";
  if (/決め|選び|比べ/.test(text)) return "choose";
  return "open_observation";
}

function diversitySignature(item: XGrowthOpportunity, role: XGrowthIntent, variant: XCreativeVariant) {
  const semantic = assignSemanticHook(item, variant);
  const primaryFact = semantic.fact ?? primaryUsableVisualFact(item.visualFacts);
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
    endingPhrase: endingPhrase(variant.bodyText),
    numberPlacement: numberPlacement(variant.bodyText),
    semanticHookCategory: semantic.category,
    reactionType: reactionType(variant),
    judgmentShape: judgmentShape(variant.bodyText, variant.hookDirection),
    primaryFactKind: primaryFact?.kind ?? "none",
    abstractFallback: !primaryFact && /雰囲気|空気|印象|入り方/.test(variant.bodyText),
    semanticMappingReason: semantic.reason,
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
    if (picked.filter((entry) => entry.setDiversity.signature.semanticHookCategory === signature.semanticHookCategory).length >= 2) {
      reasons.push(`semantic_hook_category上限: ${signature.semanticHookCategory}`);
    }
    if (signature.semanticHookCategory === "generic_reaction" && picked.some((entry) => entry.setDiversity.signature.semanticHookCategory === "generic_reaction")) {
      reasons.push("generic_reactionは1件まで");
    }
    if (signature.abstractFallback && picked.some((entry) => entry.setDiversity.signature.abstractFallback)) {
      reasons.push("abstract fallbackは1件まで");
    }
    if (picked.filter((entry) => entry.setDiversity.signature.reactionType === signature.reactionType).length >= 2) {
      reasons.push(`reaction_type上限: ${signature.reactionType}`);
    }
    if (picked.filter((entry) => entry.setDiversity.signature.judgmentShape === signature.judgmentShape).length >= 2) {
      reasons.push(`judgment_shape上限: ${signature.judgmentShape}`);
    }
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
      signature.endingPhrase === other.endingPhrase,
      signature.numberPlacement === other.numberPlacement,
    ].filter(Boolean).length;
    if (sameShape >= 5) reasons.push(`当日セット類似: ${pick.pickOrder}件目と構造が近い`);
    if (textSimilarity(variant.bodyText, pick.postText) >= 0.58) reasons.push(`当日セット本文類似: ${pick.pickOrder}件目と近い`);
  }
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  const recentPhraseReuse = logs.filter((log) => new Date(log.posted_at).getTime() >= thirtyDaysAgo)
    .filter((log) => openingPattern(log.post_text) === signature.openingPattern || judgmentPhrase(log.post_text) === signature.judgmentPhrase)
    .length;
  if (recentPhraseReuse >= 2) reasons.push(`直近7日Novelty減点: opening/judgment同型 ${recentPhraseReuse}件`);
  return { ok: reasons.length === 0, signature, reasons };
}

function selectCandidateVariant(item: XGrowthOpportunity, role: XGrowthIntent, picked: XDailyTopPick[], logs: XPostLog[]) {
  const variants = item.creativeVariants
    .filter((variant) => variant.intent === role && isSoftQualityEligible(variant))
    .filter((variant) => variant.quality.dimensions.adSmell <= (role === "MONEY" ? 48 : 30))
    .map((variant) => {
      const audit = diversityConflicts(item, role, variant, picked, logs);
      const visualBoost = role === "MONEY"
        ? item.visualScoring.mediaTextFit * 0.04
        : (item.visualScoring.videoHookStrength + item.visualScoring.visualSpecificity) * 0.05;
      const score = clamp((variant.buzzPotential.total ?? 0) * 0.42 + variant.quality.total * 0.26 + item.freshness.total * 0.2 + visualBoost - audit.reasons.length * 10);
      return { variant, audit, score };
    })
    .sort((a, b) => Number(b.audit.ok) - Number(a.audit.ok) || b.score - a.score);
  const unusedText = variants.filter(({ variant }) => !picked.some((pick) => pick.postText.trim() === variant.bodyText.trim()));
  return (unusedText.length ? unusedText : variants)[0] ?? null;
}

function buildTopPickCandidate(input: {
  item: XGrowthOpportunity;
  role: XGrowthIntent;
  variant: XCreativeVariant;
  audit: ReturnType<typeof diversityConflicts>;
  score: number;
  pickOrder: number;
  slotId: XDailyTopPick["slotId"];
  slotRole: NonNullable<XDailyTopPick["slotRole"]>;
  slotLabel: string;
  candidateRank: NonNullable<XDailyTopPick["candidateRank"]>;
  reason: string;
}): XDailyTopPick {
  const decisionProof = input.item.decisionFacts ? decisionFactProofLine(input.item.decisionFacts) : "";
  const decisionPostText = decisionProof && !input.variant.bodyText.includes(decisionProof)
    ? `${decisionProof}\n${input.variant.bodyText}`
    : input.variant.bodyText;
  const pickMediaType = input.variant.mediaType === "data_card" && input.item.imageUrl
    ? "existing_link_image" as const
    : input.variant.mediaType === "sample_movie" && !isPostableOfficialSampleMovie(input.item.mediaAsset, input.item.sampleMovieUrl).usable
    ? input.item.imageUrl ? "existing_link_image" as const : "text" as const
    : input.variant.mediaType;
  const pickMediaUrl = pickMediaType === "sample_movie"
    ? input.item.mediaAsset?.source_url ?? input.item.sampleMovieUrl
    : pickMediaType === "existing_link_image" || pickMediaType === "data_card"
      ? pickMediaType === "data_card" ? `/api/admin/x-growth/media/download?workId=${input.item.workId}&mediaType=data_card` : input.item.imageUrl
      : null;
  return applyTopPickLinkPolicy({
    ...input.item,
    intent: input.role,
    postText: decisionPostText,
    replyText: input.variant.replyText,
    creativeVariantId: input.variant.id,
    mediaType: pickMediaType,
    mediaUsage: pickMediaType === "sample_movie" ? "allowed" : pickMediaUrl || pickMediaType === "text" || pickMediaType === "quote" ? "allowed" : "not_available",
    recommendedMediaUrl: pickMediaUrl,
    mediaDecision: pickMediaType === "sample_movie"
      ? "公式FANZA/DMM sample_movie_urlを無加工投稿用のネイティブ動画として使用可"
      : pickMediaType === "existing_link_image"
        ? input.role === "MONEY" ? "MONEY投稿は現在Xで使っている作品リンク画像を維持" : "作品画像を優先。本文は画像説明ではなく見る理由に絞る"
        : pickMediaType === "data_card"
          ? "比較自体が面白い場合だけデータカードを使用"
          : pickMediaType === "quote" ? "外部投稿確認後の引用候補。自動引用はしない" : "利用可能な画像/動画がないためテキストのみ",
    pickOrder: input.pickOrder,
    slotId: input.slotId,
    slotRole: input.slotRole,
    slotLabel: input.slotLabel,
    candidateRank: input.candidateRank,
    candidateId: `${input.slotId}-${input.candidateRank}-${input.item.key}-${input.variant.id}`.slice(0, 180),
    isSelected: input.candidateRank === "A",
    role: input.role,
    dailyScore: input.score,
    recommendedTimeLabel: recommendedTimeLabel(input.item.recommendedSlot),
    whyToday: whyToday(input.item, input.role),
    whyBuzz: buzzReason(input.item, input.role),
    notPostReason: null,
    alternativeReason: input.reason,
    setDiversity: {
      status: input.audit.ok ? "OK" : "NG",
      roleLabel: sourceRoleLabel(input.item.sourceType),
      signature: input.audit.signature,
      reasons: input.audit.reasons,
    },
  });
}

function recentPostedWorkIds(logs: XPostLog[]) {
  const cutoff = Date.now() - POSTED_WORK_COOLDOWN_DAYS * DAY_MS;
  return new Set(logs
    .filter((log) => Number.isSafeInteger(log.work_id) && new Date(log.posted_at).getTime() >= cutoff)
    .map((log) => log.work_id));
}

async function fetchRecentDailyPickWorkIds(days = DAILY_PICK_COOLDOWN_DAYS) {
  const since = tokyoDate(-days);
  const today = tokyoDate();
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .select("work_id,opportunity_date,opportunity_key,creative_genome")
    .eq("account_handle", "hakkutsu_lab")
    .gte("opportunity_date", since)
    .lt("opportunity_date", today)
    .like("opportunity_key", "daily-pick-%")
    .limit(100);
  if (error) return new Set<number>();
  return new Set((data ?? [])
    .filter((row) => {
      const pick = ((row as { creative_genome?: Record<string, unknown> | null }).creative_genome?.persisted_top_pick ?? null) as { isSelected?: boolean } | null;
      return pick?.isSelected !== false;
    })
    .map((row) => Number((row as { work_id?: unknown }).work_id))
    .filter((workId) => Number.isSafeInteger(workId) && workId > 0));
}

function selectDailyTopPicks(opportunities: XGrowthOpportunity[], mission: XDailyMission, logs: XPostLog[], recentDailyPickWorkIds = new Set<number>(), postedWorkIds = recentPostedWorkIds(logs)) {
  const hasRealMedia = (item: XGrowthOpportunity, variant?: XCreativeVariant | null) => {
    const mediaType = variant?.mediaType ?? item.mediaType;
    if (mediaType === "sample_movie") return Boolean(item.sampleMovieUrl) && isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable;
    return isAllowedXGrowthMediaType(mediaType) && mediaType === "existing_link_image" && Boolean(item.imageUrl);
  };
  const pool = opportunities.filter((item) => (
    isDecisionFactEligible(item)
    && item.freshness.status !== "expired"
    && item.mediaUsage !== "not_available"
    && hasRealMedia(item)
    && !postedWorkIds.has(item.workId)
    && !recentDailyPickWorkIds.has(item.workId)
  ));
  const picked: XDailyTopPick[] = [];
  const usedWorkIds = new Set<number>();
  const reachVideoTier = (item: XGrowthOpportunity) => {
    const asset = item.mediaAsset;
    const tags = asset?.manual_tags ?? [];
    if (!item.canNativeVideo || !isPostableOfficialSampleMovie(asset, item.sampleMovieUrl).usable) return { tier: "除外", score: -100, reason: "sample movie unusable" };
    if (tags.includes("too_explicit_for_reach") || tags.includes("weak_visual") || asset?.media_quality === "weak") return { tier: "除外", score: -90, reason: "REACH不向き/weak" };
    if (asset?.media_quality === "strong" && tags.includes("first_seconds_strong")) return { tier: "A", score: 58, reason: "冒頭1〜3秒が強い strong 動画" };
    if (asset?.media_quality === "strong" && (tags.includes("actress_fit") || tags.includes("scene_surprise") || tags.includes("visual_mismatch"))) return { tier: "B", score: 44, reason: "strong 動画に作品固有Hookあり" };
    if (asset?.media_quality === "normal" && (tags.includes("first_seconds_strong") || tags.includes("visual_mismatch") || tags.includes("actress_fit"))) return { tier: "C", score: 32, reason: "normal 動画に使えるHookあり" };
    return { tier: "C", score: 18, reason: "manual review済み動画" };
  };
  const slots = [
    { slotId: "slot_1" as const, slotRole: "REACH" as const, slotLabel: "投稿枠1: REACH中心", roles: ["REACH" as const] },
    { slotId: "slot_2" as const, slotRole: "FOLLOW_OR_AUTHORITY" as const, slotLabel: "投稿枠2: FOLLOW / AUTHORITY中心", roles: [mission.bottleneck === "Follow不足" ? "FOLLOW" as const : "AUTHORITY" as const, "FOLLOW" as const, "AUTHORITY" as const, "REACH" as const] },
    { slotId: "slot_3" as const, slotRole: "MONEY_OR_REACH" as const, slotLabel: "投稿枠3: MONEY または別REACH中心", roles: ["MONEY" as const, "REACH" as const, "FOLLOW" as const, "AUTHORITY" as const] },
  ];
  const rankLabels = ["A", "B", "C"] as const;
  const workUseCount = new Map<number, number>();
  const eligibleDecisionSupply = DECISION_TYPES.reduce((counts, type) => {
    counts[type] = pool.filter((item) => isEligibleForDecisionType(item, type)).length;
    return counts;
  }, {} as Record<DecisionType, number>);
  const semanticVariantCache = new Map<string, ReturnType<typeof selectCandidateVariant>>();
  const getCachedVariant = (item: XGrowthOpportunity, role: XGrowthIntent) => {
    const key = `${item.key}:${role}`;
    if (!semanticVariantCache.has(key)) semanticVariantCache.set(key, selectCandidateVariant(item, role, [], logs));
    return semanticVariantCache.get(key) ?? null;
  };
  for (const slot of slots) {
    const slotPicked: XDailyTopPick[] = [];
    for (const role of slot.roles) {
      const sourcePriority: XOpportunitySourceType[] = role === "MONEY"
        ? ["MONEY", "PRICE_EVENT", "WORK", "HIDDEN_GEM", "MARKET", "COMPARISON", "JUDGMENT", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND"]
        : role === "REACH"
          ? ["MARKET", "COMPARISON", "JUDGMENT", "HIDDEN_GEM", "PRICE_EVENT", "WORK", "FOLLOW_UP", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND"]
          : ["FOLLOW_UP", "HIDDEN_GEM", "ACTRESS_TREND", "GENRE_TREND", "MAKER_TREND", "WORK", "MARKET", "COMPARISON", "JUDGMENT", "PRICE_EVENT"];
      const candidateEntries = (allowCreativeReuse = false) => pool
        .filter((item) => allowCreativeReuse || !usedWorkIds.has(item.workId))
        .filter((item) => !slotPicked.some((pick) => pick.workId === item.workId || pick.productId === item.productId))
        .filter((item) => allowCreativeReuse
          ? ![...picked, ...slotPicked].some((pick) => candidateMediaDedupeKey(pick) === candidateMediaDedupeKey(item))
          : isDistinctCandidate(item, [...picked, ...slotPicked]))
        .filter((item) => !slotPicked.some((pick) => pick.key === item.key && pick.role === role))
        .filter((item) => role === "MONEY" || item.sourceType !== "MONEY")
        .filter((item) => passesLinklessQualityGate(item, role))
        .filter((item) => hasRealConversationSource(item, role))
        .map((item) => {
           const selected = getCachedVariant(item, role);
          const tier = role === "REACH" && selected?.variant.mediaType === "sample_movie" ? reachVideoTier(item) : null;
          const sourceIndex = sourcePriority.indexOf(item.sourceType);
          const sourceBonus = sourceIndex >= 0 ? Math.max(0, 12 - sourceIndex) : 0;
          const semanticCategory = selected?.audit.signature.semanticHookCategory;
          const usedSemanticCount = semanticCategory
            ? [...picked, ...slotPicked].filter((pick) => pick.setDiversity.signature.semanticHookCategory === semanticCategory).length
            : 0;
          const quota = semanticCategory ? SEMANTIC_CATEGORY_QUOTA[semanticCategory] : 0;
          const diversityBonus = semanticCategory
            ? usedSemanticCount < quota ? (usedSemanticCount === 0 ? 24 : 9) : -18
            : 0;
          const slotPriorityBonus = semanticCategory ? semanticCategoryForSlot(slot.slotId, role, semanticCategory) * 3 : 0;
          const repetitionPenalty = hasDiversityConflict(item, [...picked, ...slotPicked], logs) ? 10 : 0;
          // Multi-label eligibility supplies a lane, but only the lane's
          // presentation primary type satisfies primary-type coverage.
          const eligibleTypes = [decisionTypeForCandidate(item)];
          const selectedByDecisionType = [...picked, ...slotPicked].reduce((counts, pick) => {
            const type = decisionTypeForCandidate(pick);
            counts[type] = (counts[type] ?? 0) + 1;
            return counts;
          }, {} as Partial<Record<DecisionType, number>>);
          const decisionCoverageBonus = Math.max(0, ...eligibleTypes.map((type) => decisionCoverageScore(type, selectedByDecisionType, eligibleDecisionSupply)));
          const score = selected ? roleScore(item, role) + selected.score * 0.2 + sourceBonus + (tier?.score ?? 0) * 0.18 + diversityBonus + slotPriorityBonus + decisionCoverageBonus - repetitionPenalty : -1;
          return { item, selected, tier, score };
        })
        .filter((entry): entry is typeof entry & { selected: NonNullable<typeof entry.selected> } => Boolean(entry.selected))
        .filter(({ item, selected }) => {
          if (!hasRealMedia(item, selected.variant)) return false;
          if (role === "MONEY") return Boolean(selected.variant.url);
          if (selected.variant.mediaType !== "sample_movie") return true;
          const tags = item.mediaAsset?.manual_tags ?? [];
          return item.canNativeVideo && isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable && !tags.includes("too_explicit_for_reach") && item.mediaAsset?.media_quality !== "weak";
        })
        .sort((a, b) => {
          const categoryA = a.selected.audit.signature.semanticHookCategory;
          const categoryB = b.selected.audit.signature.semanticHookCategory;
          const slotPriority = semanticCategoryForSlot(slot.slotId, role, categoryB) - semanticCategoryForSlot(slot.slotId, role, categoryA);
          return slotPriority || b.score - a.score;
        });
      const addCandidates = (allowCreativeReuse = false) => {
        for (const entry of candidateEntries(allowCreativeReuse)) {
          if (slotPicked.length >= 3) break;
          if (!isDistinctCandidate(entry.item, slotPicked)) continue;
          if (!allowCreativeReuse && !isDistinctCandidate(entry.item, picked)) continue;
          if (allowCreativeReuse && (workUseCount.get(entry.item.workId) ?? 0) >= 3) continue;
          const category = entry.selected.audit.signature.semanticHookCategory;
          const usedCategoryCount = [...picked, ...slotPicked].filter((pick) => pick.setDiversity.signature.semanticHookCategory === category).length;
          if (usedCategoryCount >= SEMANTIC_CATEGORY_QUOTA[category]) continue;
        const rank = rankLabels[slotPicked.length];
        const reason = rank === "A"
          ? "システム推奨1位。Hard Gate通過候補の中でこの枠の狙いに最も近い"
          : entry.selected.audit.ok
            ? "安全に投稿可能な次点候補。スコア/tier差だけで落とさず比較用に残す"
            : `安全Gateは通過。${entry.selected.audit.reasons.slice(0, 2).join(" / ") || "同日セット内の新鮮味はやや弱い"}`;
        const pick = buildTopPickCandidate({
          item: entry.item,
          role,
          variant: entry.selected.variant,
          audit: entry.selected.audit,
          score: clamp(entry.score),
          pickOrder: slots.indexOf(slot) + 1,
          slotId: slot.slotId,
          slotRole: slot.slotRole,
          slotLabel: slot.slotLabel,
          candidateRank: rank,
          reason,
        });
        slotPicked.push(pick);
        }
      };
      addCandidates();
      if (slotPicked.length >= 3) break;
    }
    for (const pick of slotPicked) {
      picked.push(pick);
      workUseCount.set(pick.workId, (workUseCount.get(pick.workId) ?? 0) + 1);
      usedWorkIds.add(pick.workId);
    }
  }
  const selectedBeforeReplenishment = picked.length;
  // Last-mile allocator: fill only genuinely missing candidates after the
  // normal role/source pass. Hard gates and identity uniqueness remain strict;
  // only soft diversity preferences are relaxed in this pass.
  for (const allowSemanticQuotaOverflow of [false, true]) {
    if (allowSemanticQuotaOverflow && picked.length >= slots.length * 3) break;
    for (const slot of slots) {
      const slotPicks = picked.filter((pick) => pick.slotId === slot.slotId);
      if (slotPicks.length >= 3) continue;
      const fallbackRoles: XGrowthIntent[] = slot.slotId === "slot_1"
        ? ["REACH", "FOLLOW", "AUTHORITY"]
        : slot.roles;
      for (const role of fallbackRoles) {
        for (const item of pool
        .filter((candidate) => !usedWorkIds.has(candidate.workId))
        .filter((candidate) => !picked.some((pick) => pick.workId === candidate.workId || pick.productId === candidate.productId))
        .filter((candidate) => isDistinctCandidate(candidate, picked))
        .filter((candidate) => role === "MONEY" || candidate.sourceType !== "MONEY")
        .filter((candidate) => passesLinklessQualityGate(candidate, role))
        .filter((candidate) => hasRealConversationSource(candidate, role))
        .filter((candidate) => hasRealMedia(candidate))
        .map((candidate) => ({ candidate, selected: getCachedVariant(candidate, role) }))
        .filter((entry): entry is { candidate: XGrowthOpportunity; selected: NonNullable<ReturnType<typeof selectCandidateVariant>> } => Boolean(entry.selected))
        .filter((entry) => hasRealMedia(entry.candidate, entry.selected.variant))
        .sort((a, b) => {
          const categoryA = a.selected.audit.signature.semanticHookCategory;
          const categoryB = b.selected.audit.signature.semanticHookCategory;
          const usedA = picked.filter((pick) => pick.setDiversity.signature.semanticHookCategory === categoryA).length;
          const usedB = picked.filter((pick) => pick.setDiversity.signature.semanticHookCategory === categoryB).length;
          return usedA - usedB || b.selected.score - a.selected.score;
        })) {
        if (slotPicks.length >= 3) break;
        if (role === "MONEY" && !item.candidate.creativeVariants.some((variant) => variant.intent === "MONEY" && isSoftQualityEligible(variant) && Boolean(variant.url))) continue;
        const category = item.selected.audit.signature.semanticHookCategory;
        const usedCategoryCount = picked.filter((pick) => pick.setDiversity.signature.semanticHookCategory === category).length;
        if (!allowSemanticQuotaOverflow && usedCategoryCount >= SEMANTIC_CATEGORY_QUOTA[category]) continue;
        const rank = rankLabels[slotPicks.length];
        const pick = buildTopPickCandidate({
          item: item.candidate,
          role,
          variant: item.selected.variant,
          audit: item.selected.audit,
          score: clamp(item.selected.score),
          pickOrder: slots.indexOf(slot) + 1,
          slotId: slot.slotId,
          slotRole: slot.slotRole,
          slotLabel: slot.slotLabel,
          candidateRank: rank,
          reason: allowSemanticQuotaOverflow && usedCategoryCount >= SEMANTIC_CATEGORY_QUOTA[category]
            ? `供給不足の最終補充。${category}のquotaを超えるが、9候補維持のためHard Gate内で許可`
            : "不足枠の補充候補。別work・別素材を優先し、Hard Gateは維持",
        });
        slotPicks.push(pick);
        picked.push(pick);
        usedWorkIds.add(pick.workId);
        workUseCount.set(pick.workId, (workUseCount.get(pick.workId) ?? 0) + 1);
        }
        if (slotPicks.length >= 3) break;
      }
    }
  }
  const mediaMixStarted = Date.now();
  const videoRawItems = pool.filter((item) => isVideoCandidate({ ...item, mediaType: "sample_movie" }));
  const videoEligibleItems = videoRawItems.filter((item) => isOfficialEligibleVideoCandidate(item));
  const videoAfterDedupe = new Set(videoRawItems
    .map((item) => candidateMediaDedupeKey(item))
    .filter((key): key is string => Boolean(key))).size;
  const strongVideoSupply = new Map<string, XGrowthOpportunity>();
  const strongVideoVariant = (item: XGrowthOpportunity, roles: XGrowthIntent[]) => roles
    .flatMap((role) => item.creativeVariants
      .filter((variant) => variant.intent === role && variant.mediaType === "sample_movie" && variant.quality.passed)
      .filter((variant) => variant.quality.dimensions.adSmell <= (role === "MONEY" ? 48 : 30))
      .map((variant) => ({ role, selected: { variant, audit: diversityConflicts(item, role, variant, [], logs), score: variant.quality.total } })))
    .filter(({ selected }) => isStrongSafeVideoCandidate(item, selected.variant))
    .sort((a, b) => Number(b.selected.audit.ok) - Number(a.selected.audit.ok) || b.selected.score - a.selected.score)[0] ?? null;
  const slotRoles = (slotId: NonNullable<XDailyTopPick["slotId"]>) => slotId === "slot_1"
    ? ["REACH" as const, "FOLLOW" as const, "AUTHORITY" as const]
    : slotId === "slot_2"
      ? [mission.bottleneck === "Follow不足" ? "FOLLOW" as const : "AUTHORITY" as const, "FOLLOW" as const, "AUTHORITY" as const, "REACH" as const]
      : ["REACH" as const, "FOLLOW" as const, "AUTHORITY" as const];
  for (const item of pool) {
    const entry = strongVideoVariant(item, ["REACH", "FOLLOW", "AUTHORITY"]);
    if (entry) strongVideoSupply.set(candidateMediaDedupeKey(item) ?? `work:${item.workId}`, item);
  }
  const officialVideoSupply = new Map<string, XGrowthOpportunity>();
  const videoVariantFor = (item: XGrowthOpportunity, roles: XGrowthIntent[], strongOnly = false) => roles
    .flatMap((role) => item.creativeVariants
      .filter((variant) => variant.intent === role && variant.mediaType === "sample_movie" && isSoftQualityEligible(variant))
      .filter((variant) => variant.quality.dimensions.adSmell <= (role === "MONEY" ? 48 : 30))
      .map((variant) => ({ role, selected: { variant, audit: diversityConflicts(item, role, variant, [], logs), score: variant.quality.total } })))
    .filter(({ selected }) => isOfficialEligibleVideoCandidate(item) && (!strongOnly || isStrongSafeVideoCandidate(item, selected.variant)))
    .sort((a, b) => Number(b.selected.audit.ok) - Number(a.selected.audit.ok) || b.selected.score - a.selected.score)[0] ?? null;
  for (const item of videoEligibleItems) {
    const entry = videoVariantFor(item, ["REACH", "FOLLOW", "AUTHORITY", "MONEY"]);
    if (entry) officialVideoSupply.set(candidateMediaDedupeKey(item) ?? `work:${item.workId}`, item);
  }
  const isVideoPick = (pick: XDailyTopPick) => isVideoCandidate(pick);
  const isStrongVideoPick = (pick: XDailyTopPick) => {
    const variant = pick.creativeVariants.find((candidate) => candidate.id === pick.creativeVariantId);
    return isStrongSafeVideoCandidate(pick, variant);
  };
  const selectedStrongVideosBySlot = () => picked.reduce((counts, pick) => {
    if (isStrongVideoPick(pick)) counts[pick.slotId ?? "unassigned"] = (counts[pick.slotId ?? "unassigned"] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const swapVideoIntoSlot = (slotId: NonNullable<XDailyTopPick["slotId"]>, minimum: number, supply: Map<string, XGrowthOpportunity>, strongOnly = false) => {
    const selectedCount = () => strongOnly
      ? selectedStrongVideosBySlot()[slotId] ?? 0
      : picked.filter((pick) => pick.slotId === slotId && isVideoPick(pick)).length;
    while (selectedCount() < minimum) {
      const slotPicks = picked.filter((pick) => pick.slotId === slotId && !isVideoPick(pick));
      const replacement = [...supply.values()]
        .filter((item) => !picked.some((pick) => pick.workId === item.workId || pick.productId === item.productId))
        .map((item) => {
          const entry = videoVariantFor(item, strongOnly ? slotRoles(slotId) : ["REACH", "FOLLOW", "AUTHORITY", "MONEY"]);
          return entry ? { item, ...entry } : null;
        })
        .filter((entry): entry is { item: XGrowthOpportunity; role: XGrowthIntent; selected: NonNullable<ReturnType<typeof selectCandidateVariant>> } => Boolean(entry))
        .sort((a, b) => b.selected.score - a.selected.score);
      let swapped = false;
      for (const victim of slotPicks.sort((a, b) => a.dailyScore - b.dailyScore)) {
        const victimIndex = picked.indexOf(victim);
        const rest = picked.filter((_, index) => index !== victimIndex);
        for (const entry of replacement) {
          if (!isDistinctCandidate(entry.item, rest)) continue;
          // Media Mix is a soft target: semantic quotas may be exceeded here
          // when needed, while identity, rights, truth, and official-video
          // eligibility stay hard. Strong/safe is only a ranking preference.
          const audit = diversityConflicts(entry.item, entry.role, entry.selected.variant, rest, logs);
          picked[victimIndex] = buildTopPickCandidate({
            item: entry.item,
            role: entry.role,
            variant: entry.selected.variant,
            audit,
            score: clamp(entry.selected.score),
            pickOrder: victim.pickOrder,
            slotId,
            slotRole: victim.slotRole ?? (slotId === "slot_1" ? "REACH" : slotId === "slot_2" ? "FOLLOW_OR_AUTHORITY" : "MONEY_OR_REACH"),
            slotLabel: victim.slotLabel ?? "",
            candidateRank: victim.candidateRank ?? "C",
            reason: strongOnly ? "Media Mix Gate: strong/safe動画を局所swap" : "Media Mix fallback: official eligible動画を補充",
          });
          swapped = true;
          break;
        }
        if (swapped) break;
      }
      if (!swapped) break;
    }
  };
  // Reserve one unique strong/safe video in every slot whenever three are
  // available. Do this before the total quota so images cannot occupy the
  // only video-capable position in a slot.
  const perSlotVideoMinimum = strongVideoSupply.size >= 3 ? 1 : 0;
  for (const slot of ["slot_1", "slot_2", "slot_3"] as const) {
    swapVideoIntoSlot(slot, perSlotVideoMinimum, strongVideoSupply, true);
  }
  // Strong/safe is not a hard supply gate. Reserve one official eligible
  // video in every slot before filling the remaining media quota.
  for (const slot of ["slot_1", "slot_2", "slot_3"] as const) {
    swapVideoIntoSlot(slot, 1, officialVideoSupply);
  }
  // Four videos is the minimum target when supply supports it; use five when
  // possible. Image candidates remain the fallback only when this supply is
  // unavailable or cannot pass the existing hard safety gates.
  const totalVideoTarget = officialVideoSupply.size >= 4 ? Math.min(5, officialVideoSupply.size) : 0;
  if (totalVideoTarget > 0) {
    for (const slot of ["slot_1", "slot_2", "slot_3"] as const) {
      if (picked.filter(isVideoPick).length >= totalVideoTarget) break;
      swapVideoIntoSlot(slot, perSlotVideoMinimum + 1, officialVideoSupply);
    }
    // A slot-local role may have no replaceable image even though another
    // slot can safely accept an official eligible video. Finish the global
    // quota with a soft, all-role pass while preserving identity and rights.
    let progressed = true;
    while (picked.filter(isVideoPick).length < totalVideoTarget && progressed) {
      progressed = false;
      for (const slot of ["slot_1", "slot_2", "slot_3"] as const) {
        if (picked.filter(isVideoPick).length >= totalVideoTarget) break;
        const before = picked.filter(isVideoPick).length;
        const slotVideoCount = picked.filter((pick) => pick.slotId === slot && isVideoPick(pick)).length;
        swapVideoIntoSlot(slot, slotVideoCount + 1, officialVideoSupply);
        if (picked.filter(isVideoPick).length > before) progressed = true;
      }
    }
  }
  // Media Mix and fallback swaps are allowed to change identity. Repair any
  // collision immediately before diagnostics/persistence, using only hard-gated
  // unused candidates and never relaxing rights or truth constraints.
  for (let index = 0; index < picked.length; index += 1) {
    const current = picked[index];
    const rest = picked.filter((_, candidateIndex) => candidateIndex !== index);
    if (isDistinctCandidate(current, rest) && !postedWorkIds.has(current.workId)) continue;
    const replacement = pool
      .filter((candidate) => !postedWorkIds.has(candidate.workId) && isDistinctCandidate(candidate, rest))
      .flatMap((candidate) => {
        // A duplicate can be created by an older persisted plan or by a media
        // swap whose original role has no remaining variant. Reuse the slot's
        // allowed roles for the replacement, while keeping the candidate and
        // media identity hard gates unchanged.
        const roles = [current.role, ...slotRoles(current.slotId ?? "slot_1")].filter((role, roleIndex, all) => all.indexOf(role) === roleIndex);
        return roles.flatMap((role) => {
          const selected = getCachedVariant(candidate, role);
          return selected ? [{ candidate, role, selected }] : [];
        });
      })
      .filter(({ candidate, role, selected }) => {
        if (role !== "MONEY" && selected.variant.mediaType === "sample_movie") {
          const tags = candidate.mediaAsset?.manual_tags ?? [];
          if (!candidate.canNativeVideo || !isPostableOfficialSampleMovie(candidate.mediaAsset, candidate.sampleMovieUrl).usable) return false;
          if (tags.includes("too_explicit_for_reach") || candidate.mediaAsset?.media_quality === "weak") return false;
        }
        return hasRealMedia(candidate, selected.variant);
      })
      .sort((a, b) => b.selected.score - a.selected.score)[0];
    if (!replacement) continue;
    const audit = diversityConflicts(replacement.candidate, replacement.role, replacement.selected.variant, rest, logs);
    picked[index] = buildTopPickCandidate({
      item: replacement.candidate,
      role: replacement.role,
      variant: replacement.selected.variant,
      audit,
      score: clamp(replacement.selected.score),
      pickOrder: current.pickOrder,
      slotId: current.slotId,
      slotRole: current.slotRole ?? "REACH",
      slotLabel: current.slotLabel ?? "",
      candidateRank: current.candidateRank ?? "C",
      reason: "最終Unique Audit: duplicate work/media/urlを別role候補でhard gate内に修復",
    });
  }
  const uniqueAudit = auditCandidateUniqueness(picked, postedWorkIds);
  const selectedVideos = picked.filter(isVideoPick).length;
  const selectedBySlot = picked.reduce((counts, pick) => {
    if (isVideoPick(pick)) counts[pick.slotId ?? "unassigned"] = (counts[pick.slotId ?? "unassigned"] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const rejectionReasons: Record<string, number> = {};
  for (const item of pool) {
    const videoVariants = item.creativeVariants.filter((variant) => variant.mediaType === "sample_movie");
    const variant = [...videoVariants].sort((a, b) => b.quality.total - a.quality.total)[0] ?? null;
    for (const reason of videoEligibilityReasons({ ...item, mediaType: "sample_movie" }, variant)) {
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    }
  }
  const mediaMix = {
    totalVideoCandidates: videoRawItems.length,
    videoRaw: videoRawItems.length,
    videoEligible: videoEligibleItems.length,
    videoAfterDedupe,
    slotEligibleVideo: strongVideoSupply.size,
    eligibleStrongVideos: strongVideoSupply.size,
    eligibleOfficialVideos: officialVideoSupply.size,
    officialCandidateCount: videoEligibleItems.length,
    officialVariantEligibleCount: officialVideoSupply.size,
    selectedVideos,
    fallbackOfficialSelected: Math.max(0, selectedVideos - strongVideoSupply.size),
    selectedVideosBySlot: selectedBySlot,
    rejectionReasons,
    uniqueAudit,
    targetVideos: totalVideoTarget,
    unmetReason: totalVideoTarget > selectedVideos
      ? "公式eligible動画は存在するが、semantic diversityまたはduplicate/work制約を壊さずswapできる候補が不足"
      : strongVideoSupply.size < 3 ? "strong/safe動画供給が3件未満"
        : null,
    mediaMixMs: Date.now() - mediaMixStarted,
  };
  const selectedByDecisionType = DECISION_TYPES.reduce((counts, type) => {
    counts[type] = picked.filter((pick) => decisionTypeForCandidate(pick) === type).length;
    return counts;
  }, {} as Record<DecisionType, number>);
  const reason = picked.length ? null : "今日の候補は鮮度、Creative Gate、素材可否、直近投稿との重複のいずれかで基準未達です。投稿しない判断が安全です。";
  return {
    picks: picked,
    reason,
    mediaMix,
    decisionSelection: {
      eligibleSupply: eligibleDecisionSupply,
      dedupedEligibleSupply: new Set(pool.map((item) => candidateDedupeKey(item))).size,
      selectedBeforeReplenishment,
      replenished: Math.max(0, picked.length - selectedBeforeReplenishment),
      selected: picked.length,
      selectedByType: selectedByDecisionType,
    },
  };
}

type DiversityAudit = {
  exactText: number;
  opening: number;
  sentencePattern: number;
  ending: number;
};

function dailyDiversityKey(text: string) {
  return {
    exactText: text.trim(),
    opening: normalizedOpening(text),
    sentencePattern: sentenceStructure(text),
    ending: endingPhrase(text),
  };
}

function auditDailyDiversity(picks: XDailyTopPick[]): DiversityAudit {
  const counts = {
    exactText: new Map<string, number>(),
    opening: new Map<string, number>(),
    sentencePattern: new Map<string, number>(),
    ending: new Map<string, number>(),
  };
  for (const pick of picks) {
    const key = dailyDiversityKey(pick.postText);
    for (const field of Object.keys(counts) as Array<keyof typeof counts>) {
      const value = key[field];
      counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
    }
  }
  return {
    exactText: Math.max(0, ...counts.exactText.values()),
    opening: Math.max(0, ...counts.opening.values()),
    sentencePattern: Math.max(0, ...counts.sentencePattern.values()),
    ending: Math.max(0, ...counts.ending.values()),
  };
}

function finalDiversityGate(picks: XDailyTopPick[], logs: XPostLog[]) {
  const accepted: XDailyTopPick[] = [];
  const conflict = (pick: XDailyTopPick) => {
    const candidate = dailyDiversityKey(pick.postText);
    const prior = accepted.map((item) => dailyDiversityKey(item.postText));
    const semantic = pick.setDiversity.signature;
    const priorSignatures = accepted.map((item) => item.setDiversity.signature);
    return !isDistinctCandidate(pick, accepted)
      || priorSignatures.filter((key) => key.semanticHookCategory === semantic.semanticHookCategory).length >= 2
      || (semantic.semanticHookCategory === "generic_reaction" && priorSignatures.some((key) => key.semanticHookCategory === "generic_reaction"))
      || (semantic.abstractFallback && priorSignatures.some((key) => key.abstractFallback))
      || priorSignatures.filter((key) => key.reactionType === semantic.reactionType).length >= 2
      || priorSignatures.filter((key) => key.judgmentShape === semantic.judgmentShape).length >= 2
      || prior.some((key) => key.exactText === candidate.exactText)
      || prior.filter((key) => key.opening === candidate.opening).length >= 2
      || prior.filter((key) => key.sentencePattern === candidate.sentencePattern).length >= 2
      || prior.filter((key) => key.ending === candidate.ending).length >= 2;
  };
  for (const current of picks) {
    const variants = current.creativeVariants
      .filter((variant) => variant.intent === current.role && variant.quality.passed)
      .filter((variant) => variant.quality.dimensions.adSmell <= (current.role === "MONEY" ? 48 : 30))
      .map((variant) => {
        const audit = diversityConflicts(current, current.role, variant, accepted, logs);
        return { variant, audit };
      })
      .sort((a, b) => Number(a.audit.ok) - Number(b.audit.ok) || b.variant.quality.total - a.variant.quality.total);
    const ordered = [
      ...variants.filter(({ variant }) => variant.id === current.creativeVariantId),
      ...variants.filter(({ variant }) => variant.id !== current.creativeVariantId),
    ];
    const selected = ordered.find(({ variant }) => {
      const rebuilt = buildTopPickCandidate({
        item: current,
        role: current.role,
        variant,
        audit: diversityConflicts(current, current.role, variant, accepted, logs),
        score: current.dailyScore,
        pickOrder: current.pickOrder,
        slotId: current.slotId ?? "slot_1",
        slotRole: current.slotRole ?? "REACH",
        slotLabel: current.slotLabel ?? "",
        candidateRank: current.candidateRank ?? "A",
        reason: current.alternativeReason ?? "最終Diversity Gateで選択",
      });
      return !conflict(rebuilt);
    });
    if (selected) {
      const rebuilt = buildTopPickCandidate({
        item: current,
        role: current.role,
        variant: selected.variant,
        audit: selected.audit,
        score: current.dailyScore,
        pickOrder: current.pickOrder,
        slotId: current.slotId ?? "slot_1",
        slotRole: current.slotRole ?? "REACH",
        slotLabel: current.slotLabel ?? "",
        candidateRank: current.candidateRank ?? "A",
        reason: current.alternativeReason ?? "最終Diversity Gateで選択",
      });
      accepted.push({
        ...rebuilt,
        setDiversity: { ...rebuilt.setDiversity, status: "OK", reasons: [] },
      });
    } else {
      // Some source families legitimately produce the same safe body for all
      // variants. Keep the fact and link policy, but make a structural rewrite
      // before allowing the set to fail. This is deliberately more than a
      // one-character suffix change: the opening, sentence count, and ending
      // are changed together.
      const subject = current.actress?.split(/[,、/]/)[0]?.trim()
        ?? current.genre?.split(/[,、/]/)[0]?.trim()
        ?? "この一本";
      const openings = [
        `${subject}で、先に残ったのはこの空気。`,
        `流し見の中で、${subject}だけ少し引っかかった。`,
        `先に気になったのは、${subject}の入り方。`,
        `数字より先に、${subject}の空気が残る。`,
        `今日は一覧より、${subject}から見たくなる。`,
      ];
      const endings = [
        "こういう見つけ方もある。",
        "これは先に見ておきたい。",
        "この一本はあとで戻りそう。",
        "今日はここで止める。",
        "気になるなら、まずサンプルだけ。",
      ];
      const visualPhrase = concreteFactPhrase(primaryUsableVisualFact(current.visualFacts)?.safePhrase ?? "");
      const oldLines = current.postText.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !/^https?:\/\//.test(line));
      const middle = visualPhrase && !oldLines.includes(visualPhrase) ? visualPhrase : oldLines[1] ?? "";
      const rewrittenBody = [decisionFactProofLine(current.decisionFacts), openings[accepted.length % openings.length], middle, endings[accepted.length % endings.length]].filter(Boolean).join("\n");
      const rewritten = applyTopPickLinkPolicy({ ...current, postText: rewrittenBody });
      rewritten.setDiversity.signature = diversitySignature(rewritten, rewritten.role, rewritten.creativeVariants.find((variant) => variant.id === rewritten.creativeVariantId) ?? rewritten.creativeVariants[0]);
      if (!conflict(rewritten)) {
        const selectedId = rewritten.creativeVariantId;
        accepted.push({
          ...rewritten,
          creativeVariants: rewritten.creativeVariants.map((variant) => variant.id === selectedId ? { ...variant, bodyText: rewritten.postText } : variant),
          setDiversity: { ...rewritten.setDiversity, status: "OK", reasons: ["最終Diversity Gateでopening・文型・語尾を構造変更"] },
        });
      } else if (isDistinctCandidate(current, accepted)) {
        accepted.push({
          ...current,
          setDiversity: { ...current.setDiversity, status: "NG", reasons: [...current.setDiversity.reasons, "最終Diversity Gateを通過する代替文が不足"] },
        });
      }
    }
  }
  // Defensive second pass: persisted plans must satisfy the same hard limits
  // even when every generated variant for a source family was identical.
  const hardened: XDailyTopPick[] = [];
  for (const [index, current] of accepted.entries()) {
    let next = current;
    let attempt = 0;
    while (attempt < 8) {
      const key = dailyDiversityKey(next.postText);
      const prior = hardened.map((item) => dailyDiversityKey(item.postText));
      const semantic = next.setDiversity.signature;
      const priorSignatures = hardened.map((item) => item.setDiversity.signature);
      const conflict = priorSignatures.filter((item) => item.semanticHookCategory === semantic.semanticHookCategory).length >= 2
        || !isDistinctCandidate(next, hardened)
        || (semantic.semanticHookCategory === "generic_reaction" && priorSignatures.some((item) => item.semanticHookCategory === "generic_reaction"))
        || (semantic.abstractFallback && priorSignatures.some((item) => item.abstractFallback))
        || priorSignatures.filter((item) => item.reactionType === semantic.reactionType).length >= 2
        || priorSignatures.filter((item) => item.judgmentShape === semantic.judgmentShape).length >= 2
        || prior.some((item) => item.exactText === key.exactText)
        || prior.filter((item) => item.opening === key.opening).length >= 2
        || prior.filter((item) => item.sentencePattern === key.sentencePattern).length >= 2
        || prior.filter((item) => item.ending === key.ending).length >= 2;
      if (!conflict) break;
      const subject = current.actress?.split(/[,、/]/)[0]?.trim() ?? current.genre?.split(/[,、/]/)[0]?.trim() ?? "この一本";
      const openings = [`${subject}で、先に残ったのはこの空気。`, `流し見の中で、${subject}だけ少し引っかかった。`, `先に気になったのは、${subject}の入り方。`, `数字より先に、${subject}の空気が残る。`, `今日は一覧より、${subject}から見たくなる。`];
      const endings = ["こういう見つけ方もある。", "これは先に見ておきたい。", "この一本はあとで戻りそう。", "今日はここで止める。", "気になるなら、まずサンプルだけ。"];
      const lines = current.postText.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !/^https?:\/\//.test(line));
       const middle = concreteFactPhrase(primaryUsableVisualFact(current.visualFacts)?.safePhrase ?? lines[1] ?? "");
      const shape = (index + attempt) % 5;
      const bodyLines = shape === 0
        ? [openings[(index + attempt) % openings.length], endings[(index + attempt) % endings.length]]
        : shape === 1
          ? [openings[(index + attempt) % openings.length], `${subject}を見てから決めたい。`, endings[(index + attempt) % endings.length]]
          : shape === 2
            ? [openings[(index + attempt) % openings.length], middle, `${subject}なら、今日はここで止める。`]
            : shape === 3
              ? [openings[(index + attempt) % openings.length], `${subject}の印象だけ残った。`, endings[(index + attempt) % endings.length]]
              : [openings[(index + attempt) % openings.length], middle, endings[(index + attempt) % endings.length]];
      const body = [decisionFactProofLine(current.decisionFacts), ...bodyLines].filter(Boolean).join("\n");
      next = applyTopPickLinkPolicy({ ...current, postText: body });
      next.setDiversity.signature = diversitySignature(next, next.role, next.creativeVariants.find((variant) => variant.id === next.creativeVariantId) ?? next.creativeVariants[0]);
      next = { ...next, creativeVariants: next.creativeVariants.map((variant) => variant.id === next.creativeVariantId ? { ...variant, bodyText: next.postText } : variant) };
      attempt += 1;
    }
    hardened.push({ ...next, setDiversity: { ...next.setDiversity, status: "OK", reasons: attempt ? ["最終Diversity Gateで重複を構造的に解消"] : [] } });
  }
  return { picks: hardened, audit: auditDailyDiversity(hardened) };
}

function replenishAfterFinalDiversity(
  picks: XDailyTopPick[],
  opportunities: XGrowthOpportunity[],
  mission: XDailyMission,
  logs: XPostLog[],
  postedWorkIds: ReadonlySet<number>,
) {
  const next = [...picks];
  const slots = [
    { id: "slot_1" as const, role: "REACH" as const, label: "投稿枠1: REACH中心" },
    { id: "slot_2" as const, role: mission.bottleneck === "Follow不足" ? "FOLLOW" as const : "AUTHORITY" as const, label: "投稿枠2: FOLLOW / AUTHORITY中心" },
    { id: "slot_3" as const, role: "MONEY" as const, label: "投稿枠3: MONEY または別REACH中心" },
  ];
  const roleFallbacks: Record<typeof slots[number]["id"], XGrowthIntent[]> = {
    slot_1: ["REACH", "FOLLOW", "AUTHORITY"],
    slot_2: [slots[1].role, "FOLLOW", "AUTHORITY", "REACH"],
    slot_3: ["MONEY", "REACH", "FOLLOW", "AUTHORITY"],
  };
  const hasRealMedia = (item: XGrowthOpportunity, variant: XCreativeVariant) => {
    if (variant.mediaType === "existing_link_image") return Boolean(item.imageUrl);
    if (variant.mediaType !== "sample_movie") return false;
    const tags = item.mediaAsset?.manual_tags ?? [];
    return Boolean(item.sampleMovieUrl)
      && item.canNativeVideo
      && isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable
      && !tags.includes("too_explicit_for_reach")
      && item.mediaAsset?.media_quality !== "weak";
  };
  const slotCount = (slotId: NonNullable<XDailyTopPick["slotId"]>) => next.filter((pick) => pick.slotId === slotId).length;
  for (const slot of slots) {
    while (slotCount(slot.id) < 3) {
      const missingTypes = new Set(DECISION_TYPES.filter((type) => !next.some((pick) => decisionTypeForCandidate(pick) === type)));
      const candidates = roleFallbacks[slot.id]
        .flatMap((role) => opportunities.map((item) => ({ item, role, selected: selectCandidateVariant(item, role, next, logs) })))
        .filter((entry): entry is { item: XGrowthOpportunity; role: XGrowthIntent; selected: NonNullable<ReturnType<typeof selectCandidateVariant>> } => Boolean(entry.selected))
        .filter(({ item, role, selected }) => isDecisionFactEligible(item)
          && item.freshness.status !== "expired"
          && !postedWorkIds.has(item.workId)
          && !next.some((pick) => pick.workId === item.workId || pick.productId === item.productId)
          && isDistinctCandidate(item, next)
          && (role === "MONEY" || item.sourceType !== "MONEY")
          && selected.variant.quality.passed
          && selected.variant.quality.dimensions.adSmell <= (role === "MONEY" ? 48 : 30)
          && hasRealMedia(item, selected.variant)
          && (role !== "MONEY" || Boolean(selected.variant.url)))
        .sort((a, b) => Number(missingTypes.has(decisionTypeForCandidate(b.item))) - Number(missingTypes.has(decisionTypeForCandidate(a.item))) || b.selected.score - a.selected.score);
      let added = false;
      for (const entry of candidates) {
        const audit = diversityConflicts(entry.item, entry.role, entry.selected.variant, next, logs);
        const candidate = buildTopPickCandidate({
          item: entry.item,
          role: entry.role,
          variant: entry.selected.variant,
          audit,
          score: clamp(entry.selected.score),
          pickOrder: slots.findIndex((value) => value.id === slot.id) + 1,
          slotId: slot.id,
          slotRole: slot.id === "slot_1" ? "REACH" : slot.id === "slot_2" ? "FOLLOW_OR_AUTHORITY" : "MONEY_OR_REACH",
          slotLabel: slot.label,
          candidateRank: "C",
          reason: "最終Diversity Gate後の補充。Hard Gate・別work・別素材を維持",
        });
        const checked = finalDiversityGate([...next, candidate], logs).picks;
        if (checked.length !== next.length + 1) continue;
        next.push({ ...candidate, setDiversity: { ...candidate.setDiversity, status: "OK", reasons: [] } });
        added = true;
        break;
      }
      if (!added) break;
    }
  }
  return next;
}

function stripUrls(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !/^https?:\/\//.test(line))
    .join("\n")
    .trim();
}

function appendUrlIfMissing(text: string, url: string) {
  const clean = text.trim();
  return clean.includes(url) ? clean : `${clean}\n${url}`;
}

function selfReplyText(url: string) {
  return `#PR\n必要な時だけ確認用です。\n${url}`;
}

function applyTopPickLinkPolicy(item: XDailyTopPick): XDailyTopPick {
  const selectedVariant = item.creativeVariants.find((variant) => variant.id === item.creativeVariantId) ?? item.creativeVariants[0];
  if (item.role !== "MONEY") {
    return {
      ...item,
      postText: stripUrls(item.postText),
      replyText: null,
      setDiversity: {
        ...item.setDiversity,
        signature: {
          ...item.setDiversity.signature,
          linkStrategy: "no_link",
        },
      },
    };
  }
  const url = selectedVariant?.url ?? item.creativeVariants[0]?.url ?? `/works/${item.workId}`;
  const linkPlan = selectedVariant?.linkPlan === "reply_link" ? "reply_link" : "body_link";
  if (linkPlan === "reply_link") {
    return {
      ...item,
      postText: stripUrls(item.postText),
      replyText: selfReplyText(url),
      setDiversity: {
        ...item.setDiversity,
        signature: {
          ...item.setDiversity.signature,
          linkStrategy: "reply_link",
        },
      },
    };
  }
  return {
    ...item,
    postText: appendUrlIfMissing(stripUrls(item.postText), url),
    replyText: null,
    setDiversity: {
      ...item.setDiversity,
      signature: {
        ...item.setDiversity.signature,
        linkStrategy: "body_link",
      },
    },
  };
}

function emptySemanticCounts() {
  return Object.keys(SEMANTIC_CATEGORY_QUOTA).reduce((counts, category) => {
    counts[category as XSemanticHookCategory] = 0;
    return counts;
  }, {} as Record<XSemanticHookCategory, number>);
}

function semanticSupplyDiagnostics(opportunities: XGrowthOpportunity[], picks: XDailyTopPick[]) {
  const supply = emptySemanticCounts();
  const mappingReasons: Record<string, number> = {};
  for (const item of opportunities) {
    const categories = new Set(item.creativeVariants
      .filter((variant) => variant.quality.passed)
      .map((variant) => {
        const assignment = assignSemanticHook(item, variant);
        const key = `${assignment.category}: ${assignment.reason}`;
        mappingReasons[key] = (mappingReasons[key] ?? 0) + 1;
        return assignment.category;
      }));
    for (const category of categories) supply[category] += 1;
  }
  const selected = emptySemanticCounts();
  for (const pick of picks) selected[pick.setDiversity.signature.semanticHookCategory] += 1;
  const selectedTotal = Object.values(selected).reduce((sum, count) => sum + count, 0);
  const quotaCapacity = Object.entries(supply).reduce((sum, [category, count]) => {
    const typedCategory = category as XSemanticHookCategory;
    return sum + Math.min(count, SEMANTIC_CATEGORY_QUOTA[typedCategory]);
  }, 0);
  const overflowReasons = Object.entries(selected)
    .filter(([category, count]) => count > SEMANTIC_CATEGORY_QUOTA[category as XSemanticHookCategory])
    .map(([category, count]) => {
      const typedCategory = category as XSemanticHookCategory;
      return supply[typedCategory] < count
        ? `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / supply不足でoverflow`
        : selectedTotal > quotaCapacity
          ? `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / 利用可能categoryのquota容量${quotaCapacity}件/${selectedTotal}件でoverflow（供給不足）`
          : `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / quota超過`;
    });
  return { supply, selected, overflowReasons, mappingReasons };
}

function rawVideoEligibilityReasons(item: XGrowthOpportunity) {
  const reasons: string[] = [];
  if (!isVideoCandidate({ ...item, mediaType: "sample_movie" })) reasons.push("video media/sample_movie_urlなし");
  if (!item.canNativeVideo) reasons.push("rightsまたはX使用可否未確認");
  if (!isPostableOfficialSampleMovie(item.mediaAsset, item.sampleMovieUrl).usable) reasons.push("official sample / fetch / safety gate NG");
  return [...new Set(reasons)];
}

export function buildXGrowthVariantDiagnostic(
  item: XGrowthOpportunity,
  variant: XCreativeVariant,
  picks: readonly XDailyTopPick[] = [],
): XGrowthVariantDiagnostic {
  const selectedPick = picks.find((pick) => pick.workId === item.workId && pick.creativeVariantId === variant.id);
  const sameWorkSelected = picks.some((pick) => pick.workId === item.workId);
  const isVideo = variant.mediaType === "sample_movie";
  const officialEligible = isVideo && isOfficialEligibleVideoCandidate(item);
  const strongSafeEligible = isVideo && isStrongSafeVideoCandidate(item, variant);
  const finalCandidate = isVideo
    && officialEligible
    && isSoftQualityEligible(variant)
    && variant.quality.dimensions.adSmell <= (variant.intent === "MONEY" ? 48 : 30);
  const videoReasons = isVideo ? videoEligibilityReasons({ ...item, mediaType: "sample_movie" }, variant) : [];
  const selected = Boolean(selectedPick);
  const selectedReason = selected
    ? selectedPick?.alternativeReason || selectedPick?.whyBuzz || "最終候補として選定"
    : sameWorkSelected
      ? "同一workの別variant/roleを選定"
      : !variant.quality.passed
        ? `quality gate NG: ${variant.quality.gate.failed.join(", ") || variant.quality.lastMile.reasons.join(" / ") || variant.quality.recommendation}`
        : isVideo && !finalCandidate
          ? `動画供給候補外: ${videoReasons.join(" / ") || "official/soft-quality条件未達"}`
          : "枠・多様性・重複・スコアによる最終選定で非選択（個別reject codeなし）";
  return {
    workId: item.workId,
    slot: selectedPick?.slotId ?? null,
    role: variant.intent,
    variantId: variant.id,
    mediaType: variant.mediaType,
    sampleMovie: {
      isSampleMovie: isVideo,
    mediaAssetId: isVideo && Number.isSafeInteger(Number(item.mediaAsset?.id)) ? Number(item.mediaAsset?.id) : null,
      sourceUrl: isVideo ? item.mediaAsset?.source_url ?? item.sampleMovieUrl ?? null : null,
    },
    factTypes: item.visualFacts.facts.map((fact) => fact.kind),
    videoEligibility: isVideo ? { eligible: officialEligible, reasons: rawVideoEligibilityReasons(item) } : null,
    postText: variant.bodyText,
    humanVoice: variant.quality.lastMile.humanVoice,
    nativeXVoice: variant.quality.lastMile.nativeXVoice,
    lastMile: {
      passed: variant.quality.lastMile.passed,
      verdict: variant.quality.lastMile.verdict,
      checks: {
        humanVoice: variant.quality.lastMile.humanVoice.passed,
        nativeXVoice: variant.quality.lastMile.nativeXVoice.passed,
        noReasons: variant.quality.lastMile.reasons.length === 0,
      },
      reasons: variant.quality.lastMile.reasons,
    },
    quality: {
      passed: variant.quality.passed,
      recommendation: variant.quality.recommendation,
      score: variant.quality.total,
      failedReasons: [...variant.quality.gate.failed, ...variant.quality.lastMile.reasons],
    },
    isSoftQualityEligible: isSoftQualityEligible(variant),
    videoSupply: isVideo ? {
      officialEligible,
      strongSafeEligible,
      finalCandidate,
      selected,
      reason: selected
        ? "最終動画候補としてselected"
        : officialEligible && finalCandidate
          ? "official/soft-quality条件は通過したが最終枠では非選択"
          : videoReasons.join(" / ") || "official/soft-quality条件未達",
    } : null,
    selected,
    selectedReason,
  };
}

function buildSupplyDiagnostics(
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  candidateDiagnostics: {
    sourcePoolTotal?: number;
    sourcePoolAfterPosted?: number;
    postedExcluded?: number;
    prefilterCount?: number;
    humanVoiceTargetCount?: number;
    diversityTargetCount?: number;
    pipeline?: Record<string, number>;
    decisionSupply?: Record<string, {
      dbFetchedWorks?: number;
      dbRawWorks?: number;
      afterPostedCooldown?: number;
      chartEligible?: number;
      uniqueWorks?: number;
      firstDropReasonCounts?: Record<string, number>;
      firstDropByWorkId?: Record<string, string>;
    }>;
  } | undefined,
  decisionSelection: {
    eligibleSupply: Record<DecisionType, number>;
    dedupedEligibleSupply: number;
    selectedBeforeReplenishment: number;
    replenished: number;
    selected: number;
    selectedByType: Record<DecisionType, number>;
  } | undefined,
  postedWorkIds: ReadonlySet<number>,
  mediaMix?: {
    totalVideoCandidates: number;
    videoRaw: number;
    videoEligible: number;
    videoAfterDedupe: number;
    slotEligibleVideo: number;
    eligibleStrongVideos: number;
    eligibleOfficialVideos: number;
    officialCandidateCount: number;
    officialVariantEligibleCount: number;
    selectedVideos: number;
    fallbackOfficialSelected: number;
    selectedVideosBySlot: Record<string, number>;
    rejectionReasons: Record<string, number>;
    uniqueAudit: ReturnType<typeof auditCandidateUniqueness>;
    targetVideos: number;
    unmetReason: string | null;
  },
) {
  const gateOkBySource: Record<string, number> = {};
  const generatedBySource: Record<string, number> = {};
  const humanVoiceNgBySource: Record<string, number> = {};
  const nativeVoiceNgBySource: Record<string, number> = {};
  const eligibleByIntent: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  const mediaTypeCounts: Record<string, number> = {};
  const sourceTypeCounts: Record<string, number> = {};
  const creativeAngleCounts: Record<string, number> = {};
  const decisionTypeCounts: Record<string, number> = {};
  const decisionTypeSelected: Record<string, number> = {};
  for (const item of opportunities) {
    mediaTypeCounts[item.mediaType] = (mediaTypeCounts[item.mediaType] ?? 0) + 1;
    sourceTypeCounts[item.sourceType] = (sourceTypeCounts[item.sourceType] ?? 0) + 1;
    creativeAngleCounts[item.creativeAngle] = (creativeAngleCounts[item.creativeAngle] ?? 0) + 1;
    const decisionType = item.decisionFacts?.decisionType ?? "UNKNOWN";
    decisionTypeCounts[decisionType] = (decisionTypeCounts[decisionType] ?? 0) + 1;
    for (const role of ["REACH", "FOLLOW", "AUTHORITY", "MONEY"] as const) {
      if (passesLinklessQualityGate(item, role) && hasRealConversationSource(item, role)) eligibleByIntent[role] += 1;
    }
  }
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
  const slotAllocation = picks.reduce((counts, pick) => {
    const slot = pick.slotId ?? "unassigned";
    counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  for (const pick of picks) {
    const decisionType = pick.decisionFacts?.decisionType ?? "UNKNOWN";
    decisionTypeSelected[decisionType] = (decisionTypeSelected[decisionType] ?? 0) + 1;
  }
  const decisionPipelineByType = Object.fromEntries(DECISION_TYPES.map((decisionType) => {
    const typeItems = opportunities.filter((item) => isEligibleForDecisionType(item, decisionType));
    const typePicks = picks.filter((pick) => decisionTypeForCandidate(pick) === decisionType);
    const uniqueMedia = new Set(typeItems.map((item) => candidateMediaDedupeKey(item)).filter((key): key is string => Boolean(key)));
    const qualityItems = typeItems.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed));
    const supply = candidateDiagnostics?.decisionSupply?.[decisionType] ?? {};
    return [decisionType, {
      dbFetchedWorks: supply.dbFetchedWorks ?? supply.dbRawWorks ?? 0,
      dbRawWorks: supply.dbRawWorks ?? 0,
      baseXFilters: supply.afterPostedCooldown ?? 0,
      postedCooldown: supply.afterPostedCooldown ?? 0,
      mediaEligible: typeItems.filter((item) => item.mediaUsage !== "not_available" && Boolean(item.sampleMovieUrl || item.imageUrl)).length,
      uniqueWorks: new Set(typeItems.map((item) => item.workId)).size,
      uniqueMedia: uniqueMedia.size,
      uniqueUrls: new Set(typeItems.map((item) => item.sampleMovieUrl || item.imageUrl).filter(Boolean)).size,
      chartEligible: supply.chartEligible ?? typeItems.length,
      creativeVariants: typeItems.reduce((sum, item) => sum + item.creativeVariants.length, 0),
      qualityEligible: qualityItems.length,
      firstDropReasonCounts: supply.firstDropReasonCounts ?? {},
      firstDropByWorkId: supply.firstDropByWorkId ?? {},
      selected: typePicks.length,
      persisted: typePicks.length,
    }];
  }));
  const postedOverlap = picks.filter((pick) => postedWorkIds.has(pick.workId)).length;
  const moneyGenerated = opportunities.filter((item) => item.sourceType === "MONEY").length;
  const moneyHardGatePassed = opportunities.filter((item) => item.sourceType === "MONEY" && item.creativeVariants.some((variant) => variant.intent === "MONEY" && variant.quality.passed)).length;
  const moneyAllocationEligible = eligibleByIntent.MONEY;
  const moneyPlaced = picks.filter((pick) => pick.role === "MONEY").length;
  const moneyGateReasons = opportunities
    .filter((item) => item.sourceType === "MONEY")
    .map((item) => {
      const reasons = new Set<XMoneyGateReason>();
      const moneyVariants = item.creativeVariants.filter((variant) => variant.intent === "MONEY");
      if (!moneyVariants.some((variant) => Boolean(variant.url))) reasons.add("missing_affiliate_url");
      if (item.freshness.status === "expired") reasons.add("stale_or_expired");
      if (!item.currentPrice && !item.previousPrice && !item.discountRate) reasons.add("price_truth_unavailable");
      if (item.mediaUsage === "not_available") reasons.add("media_mismatch");
      if (postedWorkIds.has(item.workId)) reasons.add("duplicate_or_posted");
      if (moneyVariants.some((variant) => !variant.quality.lastMile.passed)) {
        const lastMile = moneyVariants.find((variant) => !variant.quality.lastMile.passed)?.quality.lastMile;
        if (lastMile?.humanVoice.passed === false) reasons.add("last_mile_ng");
        if (lastMile?.nativeXVoice.passed === false) reasons.add("native_x_voice_ng");
        if (lastMile?.reasons.some((reason) => /explicit|unsafe|露出|安全/.test(reason))) reasons.add("unsafe_or_too_explicit");
      }
      if (!reasons.size && !moneyVariants.some((variant) => variant.quality.passed)) reasons.add("other");
      return { workId: item.workId, candidateId: moneyVariants[0]?.id ?? null, reasons: [...reasons] };
    })
    .filter((entry) => entry.reasons.length > 0);
  const reasonCounts = new Map<XMoneyGateReason, number>();
  for (const entry of moneyGateReasons) for (const reason of entry.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  const moneyTopFailureReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const semantic = semanticSupplyDiagnostics(opportunities, picks);
  const variantDiagnostics = opportunities.flatMap((item) => item.creativeVariants.map((variant) => buildXGrowthVariantDiagnostic(item, variant, picks)));
  const variantDiagnosticsSummary = summarizeXGrowthVariantDiagnostics(variantDiagnostics);
  const target = picks.length >= 9 ? "3slot × 最大3候補" as const : "候補不足" as const;
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
    picks.length < 9 ? `3slot×3の目標に対して${picks.length}件` : "",
  ].filter(Boolean);
  return {
    target,
    sourcePoolTotal: candidateDiagnostics?.sourcePoolTotal ?? opportunities.length,
    sourcePoolAfterPosted: candidateDiagnostics?.sourcePoolAfterPosted ?? opportunities.length,
    prefilterCount: candidateDiagnostics?.prefilterCount ?? opportunities.length,
    humanVoiceTargetCount: candidateDiagnostics?.humanVoiceTargetCount ?? opportunities.length,
    diversityTargetCount: candidateDiagnostics?.diversityTargetCount ?? picks.length,
    postedExcluded: candidateDiagnostics?.postedExcluded ?? 0,
    postedOverlap,
    urlOrMediaAvailable: opportunities.filter((item) => Boolean(item.sampleMovieUrl || item.imageUrl || item.recommendedMediaUrl)).length,
    hardGatePassed: opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed)).length,
    eligibleByIntent,
    mediaTypeCounts,
    sourceTypeCounts,
    creativeAngleCounts,
    decisionTypeCounts,
    decisionTypeSelected,
    decisionPipeline: {
      rawSupply: opportunities.length,
      classified: opportunities.filter((item) => decisionTypeForCandidate(item) !== "UNKNOWN").length,
      eligible: Object.values(decisionSelection?.eligibleSupply ?? {}).reduce((sum, count) => sum + count, 0),
      dedupedEligible: decisionSelection?.dedupedEligibleSupply ?? 0,
      selectedBeforeReplenishment: decisionSelection?.selectedBeforeReplenishment ?? picks.length,
      replenished: decisionSelection?.replenished ?? 0,
      selected: decisionSelection?.selected ?? picks.length,
      persisted: picks.length,
      eligibleByType: decisionSelection?.eligibleSupply ?? { RECORD_LOW: 0, HIGH_DISCOUNT_NOT_LOW: 0, HIDDEN_VALUE: 0 },
      selectedByType: decisionSelection?.selectedByType ?? { RECORD_LOW: 0, HIGH_DISCOUNT_NOT_LOW: 0, HIDDEN_VALUE: 0 },
      byType: decisionPipelineByType,
    },
    slotAllocation,
    gateOkBySource,
    generatedBySource,
    humanVoiceNgBySource,
    nativeVoiceNgBySource,
    crossPostDiversityRejected,
    generatedByRole,
    gateOkByRole,
    shortagesByRole,
    reachGenerated,
    reachGateOk,
    shortages,
    moneyGenerated,
    moneyHardGatePassed,
    moneyAllocationEligible,
    moneyPlaced,
    moneyGateReasons,
    moneyTopFailureReason,
    semanticSupply: semantic.supply,
    semanticSelected: semantic.selected,
    semanticQuota: SEMANTIC_CATEGORY_QUOTA,
    semanticQuotaOverflowReasons: semantic.overflowReasons,
    semanticMappingReasons: semantic.mappingReasons,
    variantDiagnostics,
    variantDiagnosticsSummary,
    pipeline: candidateDiagnostics?.pipeline ?? {
      rawCandidates: opportunities.length,
      afterPosted: opportunities.length,
      afterStale: opportunities.filter((item) => item.freshness.status !== "expired").length,
      afterMedia: opportunities.filter((item) => isAllowedXGrowthMediaType(item.mediaType)).length,
      afterQuality: opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed)).length,
      afterSemantic: picks.length,
      slotEligible: picks.length,
      finalSelected: picks.length,
    },
    mediaMix: mediaMix ?? {
      totalVideoCandidates: 0,
      videoRaw: 0,
      videoEligible: 0,
      videoAfterDedupe: 0,
      slotEligibleVideo: 0,
      eligibleStrongVideos: 0,
      eligibleOfficialVideos: 0,
      officialCandidateCount: 0,
      officialVariantEligibleCount: 0,
      selectedVideos: picks.filter((pick) => pick.mediaType === "sample_movie").length,
      fallbackOfficialSelected: 0,
      selectedVideosBySlot: {},
      rejectionReasons: {},
      uniqueAudit: auditCandidateUniqueness(picks),
      targetVideos: 0,
      unmetReason: null,
    },
  };
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
  const postedWorkResult = await mark("posted_work_ids_ms", getPostedWorkIds());
  const candidateResult = await mark("candidate_generation_ms", getXPostCandidates(performance, logs, postedWorkResult.workIds));
  const expandedCandidates = expandCreativeSupply(candidateResult.candidates);
  const scoredAll = expandedCandidates.map(scoreOpportunity).sort((a, b) => {
    const aMax = Math.max(a.reachScore, a.followScore, a.authorityScore, a.revenueScore);
    const bMax = Math.max(b.reachScore, b.followScore, b.authorityScore, b.revenueScore);
    return bMax - aMax;
  });
  const baseLimit = includeDeferred ? 500 : 500;
  const mustKeepWorkIds = new Set([56714]);
  const scored = preserveDecisionLanesBeforeLimit(scoredAll, baseLimit, mustKeepWorkIds);
  const [media, rankingHistories] = await Promise.all([
    mark("media_assets_ms", fetchMediaAssets(scored.map((item) => item.workId))),
    mark("ranking_history_ms", fetchRankingSnapshotHistory(scored.map((item) => item.workId))),
  ]);
  if (includeDeferred) {
    const analysis = await mark("video_analysis_ms", analyzeUncachedVideoFacts(media.assets, 24));
    timings.video_analysis_assets = analysis.analyzed;
    timings.video_analysis_reused = analysis.reused;
  }
  const rightsApplied = applyMediaRights(scored, media.assets);
  const rankedOpportunities = applyRankingHistory(rightsApplied, rankingHistories.histories);
  const prefilterStarted = Date.now();
  // 90 quality candidates are enough for the three-slot allocator while
  // avoiding Human Voice work on the long tail.
  // Keep a wide real-media supply for the slot allocator. The previous 90-item
  // prefilter made semantic/source ranking decide supply before media eligibility
  // and left otherwise usable works unavailable for later fallback.
  const narrowedOpportunities = cheapCandidatePrefilter(rankedOpportunities, 300);
  timings.cheap_prefilter_ms = Date.now() - prefilterStarted;
  timings.prefilter_input_count = rankedOpportunities.length;
  timings.prefilter_output_count = narrowedOpportunities.length;
  const qualityStarted = Date.now();
  const opportunities = narrowedOpportunities.map((item) => withCreativeQuality(item, logs));
  timings.creative_quality_ms = Date.now() - qualityStarted;
  timings.human_voice_target_count = opportunities.length;
  const mission = buildStrategicMission(growth, logs, creativeLearning);
  const recentDailyPickWorkIds = await mark("recent_daily_pick_cooldown_ms", fetchRecentDailyPickWorkIds());
  const postedWorkIds = new Set([...recentPostedWorkIds(logs), ...postedWorkResult.workIds]);
  const allocatorStarted = Date.now();
  const dailySelection = selectDailyTopPicks(opportunities, mission, logs, recentDailyPickWorkIds, postedWorkIds);
  timings.bucket_allocation_ms = Date.now() - allocatorStarted;
  timings.fallback_allocator_ms = timings.bucket_allocation_ms;
  timings.media_mix_ms = dailySelection.mediaMix.mediaMixMs;
  const diversityStarted = Date.now();
  const gatedDiversity = finalDiversityGate(dailySelection.picks, logs);
  const replenishedPicks = replenishAfterFinalDiversity(gatedDiversity.picks, opportunities, mission, logs, postedWorkIds);
  const diversityResult = { picks: replenishedPicks, audit: auditDailyDiversity(replenishedPicks) };
  timings.final_diversity_check_ms = Date.now() - diversityStarted;
  timings.diversity_pass_ms = timings.final_diversity_check_ms;
  timings.diversity_target_count = dailySelection.picks.length;
  const finalMediaMix = {
    ...dailySelection.mediaMix,
    uniqueAudit: auditCandidateUniqueness(diversityResult.picks, postedWorkIds),
    selectedVideos: diversityResult.picks.filter((pick) => isVideoCandidate(pick)).length,
    selectedVideosBySlot: diversityResult.picks.reduce((counts, pick) => {
      if (isVideoCandidate(pick)) {
        const slot = pick.slotId ?? "unassigned";
        counts[slot] = (counts[slot] ?? 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>),
  };
  finalMediaMix.unmetReason = finalMediaMix.targetVideos > finalMediaMix.selectedVideos
    ? finalMediaMix.unmetReason ?? "最終Diversity Gate後に目標未達。安全性・semantic・重複制約を優先"
    : finalMediaMix.unmetReason;
  const pipeline = {
    rawCandidates: candidateResult.candidates.length,
    afterPosted: candidateResult.candidates.length,
    afterStale: rankedOpportunities.filter((item) => item.freshness.status !== "expired").length,
    afterMedia: rankedOpportunities.filter((item) => Boolean(item.sampleMovieUrl || item.imageUrl)).length,
    realMediaEligible: opportunities.filter((item) => isAllowedXGrowthMediaType(item.mediaType)).length,
    videoEligible: opportunities.filter((item) => item.mediaType === "sample_movie").length,
    imageEligible: opportunities.filter((item) => item.mediaType === "existing_link_image").length,
    hardGatePassed: opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed)).length,
    softQualityEligible: opportunities.filter((item) => item.creativeVariants.some((variant) => isSoftQualityEligible(variant))).length,
    afterSemantic: dailySelection.picks.length,
    slotEligible: dailySelection.picks.length,
    finalSelected: diversityResult.picks.length,
  };
  const supplyDiagnostics = buildSupplyDiagnostics(opportunities, diversityResult.picks, { ...candidateResult.diagnostics, prefilterCount: narrowedOpportunities.length, humanVoiceTargetCount: opportunities.length, diversityTargetCount: dailySelection.picks.length, pipeline }, dailySelection.decisionSelection, postedWorkIds, finalMediaMix);
  const nativeXLearning = buildNativeXLearning(logs, outcomes);
  const persistedTopPicks = await mark("persisted_top_picks_ms", persistDailyTopPicks({
    mission,
    topPicks: diversityResult.picks,
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
    dailyTopPicks: diversityResult.picks,
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
