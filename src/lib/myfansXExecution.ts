import { filterBySelectedMedia } from "@/lib/myfansAnalytics";
import { selectMyfansFinalDailyCandidates } from "@/lib/myfans/myfansDailySelection";
import { buildMyfansDailyOptionSlots } from "@/lib/myfans/myfansDailyOptionSlots";
import { buildMyfansQuoteCollectionTasks as buildMyfansQuoteCollectionTasksFromPool, type MyfansQuoteCollectionTask } from "@/lib/myfans/myfansQuoteCollectionTasks";
import { buildMyfansLinkedCandidateFunnel, type MyfansLinkedCandidateFunnelCandidate } from "@/lib/myfans/myfansLinkedCandidateFunnel";
import { selectMyfansQuoteForAttempt, type MyfansQuoteAttemptContext } from "./myfans/myfansQuoteAttempt";
import { buildMyfansAggregateCandidate } from "./myfans/myfansAggregateCandidate";
import { daysBetweenDates } from "@/lib/myfans/myfansTime";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import {
  MYFANS_DAILY_FRESH_DAYS,
  POSTED_SOURCE_COOLDOWN_DAYS,
  QUOTE_MIN_SCORE,
  buildMyfansQuotePool,
  buildPastUsageIndex,
  creatorKeyFromCreator,
  creatorKeyFromProduct,
  creatorKeyFromQuote,
  currentPlanDate,
  daysSinceIso,
  daysSinceIsoAtPlanDate,
  normalizeSourceUrl,
  quoteUrlFromCandidate,
} from "@/lib/myfans/myfansQuotePool";
import type { MyfansReasonToCare, MyfansTopicValue } from "@/lib/myfans/myfansQuotePool";
import type { HumanReactionType } from "./myfans/myfansExecutionTypes";
import { buildMyfansCandidatePoolContext } from "@/lib/myfans/myfansCandidatePool";
import { creatorMyfansUrl, isRevenueTargetProduct } from "./myfans/myfansCandidateResolution";
import { buildMyfansCandidate, MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC, MYFANS_PUBLIC_COPY_GENERATOR_VERSION, type MyfansCandidateBuildContext } from "./myfans/myfansCandidateBuilder";
import { buildMyfansCandidateRecovery, classifyMyfansHoldReason } from "./myfans/myfansCandidateRecovery";
export { MYFANS_PUBLIC_COPY_GENERATOR_VERSION };
import { evaluateMyfansCandidateDiversity, holdQuality, isMyfansDailyOptionDiverseEnough, recordAcceptedMyfansCandidate, type MyfansDailyOptionDiversityCandidate } from "./myfans/myfansCandidateDiversity";
import { buildMyfansExecutionAudit } from "@/lib/myfans/myfansExecutionAudit";
import { prepareMyfansExecution } from "./myfans/myfansExecutionPreparation";
import { buildTopicBaselines, evaluateMyfansTopicValue } from "@/lib/myfans/myfansTopicValue";
import { buildBottleneck, buildOutboundTasks, buildProfileFunnel, buildTodayStrategy, planningReasonFor } from "@/lib/myfans/myfansGrowthSummary";
export type * from "./myfans/myfansExecutionTypes";
export { summarizeTodayActions } from "@/lib/myfans/myfansGrowthSummary";
import { MYFANS_QUALITY_GATE_MINIMUM } from "@/lib/myfans/myfansPublicCopyQuality";
export { evaluateMyfansPublicCopyQuality, MYFANS_QUALITY_GATE_MINIMUM, reviewPublicCopyReaction } from "@/lib/myfans/myfansPublicCopyQuality";
export type { PublicCopyReactionReview } from "@/lib/myfans/myfansPublicCopyQuality";
export { MYFANS_ATTENTION_VALUE_MINIMUM, MYFANS_TOPIC_VALUE_THRESHOLDS, evaluateMyfansTopicValue, hasConcreteSourceContext } from "@/lib/myfans/myfansTopicValue";
export type { DailyRole, MyfansTopicBaselines } from "@/lib/myfans/myfansTopicValue";
export { publicCopyInputHash } from "@/lib/myfans/myfansPublicCopyFacts";
import { buildPermanentExclusionSets } from "@/lib/myfansPermanentExclusions";
import { detectPublicCopyLeak, hasPublicCopyDiversityIssue } from "@/lib/myfans/myfansPublicCopyRules";
import { evaluateMyfansCandidateNovelty } from "@/lib/myfans/myfansCandidateNovelty";
import { MYFANS_DAILY_SELECTED_MAX } from "./myfans/myfansDailyPlanSelection";
export { MYFANS_DAILY_SELECTED_MAX } from "./myfans/myfansDailyPlanSelection";

