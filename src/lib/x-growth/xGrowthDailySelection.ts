import type { XGrowthIntent, XGrowthOpportunity } from "../xGrowthOS";
import type { XCreativeVariant } from "../xCreativeEngine";
import type { XPostLog } from "../xPostLogs";
import { decisionFactProofLine, type DecisionType } from "../domain/decisionFacts";
import { auditCandidateUniqueness } from "./xGrowthCandidateIdentity";
import { selectRankedMediaMix, type RankedDuplicateBreakdown } from "./xGrowthMediaMix";
import { isMediaVariantSelectionEligible, isSoftQualityEligible, officialSampleVideoAllowed } from "./xGrowthEligibility";
import { buildMediaSupplyStageDiagnostics } from "./xGrowthSupplyDiagnostics";
import { clamp } from "./xGrowthOpportunityScoring";
import { DAY_MS, hoursUntil } from "./xGrowthTime";
import { diversityConflicts } from "./xGrowthDailyDiversity";
import { buildTopPickCandidate } from "./xGrowthDailyPresentation";
import { buildVariantMediaKeys } from "./xGrowthVariantMediaKeys";

const POSTED_WORK_COOLDOWN_DAYS = 14;
export const DECISION_TYPES: readonly DecisionType[] = ["RECORD_LOW", "HIGH_DISCOUNT_NOT_LOW", "HIDDEN_VALUE"];

export function isDecisionFactEligible(candidate: Pick<XGrowthOpportunity, "decisionFacts">) {
  const facts = candidate.decisionFacts;
  return Boolean(facts && decisionTypesForCandidate(candidate).length > 0 && decisionFactProofLine(facts).trim());
}

export function decisionTypeForCandidate(candidate: Pick<XGrowthOpportunity, "decisionFacts"> & { category?: string; sourceType?: string }): DecisionType {
  const facts = candidate.decisionFacts;
  if ((candidate.category === "hidden_gem" || candidate.sourceType === "HIDDEN_GEM") && facts?.eligibleDecisionTypes?.includes("HIDDEN_VALUE")) return "HIDDEN_VALUE";
  return facts?.decisionType ?? "UNKNOWN";
}

/**
 * Resolve the presentation primary at the point where a source/lane is chosen.
 * eligibleDecisionTypes remains the complete truth/evidence label set; only
 * decisionType is changed to describe the angle used for this candidate.
 */
export function decisionTypesForCandidate(candidate: Pick<XGrowthOpportunity, "decisionFacts">): DecisionType[] {
  const facts = candidate.decisionFacts;
  if (!facts) return [];
  return facts.eligibleDecisionTypes?.length
    ? facts.eligibleDecisionTypes
    : DECISION_TYPES.includes(facts.decisionType) ? [facts.decisionType] : [];
}

export function isEligibleForDecisionType(candidate: Pick<XGrowthOpportunity, "decisionFacts">, type: DecisionType) {
  return decisionTypesForCandidate(candidate).includes(type);
}

export function applyRankingHistory(opportunities: XGrowthOpportunity[], histories: Map<number, { observations: number; previousRanking: number | null }>) {
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

function interestAssets(item: XGrowthOpportunity, role: XGrowthIntent) {
  return [
    officialSampleVideoAllowed(item) ? "公式sample動画" : "",
    item.imageUrl ? "使用可能画像" : "",
    rankingInterestAsset(item),
    rankingTrendInterestAsset(item),
    priceInterestAsset(item),
    reachDataInterestAsset(item),
    saleDeadlineInterestAsset(item),
    quoteInterestAsset(item, role),
    titleInterestAsset(item),
  ].filter(Boolean);
}

function rankingInterestAsset(item: XGrowthOpportunity) {
  return item.ranking && item.ranking <= 30 ? "明確なランキング上位シグナル" : "";
}

function rankingTrendInterestAsset(item: XGrowthOpportunity) {
  return item.rankingHistory.status === "ready" && item.rankingHistory.rankingDelta && item.rankingHistory.rankingDelta >= 10
    ? "実ランキング差分"
    : "";
}

function priceInterestAsset(item: XGrowthOpportunity) {
  return item.isNinetyDayLow || item.discountRate >= 30 ? "強い価格/期限シグナル" : "";
}

function reachDataInterestAsset(item: XGrowthOpportunity) {
  const isReachTopic = ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType);
  return isReachTopic && (item.discountRate >= 30 || item.reviewAverage || item.ranking)
    ? "実データに基づくREACH題材"
    : "";
}

