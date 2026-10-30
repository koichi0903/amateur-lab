import type { XCreativeVariant } from "@/lib/xCreativeEngine";
import type { XMediaAsset } from "@/lib/xMediaAssets";
import type { XPostCandidate } from "@/lib/xPostPlanner";
import type { XVisualVideoFacts, visualFactScores } from "@/lib/xVisualVideoFacts";
export type XGrowthIntent = "REACH" | "AUTHORITY" | "FOLLOW" | "CONVERSATION" | "MONEY";
export type XMoneyGateReason = "missing_affiliate_url" | "price_truth_unavailable" | "last_mile_ng" | "native_x_voice_ng" | "unsafe_or_too_explicit" | "duplicate_or_posted" | "stale_or_expired" | "media_mismatch" | "other";
export type XSemanticHookCategory = "motion_shift" | "brightness_shift" | "jacket_video_mismatch" | "opening_change" | "pacing_change" | "visual_contrast" | "hidden_find" | "actress_focus" | "price_reason" | "social_proof" | "comparison" | "dry_observation" | "changed_mind" | "generic_reaction";
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
  mediaUsage: "allowed" | "technical_unchecked" | "not_available";
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