export { MYFANS_VISUAL_ANALYZER_VERSION } from "@/lib/myfans/myfansCreativeEvidence";
export { buildMyfansLearning, compareByStrategy, MYFANS_DIAGNOSIS_THRESHOLDS } from "@/lib/myfans/myfansLearning";
export type { MyfansLearningAxis, MyfansCreativeLearningAxis } from "@/lib/myfans/myfansLearning";
export type { MyfansSupplyAudit, MyfansSupplyAuditRow, MyfansSupplyAuditStage } from "@/lib/myfans/myfansSupplyAudit";
export { detectPublicCopyLeak } from "@/lib/myfans/myfansPublicCopyRules";
export { buildCreatorPartnershipCandidates } from "@/lib/myfans/myfansPartnership";
export type { MyfansQuoteCollectionTask } from "@/lib/myfans/myfansQuoteCollectionTasks";
export { buildMyfansQuotePool, currentPlanDate };
export type { MyfansReasonToCare, MyfansTopicValue };

import {
  getGrowthStage,
  getOperationDay,
  MYFANS_30_DAY_STRATEGY,
  MYFANS_GROWTH_TARGETS,
  MYFANS_PROFILE_GUIDE,
} from "./myfans/myfansGrowthStrategy";
import type {
  RotationItem,
} from "./myfans/myfansGrowthStrategy";
export { getGrowthStage, getOperationDay, MYFANS_30_DAY_STRATEGY, MYFANS_GROWTH_TARGETS, MYFANS_PROFILE_GUIDE };
export type {
  MyfansCandidateType,
  MyfansCreativeStrategy,
  MyfansGrowthStage,
  MyfansLinkStrategy,
  MyfansMonetizableStatus,
  MyfansObjective,
  RotationItem,
} from "./myfans/myfansGrowthStrategy";

export const MYFANS_PUBLIC_COPY_V9_GENERATOR_VERSION = "public-copy-v9-visual-grounded";
export const MYFANS_PUBLIC_COPY_V10_GENERATOR_VERSION = "public-copy-v10-human-observation";
const MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS = 12;

const MYFANS_DAILY_AVERAGE_QUALITY_MINIMUM = 90;
export const MYFANS_DAILY_SLOT_COUNT = 4;
export const MYFANS_DAILY_CANDIDATES_PER_SLOT = 3;
export const MYFANS_DAILY_SELECTED_MIN = 2;

type MyfansRecoveryHistory = ReturnType<typeof buildMyfansCandidateRecovery>["recoveryHistory"];
type MyfansInitialAttempts = ReturnType<typeof buildMyfansCandidateRecovery>["initialAttempts"];

type MyfansAggregateRecovery = NonNullable<ReturnType<typeof buildMyfansAggregateCandidate>>;

type MyfansAggregateRecoveryInput = {
  publishableCandidates: MyfansCandidateForDiversity[];
  acceptedBodies: string[];
  recoveryHistory: MyfansRecoveryHistory;
  topicPassRows: ReturnType<typeof prepareMyfansExecution>["candidatePoolContext"]["topicPassRows"];
  rotation: RotationItem[];
  planDate: string;
  stage: ReturnType<typeof prepareMyfansExecution>["stage"];
};

function prepareMyfansAggregateRecovery(input: MyfansAggregateRecoveryInput): MyfansAggregateRecovery | null {
  const { publishableCandidates, topicPassRows, rotation, planDate, stage } = input;
  if (publishableCandidates.length >= rotation.length || topicPassRows.length < 3 || publishableCandidates.length < 2) return null;
  const aggregateTopics = publishableCandidates
    .filter((candidate) => candidate.topicIdentity && candidate.topicValue?.verdict === "PASS")
    .filter((candidate, index, rows) => rows.findIndex((item) => item.topicIdentity === candidate.topicIdentity) === index)
    .slice(0, 2);
  return buildMyfansAggregateCandidate({
    base: publishableCandidates[0],
    aggregateTopics,
    plannedSlot: rotation[publishableCandidates.length]?.slot ?? "aggregate",
    publishableCount: publishableCandidates.length,
    planDate,
    stage,
  });
}