function saleDeadlineInterestAsset(item: XGrowthOpportunity) {
  return item.saleEndAt && hoursUntil(item.saleEndAt) > 0 && hoursUntil(item.saleEndAt) <= 72 ? "期限性" : "";
}

function quoteInterestAsset(item: XGrowthOpportunity, role: XGrowthIntent) {
  return role === "CONVERSATION" && item.mediaType === "quote" && item.recommendedMediaUrl ? "実在する引用元" : "";
}

function titleInterestAsset(item: XGrowthOpportunity) {
  const strongTitleHook = item.title.length >= 18 && (item.reviewAverage ?? 0) >= 4.6 && item.reviewCount >= 20;
  return strongTitleHook ? "作品名/題材フック" : "";
}

export function passesLinklessQualityGate(item: XGrowthOpportunity, role: XGrowthIntent) {
  if (role === "MONEY") return true;
  const creative = item.creativeVariants.find((variant) => variant.intent === role && isSoftQualityEligible(variant))
    ?? item.creativeVariants.find((variant) => variant.intent === role);
  return interestAssets(item, role).length > 0 && Boolean(creative && isSoftQualityEligible(creative));
}

export function hasRealConversationSource(item: XGrowthOpportunity, role: XGrowthIntent) {
  if (role !== "CONVERSATION") return true;
  return false;
}

function roleScore(item: XGrowthOpportunity, intent: XGrowthIntent) {
  const creative = roleCreative(item, intent);
  const base = roleBaseScore(item, intent);
  const buzz = creative?.buzzPotential.total ?? creative?.quality.total ?? 0;
  const adPenalty = creative ? Math.min(18, creative.quality.dimensions.adSmell / 4) : 0;
  const roleDiversityBonus = roleDiversityBonusForItem(item, intent);
  const mediaType = creative?.mediaType ?? item.mediaType;
  const mediaPriority = roleMediaPriority(item, mediaType);
  const visualBoost = roleVisualBoost(item, intent);
  return clamp(base * 0.2 + buzz * 0.34 + item.freshness.total * 0.18 + (creative?.quality.total ?? 0) * 0.16 + roleDiversityBonus + mediaPriority + visualBoost - adPenalty);
}

function roleCreative(item: XGrowthOpportunity, intent: XGrowthIntent) {
  return item.creativeVariants.find((variant) => variant.intent === intent && variant.quality.passed)
    ?? item.creativeVariants.find((variant) => variant.intent === intent)
    ?? item.creativeVariants.find((variant) => variant.quality.passed)
    ?? item.creativeVariants[0];
}

function roleBaseScore(item: XGrowthOpportunity, intent: XGrowthIntent) {
  const scores: Partial<Record<XGrowthIntent, number>> = {
    REACH: item.reachScore,
    FOLLOW: item.followScore,
    AUTHORITY: item.authorityScore,
    MONEY: item.revenueScore,
  };
  return scores[intent] ?? Math.max(item.followScore, item.authorityScore);
}

function roleDiversityBonusForItem(item: XGrowthOpportunity, intent: XGrowthIntent) {
  return intent === "REACH" && ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) ? 8 : 0;
}

function roleMediaPriority(item: XGrowthOpportunity, mediaType: XCreativeVariant["mediaType"]) {
  if (mediaType === "sample_movie" && officialSampleVideoAllowed(item)) return 18;
  if (mediaType === "existing_link_image" && item.imageUrl) return 12;
  if (item.imageUrl) return 8;
  if (mediaType === "data_card") return ["MARKET", "COMPARISON", "JUDGMENT"].includes(item.sourceType) ? 4 : -8;
  return mediaType === "quote" ? -20 : 0;
}

function roleVisualBoost(item: XGrowthOpportunity, intent: XGrowthIntent) {
  if (intent === "MONEY") return item.visualScoring.mediaTextFit * 0.04;
  return (item.visualScoring.videoHookStrength + item.visualScoring.visualSpecificity) * 0.05;
}

export function recentPostedWorkIds(logs: XPostLog[]) {
  const cutoff = Date.now() - POSTED_WORK_COOLDOWN_DAYS * DAY_MS;
  return new Set(logs
    .filter((log) => Number.isSafeInteger(log.work_id) && new Date(log.posted_at).getTime() >= cutoff)
    .map((log) => log.work_id));
}

