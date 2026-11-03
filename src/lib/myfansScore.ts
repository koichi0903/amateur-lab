export type MyfansScoreInput = {
  price: number;
  rewardRate: number;
  planSignupReward: number;
  recurringRewardRate: number;
  popularityRank: number | null;
  likesCount: number;
  savesCount: number;
  isNew: boolean;
  hasAffiliateUrl: boolean;
  hasApprovedMedia: boolean;
  source_x_url?: string;
  createdAt?: string;
  creatorProductCount?: number;
  pastImpressions?: number;
  pastClicks?: number;
  pastConversions?: number;
  pastReward?: number;
  observedUpdateCount30d?: number;
  planSignupEvidenceCount?: number;
  competitorExposureScore?: number | null;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function recencyScore(createdAt: string | undefined, isNew: boolean) {
  if (isNew) return 1;
  if (!createdAt) return 0.35;
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (!Number.isFinite(ageDays)) return 0.35;
  return clamp01(1 - ageDays / 45);
}

export const MYFANS_OPPORTUNITY_CONSTANTS = {
  minReliablePosts: 12,
  minReliableClicks: 20,
  baseCtr: 0.004,
  baseCvr24h: 0.018,
  maxExpectedRewardPerMille: 900,
};

export type MyfansOpportunityScores = {
  growthScore: number;
  revenueScore: number;
  creatorLtvScore: number;
  expectedRewardPer1000Impressions: number;
  confidence: number;
  labels: string[];
  reason: string;
};

type MyfansOpportunityContext = {
  estimatedReward: number;
  reaction: number;
  popularity: number;
  freshness: number;
  materialSafety: number;
  hookEase: number;
  readiness: number;
  productReward: number;
  planReward: number;
  recurring: number;
  creatorDepth: number;
  updateFrequency: number | null;
  planSignupEvidence: number | null;
};

type MyfansPerformanceSignals = {
  pastReward: number;
  confidence: number;
  expectedRewardPer1000Impressions: number;
};

type MyfansScoreDimensions = Pick<MyfansOpportunityScores, "growthScore" | "revenueScore" | "creatorLtvScore" | "labels">;

function opportunityContextFor(input: MyfansScoreInput): MyfansOpportunityContext {
  const estimatedReward = Math.max(0, Math.round(input.price * (input.rewardRate / 100)));
  const reaction = clamp01(input.likesCount / 300 + input.savesCount / 120);
  const popularity = input.popularityRank ? clamp01(1 - (input.popularityRank - 1) / 80) : 0.35;
  const freshness = recencyScore(input.createdAt, input.isNew);
  const materialSafety = input.hasApprovedMedia ? 1 : input.source_x_url ? 0.7 : 0.35;
  const hookEase = clamp01((reaction * 0.38) + (freshness * 0.28) + (popularity * 0.22) + (materialSafety * 0.12));
  const readiness = (input.hasAffiliateUrl ? 0.55 : 0) + (input.hasApprovedMedia ? 0.45 : 0);
  const productReward = clamp01(estimatedReward / 2500);
  const planReward = clamp01(input.planSignupReward / 3000);
  const recurring = clamp01(input.recurringRewardRate / 50);
  const creatorDepth = clamp01((input.creatorProductCount ?? 1) / 8);
  const updateFrequency = input.observedUpdateCount30d === undefined ? null : clamp01(input.observedUpdateCount30d / 12);
  const planSignupEvidence = input.planSignupEvidenceCount === undefined ? null : clamp01(input.planSignupEvidenceCount / 5);

  return {
    estimatedReward,
    reaction,
    popularity,
    freshness,
    materialSafety,
    hookEase,
    readiness,
    productReward,
    planReward,
    recurring,
    creatorDepth,
    updateFrequency,
    planSignupEvidence,
  };
}

function performanceSignalsFor(input: MyfansScoreInput, context: MyfansOpportunityContext): MyfansPerformanceSignals {
  const impressions = Math.max(0, input.pastImpressions ?? 0);
  const clicks = Math.max(0, input.pastClicks ?? 0);
  const conversions = Math.max(0, input.pastConversions ?? 0);
  const pastReward = Math.max(0, input.pastReward ?? 0);
  const actualCtr = impressions > 0 ? clicks / impressions : MYFANS_OPPORTUNITY_CONSTANTS.baseCtr;
  const actualCvr = clicks > 0 ? conversions / clicks : MYFANS_OPPORTUNITY_CONSTANTS.baseCvr24h;
  const actualRewardPerMille = impressions > 0 ? (pastReward / impressions) * 1000 : 0;
  const confidence = clamp01(
    (clicks / MYFANS_OPPORTUNITY_CONSTANTS.minReliableClicks) * 0.6 +
      (Math.min(input.creatorProductCount ?? 0, MYFANS_OPPORTUNITY_CONSTANTS.minReliablePosts) / MYFANS_OPPORTUNITY_CONSTANTS.minReliablePosts) * 0.4,
  );
  const adjustedCtr = MYFANS_OPPORTUNITY_CONSTANTS.baseCtr * (1 - confidence) + actualCtr * confidence;
  const adjustedCvr = MYFANS_OPPORTUNITY_CONSTANTS.baseCvr24h * (1 - confidence) + actualCvr * confidence;
  const modeledRewardPerMille = 1000 * adjustedCtr * adjustedCvr * Math.max(context.estimatedReward, input.planSignupReward * 0.7, 300);
  const expectedRewardPer1000Impressions = Math.round(modeledRewardPerMille * (1 - confidence) + actualRewardPerMille * confidence);

  return { pastReward, confidence, expectedRewardPer1000Impressions };
}

function opportunityDimensionsFor(
  context: MyfansOpportunityContext,
  performance: MyfansPerformanceSignals,
): MyfansScoreDimensions {
  const { reaction, freshness, popularity, materialSafety, hookEase, readiness, productReward, planReward, recurring, creatorDepth, updateFrequency, planSignupEvidence } = context;
  const { expectedRewardPer1000Impressions } = performance;
  const growthScore = clampScore(100 * (hookEase * 0.42 + freshness * 0.22 + popularity * 0.18 + materialSafety * 0.12 + readiness * 0.06));
  const revenueScore = clampScore(
    100 *
      (clamp01(expectedRewardPer1000Impressions / MYFANS_OPPORTUNITY_CONSTANTS.maxExpectedRewardPerMille) * 0.34 +
        hookEase * 0.24 +
        productReward * 0.2 +
        (planSignupEvidence === null ? planReward : planSignupEvidence) * 0.12 +
        readiness * 0.1),
  );
  const creatorLtvScore = clampScore(100 * (
    recurring * 0.28 +
    (planSignupEvidence === null ? planReward : planSignupEvidence) * 0.2 +
    creatorDepth * 0.18 +
    (updateFrequency === null ? freshness : updateFrequency) * 0.14 +
    popularity * 0.1 +
    reaction * 0.1
  ));
  const labels = [
    growthScore >= Math.max(revenueScore, creatorLtvScore) ? "成長向き" : "",
    revenueScore >= Math.max(growthScore, creatorLtvScore) ? "売上向き" : "",
    creatorLtvScore >= Math.max(growthScore, revenueScore) ? "長期向き" : "",
  ].filter(Boolean);

  return { growthScore, revenueScore, creatorLtvScore, labels: labels.length ? labels : ["検証候補"] };
}

function opportunityReasonFor(input: MyfansScoreInput, context: MyfansOpportunityContext, performance: MyfansPerformanceSignals) {
  const { reaction, freshness, planSignupEvidence } = context;
  const { pastReward, confidence } = performance;
  return `反応${Math.round(reaction * 100)} / 新しさ${Math.round(freshness * 100)} / pastReward ¥${pastReward.toLocaleString("ja-JP")} / 24時間CV推定を信頼度${Math.round(confidence * 100)}%で補正。プラン加入可能性${planSignupEvidence === null ? "は客観データなしで未評価" : "は実績で評価"}、競合露出${input.competitorExposureScore === undefined || input.competitorExposureScore === null ? "は客観データなしで除外" : "は実績で評価"}。`;
}

export function calculateMyfansOpportunityScores(input: MyfansScoreInput): MyfansOpportunityScores {
  const context = opportunityContextFor(input);
  const performance = performanceSignalsFor(input, context);
  const dimensions = opportunityDimensionsFor(context, performance);

  return {
    ...dimensions,
    expectedRewardPer1000Impressions: performance.expectedRewardPer1000Impressions,
    confidence: Number(performance.confidence.toFixed(2)),
    reason: opportunityReasonFor(input, context, performance),
  };
}

export function calculateMyfansSelectionScore(input: MyfansScoreInput) {
  const opportunity = calculateMyfansOpportunityScores(input);
  const estimatedReward = Math.round(input.price * (input.rewardRate / 100));
  const rewardScore = Math.min(30, estimatedReward / 80);
  const planScore = Math.min(18, input.planSignupReward / 150);
  const recurringScore = Math.min(12, input.recurringRewardRate * 0.8);
  const popularityScore = input.popularityRank
    ? Math.max(0, 16 - Math.min(16, (input.popularityRank - 1) * 0.8))
    : 4;
  const reactionScore = Math.min(14, input.likesCount / 20 + input.savesCount / 10);
  const freshnessScore = input.isNew ? 6 : 0;
  const readinessScore = (input.hasAffiliateUrl ? 6 : 0) + (input.hasApprovedMedia ? 4 : 0);

  return clampScore(
    rewardScore +
      planScore +
      recurringScore +
      popularityScore +
      reactionScore +
      freshnessScore +
      readinessScore +
      opportunity.growthScore * 0.18 +
      opportunity.revenueScore * 0.22 +
      opportunity.creatorLtvScore * 0.1,
  );
}

export function myfansLaunchPriority(score: number) {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}