function checkedMyfansAggregateCandidate(candidate: MyfansCandidateForDiversity, acceptedBodies: string[]) {
  const leak = detectPublicCopyLeak(candidate.body);
  const diversityIssue = hasPublicCopyDiversityIssue(candidate.body, acceptedBodies);
  return leak.hasLeak
    ? { ...candidate, quality: holdQuality(candidate.quality, "Public Copy leak: " + leak.matches.join(" / ")) }
    : diversityIssue
      ? { ...candidate, quality: holdQuality(candidate.quality, diversityIssue) }
      : candidate;
}

function appendAcceptedMyfansAggregateRecovery(
  input: MyfansAggregateRecoveryInput,
  aggregateTopic: MyfansAggregateRecovery["aggregateTopic"],
  checked: MyfansCandidateForDiversity,
) {
  input.publishableCandidates.push(checked);
  input.acceptedBodies.push(checked.body);
  input.recoveryHistory.push({
    slot: checked.plannedSlot,
    attempt: 1,
    candidateId: checked.id,
    productId: checked.product?.id ?? null,
    quoteCandidateId: aggregateTopic ? input.topicPassRows[0]?.quoteCandidateId ?? null : null,
    initialRole: "DISCOVERY",
    recoveryRole: "DISCOVERY",
    role: "ranking_note",
    hook: checked.hookLabel,
    creative: checked.creativeStrategy,
    score: checked.quality.total,
    verdict: checked.quality.verdict,
    holdReason: "",
    copyAngle: checked.copyAngle,
    reasonToCare: checked.topicValue?.reasonToCare ?? null,
    topicIdentity: checked.topicIdentity,
    topicSemanticKey: checked.topicSemanticKey,
    qualityReasons: checked.quality.reasons,
    recoveryAction: "Discovery aggregateで回復",
  });
}

function appendHeldMyfansAggregateRecovery(
  input: MyfansAggregateRecoveryInput,
  candidate: MyfansCandidateForDiversity,
  checked: MyfansCandidateForDiversity,
) {
  input.recoveryHistory.push({
    slot: candidate.plannedSlot,
    attempt: 1,
    candidateId: candidate.id,
    productId: candidate.product?.id ?? null,
    quoteCandidateId: input.topicPassRows[0]?.quoteCandidateId ?? null,
    initialRole: "DISCOVERY",
    recoveryRole: "DISCOVERY",
    role: "ranking_note",
    hook: candidate.hookLabel,
    creative: candidate.creativeStrategy,
    score: checked.quality.total,
    verdict: checked.quality.verdict,
    holdReason: classifyMyfansHoldReason(checked.quality),
    copyAngle: candidate.copyAngle,
    reasonToCare: candidate.topicValue?.reasonToCare ?? null,
    topicIdentity: candidate.topicIdentity,
    topicSemanticKey: candidate.topicSemanticKey,
    qualityReasons: checked.quality.reasons,
    recoveryAction: "Discovery aggregateもQuality Gate未達",
  });
}

function appendMyfansAggregateRecovery(input: MyfansAggregateRecoveryInput) {
  const aggregateRecovery = prepareMyfansAggregateRecovery(input);
  if (!aggregateRecovery) return;
  const { aggregateTopic, candidate } = aggregateRecovery;
  const checked = checkedMyfansAggregateCandidate(candidate, input.acceptedBodies);
  if (checked.quality.verdict === "PASS" && checked.quality.total >= MYFANS_QUALITY_GATE_MINIMUM) {
    appendAcceptedMyfansAggregateRecovery(input, aggregateTopic, checked);
    return;
  }
  appendHeldMyfansAggregateRecovery(input, candidate, checked);
}