type RankedGrowthCandidate = {
  item: XGrowthOpportunity;
  role: XGrowthIntent;
  variant: XCreativeVariant;
  score: number;
  mediaType: "sample_movie" | "existing_link_image";
};

type RankedSelectionState = {
  selected: RankedGrowthCandidate[];
  selectedWorkIds: Set<number>;
  selectedMedia: Set<string>;
  videoCount: number;
  imageCount: number;
};

function addRankedCandidate(
  candidate: RankedGrowthCandidate,
  state: RankedSelectionState,
  mediaTargets?: { videos: number; images: number },
) {
  if (state.selected.length >= 9 || state.selectedWorkIds.has(candidate.item.workId)) return false;
  const mediaKeys = buildVariantMediaKeys(candidate.item, candidate.variant);
  if (mediaKeys.some((key) => state.selectedMedia.has(key))) return false;
  if (mediaTargets && candidate.mediaType === "sample_movie" && state.videoCount >= mediaTargets.videos) return false;
  if (mediaTargets && candidate.mediaType === "existing_link_image" && state.imageCount >= mediaTargets.images) return false;
  state.selected.push(candidate);
  state.selectedWorkIds.add(candidate.item.workId);
  for (const key of mediaKeys) state.selectedMedia.add(key);
  if (candidate.mediaType === "sample_movie") state.videoCount += 1;
  else state.imageCount += 1;
  return true;
}

function selectRankedCandidates(rankedPool: RankedGrowthCandidate[], targetVideos: number, targetImages: number) {
  const state: RankedSelectionState = {
    selected: [],
    selectedWorkIds: new Set<number>(),
    selectedMedia: new Set<string>(),
    videoCount: 0,
    imageCount: 0,
  };
  const mediaTargets = { videos: targetVideos, images: targetImages };
  for (const candidate of rankedPool) addRankedCandidate(candidate, state, mediaTargets);
  // Fill any remaining positions without changing the preferred media mix.
  for (const candidate of rankedPool) {
    if (state.selected.length >= 9) break;
    if (state.selectedWorkIds.has(candidate.item.workId)) continue;
    addRankedCandidate(candidate, state);
  }
  return state.selected;
}

export type RankedSelectionDiagnostics = {
  candidateVariants: number;
  uniqueWorksBeforeCollapse: number;
  lostUniqueWorksAfterCollapse: number;
  duplicateBreakdown: RankedDuplicateBreakdown;
  rankedPoolTotalUniqueWorks: number;
  videoEligibleUnique: number;
  imageEligibleUnique: number;
  excludedPosted: number;
  excludedDuplicate: number;
  excludedUnusable: number;
  excludedHardQuality: number;
  excludedSemantic: number;
  topRankedCandidates: Array<{ workId: number; mediaType: string; score: number; rank: number; decisionType: DecisionType; role: XGrowthIntent }>;
  mediaQuotaChosen: string;
  decisionCoverageAdjustments: number;
  finalRanks: number[];
};