function buildMyfansRecoverySummary(input: {
  rotation: RotationItem[];
  allDailyOptions: MyfansDailyOptionCandidate[];
  finalPublishableCandidates: MyfansCandidateForDiversity[];
  initialAttempts: MyfansInitialAttempts;
  recoveryHistory: MyfansRecoveryHistory;
}) {
  const { rotation, allDailyOptions, finalPublishableCandidates, initialAttempts, recoveryHistory } = input;
  const candidateOptionsTarget = MYFANS_DAILY_SLOT_COUNT * MYFANS_DAILY_CANDIDATES_PER_SLOT;
  const hasCandidateSupply = allDailyOptions.length >= candidateOptionsTarget;
  const hasSelectedMinimum = finalPublishableCandidates.length >= MYFANS_DAILY_SELECTED_MIN;
  const summary = !hasCandidateSupply
    ? "候補" + allDailyOptions.length + "/" + candidateOptionsTarget + "。枠別A/B/C供給不足"
    : hasSelectedMinimum
      ? "候補" + allDailyOptions.length + "/" + candidateOptionsTarget + "、selected " + finalPublishableCandidates.length + "/" + MYFANS_DAILY_SELECTED_MIN + "-" + MYFANS_DAILY_SELECTED_MAX
      : "候補" + allDailyOptions.length + "/" + candidateOptionsTarget + "、selected " + finalPublishableCandidates.length + "/" + MYFANS_DAILY_SELECTED_MIN + " minimum。SUPPLY_INSUFFICIENT";
  return {
    targetPosts: rotation.length,
    passCount: finalPublishableCandidates.length,
    candidateOptions: allDailyOptions.length,
    candidateOptionsTarget,
    selectedMinimum: MYFANS_DAILY_SELECTED_MIN,
    selectedMaximum: MYFANS_DAILY_SELECTED_MAX,
    selectedStatus: hasCandidateSupply && hasSelectedMinimum ? "READY" as const : "SUPPLY_INSUFFICIENT" as const,
    attemptedCandidates: recoveryHistory.length,
    initialAttempts,
    history: recoveryHistory,
    summary,
    roleSwaps: recoveryHistory.filter((row) => /→/.test(row.recoveryAction) || /Recovery/.test(row.candidateId)),
  };
}

function hasValidXProfileUrl(value: string | null | undefined) {
  try {
    const url = new URL(String(value ?? "").trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!(["x.com", "twitter.com"].includes(hostname)) || !["http:", "https:"].includes(url.protocol)) return false;
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length !== 1 || !/^[a-z0-9_]{1,15}$/i.test(pathSegments[0])) return false;
    return !new Set(["home", "explore", "search", "i", "intent", "share", "settings", "notifications", "messages"]).has(pathSegments[0].toLowerCase());
  } catch {
    return false;
  }
}

const QUOTE_REFRESH_DAYS = 3;

function addDaysIso(value: string | null | undefined, days: number) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

type BuildMyfansExecutionBoardOptions = {
  planDate?: string;
  operationDay?: number;
  generationVersion?: string;
};

function buildLinkedCandidateFunnel<TCandidate extends MyfansLinkedCandidateFunnelCandidate>(
  analytics: MyfansAnalytics,
  input: {
    planDate: string;
    topicBaselines: ReturnType<typeof buildTopicBaselines>;
    pastUsage: Pick<ReturnType<typeof buildPastUsageIndex>, "latestSource">;
    attemptedCreatorKeys: Set<string>;
    allDailyOptions: TCandidate[];
    finalPublishableCandidates: TCandidate[];
    creatorKeyForCandidateSource: (candidate: Pick<TCandidate, "quoteXUrl" | "sourceXUrl" | "product">) => string;
  },
) {
  const funnelProducts = analytics.dailyFunnelInputs
    ? analytics.selectedMedia?.id === 5
      ? analytics.dailyFunnelInputs.products
      : filterBySelectedMedia(analytics.dailyFunnelInputs.products, analytics.selectedMedia)
    : analytics.products;
  const funnelCreators = analytics.dailyFunnelInputs?.creators ?? analytics.creators.filter((creator) => creator.is_active);
  return buildMyfansLinkedCandidateFunnel({
    planDate: input.planDate,
    inputCoverage: analytics.dailyFunnelInputs ? "complete" : "analytics_sample",
    creators: funnelCreators,
    funnelProducts,
    topicProducts: analytics.products,
    quoteCandidates: analytics.quoteCandidates,
    topicBaselines: input.topicBaselines,
    latestSourceUsage: input.pastUsage.latestSource,
    attemptedCreatorKeys: input.attemptedCreatorKeys,
    allDailyOptions: input.allDailyOptions,
    finalPublishableCandidates: input.finalPublishableCandidates,
    creatorKeyForCandidateSource: input.creatorKeyForCandidateSource,
    creatorKeyFromProduct,
    creatorKeyFromCreator,
    creatorKeyFromQuote,
    hasValidXProfileUrl,
    daysSinceIsoAtPlanDate,
    creatorMyfansUrl,
    evaluateTopicValue: ({ product, quote, role, baselines }) => evaluateMyfansTopicValue({ product, quote, role, baselines }),
    daysBetweenDates,
    quoteUrlFromCandidate,
    dailyFreshDays: MYFANS_DAILY_FRESH_DAYS,
    postedSourceCooldownDays: POSTED_SOURCE_COOLDOWN_DAYS,
  });
}



export type MyfansCandidateForDiversity = ReturnType<typeof buildMyfansCandidate>;

export type MyfansCandidateDiversityContext = {
  acceptedBodies: string[];
  acceptedCreatorCounts: Map<string, number>;
  acceptedQuoteCreators: Set<string>;
  acceptedReactionTypes: Set<HumanReactionType>;
  acceptedReasonCounts: Map<MyfansReasonToCare, number>;
  acceptedTopicIdentities: Set<string>;
  acceptedTopicSemanticKeys: string[];
  analytics: MyfansAnalytics;
  creatorKeyForCandidateSource: ReturnType<typeof buildMyfansCandidatePoolContext>["creatorKeyForCandidateSource"];
  pastUsage: ReturnType<typeof buildPastUsageIndex>;
  permanentExclusionSets: ReturnType<typeof buildPermanentExclusionSets>;
  planDate: string;
  publishableCandidates: MyfansCandidateForDiversity[];
  minimumSelectedCount: number;
  minimumDailyAverageQuality: number;
};

export type MyfansDailyOptionCandidate = ReturnType<typeof evaluateMyfansCandidateDiversity> & {
  optionLabel: "A" | "B" | "C";
  optionName: string;
  optionRank: number;
  novelty: {
    maxPastSimilarity: number;
    nearestPastPostId: number | null;
    sameSourcePastCount: number;
    sameTopicPastCount: number;
    verdict: "fresh" | "near" | "blocked";
    label: "高" | "中" | "低";
    sameSourceLabel: string;
    lastSameSourceDate: string | null;
    lastSameCreatorDate: string | null;
    pastBodySimilarityLabel: "低" | "中" | "高";
  };
};

export type MyfansDailyOptionSlot = {
  slot: string;
  postOrder: number;
  recommendedOption: "A" | "B" | "C";
  candidates: MyfansDailyOptionCandidate[];
};

export type MyfansDailyOptionGenerationInput = {
  rotation: RotationItem[];
  slotOptions: Array<{ postOrder: number; candidates: MyfansDailyOptionCandidate[] }>;
  buildCandidate: (
    item: RotationItem,
    index: number,
    attempt: number,
    excludedProducts: Set<number>,
    forcedQuote?: MyfansQuoteCandidate | null,
  ) => MyfansCandidateForDiversity;
  evaluateDiversity: (candidate: MyfansCandidateForDiversity) => ReturnType<typeof evaluateMyfansCandidateDiversity>;
  noveltyFor: (candidate: ReturnType<typeof evaluateMyfansCandidateDiversity>) => ReturnType<typeof evaluateMyfansCandidateNovelty>;
  optionDiverseEnough: (
    candidate: MyfansDailyOptionDiversityCandidate,
    options: MyfansDailyOptionDiversityCandidate[],
  ) => boolean;
  quotePool: ReturnType<typeof buildMyfansQuotePool>;
  quoteBySlot: Map<string, MyfansQuoteCandidate>;
  normalizeSourceUrl: (value: string | null | undefined) => string;
  detectPublicCopyLeak: (body: string) => { hasLeak: boolean };
  slotRecoveryMaxAttempts: number;
  multiAngleAttemptsPerTopic: number;
  qualityGateMinimum: number;
};