function buildRankedCandidatePool(
  opportunities: XGrowthOpportunity[],
  logs: XPostLog[],
  recentDailyPickWorkIds: Set<number>,
  postedWorkIds: Set<number>,
) {
  const isUsableVariant = (item: XGrowthOpportunity, variant: XCreativeVariant) => {
    if (!isMediaVariantSelectionEligible(variant)) return false;
    if (variant.mediaType === "sample_movie") return officialSampleVideoAllowed(item);
    if (variant.mediaType === "existing_link_image" || variant.mediaType === "data_card") return Boolean(item.imageUrl);
    return false;
  };
  const toMediaType = (variant: XCreativeVariant): RankedGrowthCandidate["mediaType"] =>
    variant.mediaType === "sample_movie" ? "sample_movie" : "existing_link_image";
  const candidates: RankedGrowthCandidate[] = [];
  let excludedPosted = 0;
  let excludedUnusable = 0;
  let excludedHardQuality = 0;
  let excludedSemantic = 0;
  const eligibleItems = opportunities.filter((item) => {
    if (!isDecisionFactEligible(item) || item.freshness.status === "expired") return false;
    if (postedWorkIds.has(item.workId) || recentDailyPickWorkIds.has(item.workId)) {
      excludedPosted += 1;
      return false;
    }
    if (item.mediaUsage === "not_available") {
      excludedUnusable += 1;
      return false;
    }
    const variants = item.creativeVariants.filter((variant) => variant.intent !== "CONVERSATION");
    const hasQuality = variants.some((variant) => variant.quality.passed);
    const usable = variants.some((variant) => isUsableVariant(item, variant));
    if (!hasQuality) excludedHardQuality += 1;
    if (!usable) excludedUnusable += 1;
    return usable;
  });
  for (const item of eligibleItems) {
    const variants = item.creativeVariants
      .filter((variant) => variant.intent !== "CONVERSATION")
      .filter((variant) => isUsableVariant(item, variant));
    for (const variant of variants) {
      const role = variant.intent;
      const audit = diversityConflicts(item, role, variant, [], logs);
      if (!audit.ok) excludedSemantic += 1;
      const score = clamp(
        roleScore(item, role)
        + variant.quality.total * 0.2
        + item.freshness.total * 0.12
        + (variant.mediaType === "sample_movie" ? item.visualScoring.videoHookStrength * 0.06 : item.visualScoring.mediaTextFit * 0.04),
      );
      candidates.push({ item, role, variant, score, mediaType: toMediaType(variant) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.item.workId - b.item.workId || a.variant.id.localeCompare(b.variant.id));
  const rankedMix = selectRankedMediaMix(candidates.map((candidate) => ({
    ...candidate,
    workId: candidate.item.workId,
    mediaKey: buildVariantMediaKeys(candidate.item, candidate.variant)[0] ?? `work:${candidate.item.workId}`,
    mediaKeys: buildVariantMediaKeys(candidate.item, candidate.variant),
    decisionTypes: decisionTypesForCandidate(candidate.item),
  })));
  const rankedPool = rankedMix.rankedPool.map(({ item, role, variant, score, mediaType }) => ({ item, role, variant, score, mediaType }));
  const videoEligibleUnique = new Set(rankedPool.filter((candidate) => candidate.mediaType === "sample_movie").map((candidate) => candidate.item.workId)).size;
  const imageEligibleUnique = new Set(rankedPool.filter((candidate) => candidate.mediaType === "existing_link_image").map((candidate) => candidate.item.workId)).size;
  return { candidates, rankedPool, duplicateBreakdown: rankedMix.duplicateBreakdown, eligibleItems, excludedPosted, excludedUnusable, excludedHardQuality, excludedSemantic, videoEligibleUnique, imageEligibleUnique };
}
export function selectRankedDailyTopPicks(
  opportunities: XGrowthOpportunity[],
  logs: XPostLog[],
  recentDailyPickWorkIds = new Set<number>(),
  postedWorkIds = recentPostedWorkIds(logs),
) {
  const { candidates, rankedPool, duplicateBreakdown, eligibleItems, excludedPosted, excludedUnusable, excludedHardQuality, excludedSemantic, videoEligibleUnique, imageEligibleUnique } =
    buildRankedCandidatePool(opportunities, logs, recentDailyPickWorkIds, postedWorkIds);
  const targetVideos = videoEligibleUnique >= 5 ? 5 : videoEligibleUnique >= 4 ? 4 : Math.max(0, Math.min(videoEligibleUnique, 9 - 4));
  const targetImages = 9 - targetVideos;
  const selected = selectRankedCandidates(rankedPool, targetVideos, targetImages);
  const decisionCoverageAdjustments = 0;
  const slots = [
    { slotId: "slot_1" as const, slotRole: "REACH" as const, slotLabel: "投稿枠1: ranked 1〜3" },
    { slotId: "slot_2" as const, slotRole: "FOLLOW_OR_AUTHORITY" as const, slotLabel: "投稿枠2: ranked 4〜6" },
    { slotId: "slot_3" as const, slotRole: "MONEY_OR_REACH" as const, slotLabel: "投稿枠3: ranked 7〜9" },
  ];
  const rankLabels = ["A", "B", "C"] as const;
  const picks = selected.map((candidate, index) => {
    const slot = slots[Math.floor(index / 3)];
    const audit = diversityConflicts(candidate.item, candidate.role, candidate.variant, [], logs);
    return buildTopPickCandidate({
      item: candidate.item,
      role: candidate.role,
      variant: candidate.variant,
      audit,
      score: candidate.score,
      pickOrder: index + 1,
      slotId: slot.slotId,
      slotRole: slot.slotRole,
      slotLabel: slot.slotLabel,
      candidateRank: rankLabels[index % 3],
      reason: `ランキング${index + 1}位。品質・機会スコア順で選定`,
    });
  });
  const uniqueAudit = auditCandidateUniqueness(picks, postedWorkIds);
  const videoRawItems = eligibleItems.filter((item) => item.sampleMovieUrl);
  const videoVariants = videoRawItems.flatMap((item) => item.creativeVariants.filter((variant) => variant.mediaType === "sample_movie"));
  const mediaMix = {
    totalVideoCandidates: videoRawItems.length,
    videoRaw: videoRawItems.length,
    videoEligible: videoEligibleUnique,
    videoAfterDedupe: videoEligibleUnique,
    slotEligibleVideo: videoEligibleUnique,
    eligibleStrongVideos: videoEligibleUnique,
    eligibleOfficialVideos: videoEligibleUnique,
    officialCandidateCount: videoEligibleUnique,
    officialVariantEligibleCount: videoEligibleUnique,
    selectedVideos: picks.filter((pick) => pick.mediaType === "sample_movie").length,
    fallbackOfficialSelected: 0,
    selectedVideosBySlot: picks.reduce((counts, pick) => {
      if (pick.mediaType === "sample_movie") counts[pick.slotId ?? "unassigned"] = (counts[pick.slotId ?? "unassigned"] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>),
    rejectionReasons: {},
    uniqueAudit,
    targetVideos,
    unmetReason: picks.filter((pick) => pick.mediaType === "sample_movie").length < targetVideos ? "ランキングpoolの利用可能動画が不足" : null,
    mediaMixMs: 0,
    generatedVideoVariants: videoVariants.length,
    hardQualityVideoVariants: videoVariants.filter((variant) => variant.quality.passed).length,
    semanticSafeVideoUniqueWorks: videoEligibleUnique,
    availableToFinalVideoUniqueWorks: videoEligibleUnique,
    selectedVideosBeforeReplenishment: picks.filter((pick) => pick.mediaType === "sample_movie").length,
    selectedVideosAfterReplenishment: picks.filter((pick) => pick.mediaType === "sample_movie").length,
    videoFirstDropReasonCounts: {},
    videoSupplyStages: buildMediaSupplyStageDiagnostics(opportunities, "sample_movie", postedWorkIds, recentDailyPickWorkIds),
    imageSupplyStages: buildMediaSupplyStageDiagnostics(opportunities, "existing_link_image", postedWorkIds, recentDailyPickWorkIds),
  };
  const selectedByType = DECISION_TYPES.reduce((counts, type) => {
    counts[type] = picks.filter((pick) => decisionTypeForCandidate(pick) === type).length;
    return counts;
  }, {} as Record<DecisionType, number>);
  const rankingDiagnostics: RankedSelectionDiagnostics = {
    candidateVariants: candidates.length,
    uniqueWorksBeforeCollapse: new Set(candidates.map((candidate) => candidate.item.workId)).size,
    lostUniqueWorksAfterCollapse: duplicateBreakdown.lostUniqueWorks,
    duplicateBreakdown: duplicateBreakdown,
    rankedPoolTotalUniqueWorks: rankedPool.length,
    videoEligibleUnique,
    imageEligibleUnique,
    excludedPosted,
    excludedDuplicate: Math.max(0, candidates.length - rankedPool.length),
    excludedUnusable,
    excludedHardQuality,
    excludedSemantic,
    topRankedCandidates: rankedPool.slice(0, 20).map((candidate, index) => ({ workId: candidate.item.workId, mediaType: candidate.mediaType, score: candidate.score, rank: index + 1, decisionType: decisionTypeForCandidate(candidate.item), role: candidate.role })),
    mediaQuotaChosen: `${targetVideos} video / ${targetImages} image`,
    decisionCoverageAdjustments,
    finalRanks: picks.map((_, index) => index + 1),
  };
  return {
    picks,
    reason: picks.length ? null : "投稿可能なランキング候補がありません。",
    mediaMix,
    rankingDiagnostics,
    decisionSelection: {
      eligibleSupply: DECISION_TYPES.reduce((counts, type) => {
        counts[type] = rankedPool.filter((candidate) => isEligibleForDecisionType(candidate.item, type)).length;
        return counts;
      }, {} as Record<DecisionType, number>),
      dedupedEligibleSupply: rankedPool.length,
      selectedBeforeReplenishment: picks.length,
      replenished: 0,
      selected: picks.length,
      selectedByType,
    },
  };
}