export function buildMyfansExecutionBoard(sourceAnalytics: MyfansAnalytics, options: BuildMyfansExecutionBoardOptions = {}) {
  const {
    analytics,
    day,
    planDate,
    stage,
    permanentExclusionSets,
    planKey,
    learning,
    rotation,
    pastUsage,
    quotePool,
    growthQuotePool,
    productionLinkageEvidence,
    resolverExactQuotes,
    topicBaselines,
    quoteBySlot,
    candidatePoolContext,
  } = prepareMyfansExecution(sourceAnalytics, options, MYFANS_PUBLIC_COPY_GENERATOR_VERSION, isRevenueTargetProduct);
  const {
    productForQuote,
    creatorKeyForCandidateSource,
    attemptedCreatorKeys,
    trackCandidateAttempt,
    topicRows,
    candidateFunnel,
    topicPassRows,
    allowSameProductAcrossDistinctRoles,
    usedProductIds,
    pickProduct,
  } = candidatePoolContext;
  const acceptedBodies: string[] = [];
  const acceptedQuoteCreators = new Set<string>();
  const acceptedReactionTypes = new Set<HumanReactionType>();
  const acceptedTopicIdentities = new Set<string>();
  const acceptedTopicSemanticKeys: string[] = [];
  const acceptedReasonCounts = new Map<MyfansReasonToCare, number>();
  const acceptedCreatorCounts = new Map<string, number>();

  const quoteAttemptContext: MyfansQuoteAttemptContext = {
    analytics,
    productionLinkageEvidence,
    resolverExactQuotes,
    quoteBySlot,
    quotePool,
    acceptedQuoteCreators,
    pastUsage,
    planDate,
  };
  const quoteForAttempt = (product: MyfansProduct | null, postType: string, index: number, attempt: number) =>
    selectMyfansQuoteForAttempt(product, postType, index, attempt, quoteAttemptContext);
  const candidateBuildContext: MyfansCandidateBuildContext = {
    analytics,
    day,
    growthQuotePool,
    learning,
    planDate,
    pickProduct,
    productForQuote,
    productionLinkageEvidence,
    quoteBySlot,
    quoteForAttempt,
    resolverExactQuotes,
    stage,
    topicBaselines,
  };
  const buildCandidate = (item: RotationItem, index: number, attempt: number, excludedProducts: Set<number>, forcedQuote: MyfansQuoteCandidate | null = null) =>
    trackCandidateAttempt(buildMyfansCandidate(candidateBuildContext, item, index, attempt, excludedProducts, forcedQuote));
  const publishableCandidates: Array<ReturnType<typeof buildCandidate>> = [];

const diversityContext: MyfansCandidateDiversityContext = {
    acceptedBodies,
    acceptedCreatorCounts,
    acceptedQuoteCreators,
    acceptedReactionTypes,
    acceptedReasonCounts,
    acceptedTopicIdentities,
    acceptedTopicSemanticKeys,
    analytics,
    creatorKeyForCandidateSource,
    pastUsage,
    permanentExclusionSets,
    planDate,
    publishableCandidates,
    minimumSelectedCount: MYFANS_DAILY_SELECTED_MIN,
    minimumDailyAverageQuality: MYFANS_DAILY_AVERAGE_QUALITY_MINIMUM,
  };
  const evaluateDiversity = (candidate: ReturnType<typeof buildCandidate>) => evaluateMyfansCandidateDiversity(candidate, diversityContext);
  const recordAcceptedCandidate = (candidate: ReturnType<typeof evaluateDiversity>) =>
    recordAcceptedMyfansCandidate(candidate, diversityContext, usedProductIds, allowSameProductAcrossDistinctRoles);

const noveltyFor = (candidate: ReturnType<typeof evaluateDiversity>) => evaluateMyfansCandidateNovelty(candidate, {
    posts: analytics.posts,
    pastUsage,
    planDate,
    postedSourceCooldownDays: POSTED_SOURCE_COOLDOWN_DAYS,
    creatorKeyForCandidateSource,
  });

  const { initialAttempts, recoveryHistory, heldCandidates, slotOptions } = buildMyfansCandidateRecovery({
    rotation,
    buildCandidate,
    evaluateDiversity,
    noveltyFor,
    recordAcceptedCandidate,
    publishableCandidates,
    usedProductIds,
    allowSameProductAcrossDistinctRoles,
    slotRecoveryMaxAttempts: MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS,
    multiAngleAttemptsPerTopic: MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC,
    qualityGateMinimum: MYFANS_QUALITY_GATE_MINIMUM,
  });

  appendMyfansAggregateRecovery({
    publishableCandidates,
    acceptedBodies,
    recoveryHistory,
    topicPassRows,
    rotation,
    planDate,
    stage,
  });
  const strategy = MYFANS_30_DAY_STRATEGY[stage];
  const fullDailyOptions = buildMyfansDailyOptionSlots({
    rotation,
    slotOptions,
    buildCandidate,
    evaluateDiversity,
    noveltyFor,
    optionDiverseEnough: isMyfansDailyOptionDiverseEnough,
    quotePool,
    quoteBySlot,
    normalizeSourceUrl,
    detectPublicCopyLeak,
    slotRecoveryMaxAttempts: MYFANS_SLOT_RECOVERY_MAX_ATTEMPTS,
    multiAngleAttemptsPerTopic: MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC,
    qualityGateMinimum: MYFANS_QUALITY_GATE_MINIMUM,
  });
  const { finalCandidates: finalPublishableCandidates, selectedOptions } = selectMyfansFinalDailyCandidates(
    fullDailyOptions,
    MYFANS_DAILY_SELECTED_MIN,
    MYFANS_DAILY_SELECTED_MAX,
  );
  const finalLinkedCount = finalPublishableCandidates.filter((candidate) => candidate.linkStrategy === "body_link" || candidate.linkStrategy === "reply_link").length;
  const finalNoDirectLinkCount = finalPublishableCandidates.length - finalLinkedCount;
  const allDailyOptions = fullDailyOptions.flatMap((slot) => slot.candidates);
  const { diagnostics, linkedCandidateFunnel, supplyAudit } = buildMyfansExecutionAudit({
    allDailyOptions,
    analytics,
    buildLinkedCandidateFunnel: () => buildLinkedCandidateFunnel(analytics, {
      planDate,
      topicBaselines,
      pastUsage,
      attemptedCreatorKeys,
      allDailyOptions,
      finalPublishableCandidates,
      creatorKeyForCandidateSource,
    }),
    finalPublishableCandidates,
    growthQuotePoolCount: growthQuotePool.length,
    pastUsage,
    planDate,
    quotePool,
    recoveryHistory,
    rotation,
    topicRows,
  });
  return {
    day,
    planDate,
    planKey,
    selectedOptions,
    stage,
    strategy,
    profileGuide: MYFANS_PROFILE_GUIDE,
    candidates: finalPublishableCandidates,
    candidateOptions: fullDailyOptions,
    linkedCandidateFunnel,
    supplyAudit,
    heldCandidates,
    linkedCount: finalLinkedCount,
    noDirectLinkCount: finalNoDirectLinkCount,
    learning,
    quotePool,
    diagnostics,
    topicValue: {
      funnel: { ...candidateFunnel, final: finalPublishableCandidates.length },
      top10: topicRows.slice(0, 10),
      rejected: topicRows.filter((row) => row.topicValue.verdict === "LOW_TOPIC_VALUE").slice(0, 20),
    },
    planningReason: planningReasonFor(stage, learning),
    todayStrategy: buildTodayStrategy(analytics, finalPublishableCandidates, heldCandidates, quotePool),
    recovery: buildMyfansRecoverySummary({
      rotation,
      allDailyOptions,
      finalPublishableCandidates,
      initialAttempts,
      recoveryHistory,
    }),    outboundTasks: buildOutboundTasks(analytics, quotePool),
    profileFunnel: buildProfileFunnel(analytics),
    bottleneck: buildBottleneck(analytics),
  };
}

export function buildQuoteCandidateCollectionTasks(analytics: MyfansAnalytics): MyfansQuoteCollectionTask[] {
  const quotePool = buildMyfansQuotePool(analytics);
  return buildMyfansQuoteCollectionTasksFromPool(analytics, quotePool, {
    creatorKeyFromCreator,
    creatorKeyFromQuote,
    quoteUrlFromCandidate,
    daysSinceIso,
    addDaysIso,
    quoteMinScore: QUOTE_MIN_SCORE,
    quoteRefreshDays: QUOTE_REFRESH_DAYS,
  });
}
