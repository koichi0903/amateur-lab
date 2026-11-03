import type { XPostLog } from "@/lib/xPostLogs";
import type { XVisualVideoFacts } from "@/lib/xVisualVideoFacts";
import type { DecisionFacts } from "@/lib/domain/decisionFacts";

export type XGrowthIntent = "REACH" | "AUTHORITY" | "FOLLOW" | "CONVERSATION" | "MONEY";
export type XHookType = "price_anomaly" | "rating_anomaly" | "ranking_anomaly" | "review_proof" | "discovery_anomaly" | "buy_timing";
export type XHookDirection = "curiosity" | "contradiction" | "hot_take" | "follow_up" | "comparison" | "social_proof" | "confession" | "missed" | "surprise" | "empathy" | "question" | "surprising_concentration" | "contrast" | "curation" | "anti_obvious" | "pattern_break" | "selection_tension";
export type XPostFormat = "discovery" | "buy_timing" | "rating_anomaly" | "social_proof" | "actress" | "comparison";
export type XImageStrategy = "original_work_image" | "branded_data_card";
export type XLinkStrategy = "body_link" | "reply_link";
export type XCtaStrategy = "price_cta" | "reason_cta";
export type XCreativeStructure = "short" | "data" | "judgment" | "question" | "follow_up" | "series";
export type XCreativeMedia = "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";
export type XLinkPlan = "no_link" | "profile_only" | "reply_link" | "body_link";
export type XSourceType = "WORK" | "MARKET" | "FOLLOW_UP" | "COMPARISON" | "JUDGMENT" | "ACTRESS_TREND" | "GENRE_TREND" | "MAKER_TREND" | "PRICE_EVENT" | "HIDDEN_GEM" | "MONEY";
export type XVideoManualTag = "first_seconds_strong" | "visual_mismatch" | "actress_fit" | "scene_surprise" | "safe_preview" | "too_explicit_for_reach" | "weak_visual";
export type XHumanVoiceArchetype = "spontaneous_reaction" | "changed_mind" | "quiet_recommendation" | "surprise_mismatch" | "actress_fit" | "hidden_find" | "social_proof_light" | "price_reason" | "conversational" | "dry_observation";

export type XCopyGrammarValidation = { passed: boolean; reasons: string[] };

export type XQualityDimension =
  | "scrollStop" | "curiosity" | "proof" | "judgment" | "followValue"
  | "specificity" | "novelty" | "adSmell" | "ctaFit" | "mediaFit"
  | "shareability" | "replyability";

export type XQualityScore = {
  dimensions: Record<XQualityDimension, number>;
  total: number;
  passed: boolean;
  recommendation: "post" | "revise" | "do_not_post";
  reasons: Record<XQualityDimension, string>;
  weaknesses: string[];
  improvements: string[];
  gate: {
    intent: XGrowthIntent;
    passed: boolean;
    required: string[];
    failed: string[];
  };
  lastMile: {
    verdict: "post_ok" | "revise" | "do_not_post";
    passed: boolean;
    reasons: string[];
    rewriteCount: number;
    humanVoice: {
      passed: boolean;
      checks: Record<"xNative" | "audienceClear" | "readerAction" | "noInternalMetric" | "noRepeatedFact" | "concreteOpening" | "concreteVisualFact", boolean>;
      forbiddenHits: string[];
      reasons: string[];
    };
    nativeXVoice: {
      passed: boolean;
      checks: Record<"timelineNative" | "notOperatorVoice" | "notReviewSite" | "emotionalFirstLine" | "notTooPolished" | "noTemplateReuse" | "subjectVariety", boolean>;
      forbiddenHits: string[];
      reasons: string[];
    };
  };
};

export type XHookAxis = {
  type: XHookType;
  score: number;
  label: string;
  evidence: string;
  metrics: Record<string, number | null>;
};

export type XHookScore = {
  axes: Record<XHookType, XHookAxis>;
  bestHook: XHookAxis;
};

export type XCreativeVariant = {
  id: string;
  intent: XGrowthIntent;
  postFormat: XPostFormat;
  hookType: XHookType;
  structure: XCreativeStructure;
  mediaType: XCreativeMedia;
  imageStrategy: XImageStrategy;
  linkStrategy: XLinkStrategy;
  linkPlan: XLinkPlan;
  ctaStrategy: XCtaStrategy;
  bodyText: string;
  replyText: string | null;
  url: string;
  rationale: string;
  weightedLength: number;
  quality: XQualityScore;
  buzzPotential: {
    total: number;
    scrollStop: number;
    shareability: number;
    replyability: number;
    followValue: number;
    mediaFit: number;
    curiosity: number;
    novelty: number;
    reason: string;
  };
  hookDirection: XHookDirection;
  archetype: XHumanVoiceArchetype;
  hookAlternatives: Array<{ direction: XHookDirection; opening: string; score: number }>;
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

export type XCreativeInput = {
  key: string;
  title: string;
  url: string;
  category: string;
  actress: string | null;
  genre: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  discountRate: number;
  reviewAverage: number | null;
  reviewCount: number;
  ranking: number | null;
  score: number;
  discoveryScore: number | null;
  buyTimingScore: number | null;
  isNinetyDayLow: boolean;
  sampleMovieUrl?: string | null;
  imageUrl?: string | null;
  saleEndAt?: string | null;
  /** Technical availability of an official sample movie; rights-review state is not a candidate gate. */
  hasRightsCheckedMovie?: boolean;
  mediaManualTags?: XVideoManualTag[];
  mediaQuality?: "unreviewed" | "strong" | "normal" | "weak";
  xPageViews?: number;
  xFanzaClicks?: number;
  seriesName?: string | null;
  seriesObservationCount?: number;
  rankingHistoryCount?: number;
  previousRanking?: number | null;
  rankingDelta?: number | null;
  recentLogs?: XPostLog[];
  radarAvailable?: boolean;
  recommendedSlot?: string;
  sourceType?: XSourceType;
  visualFacts?: XVisualVideoFacts | null;
  decisionFacts?: DecisionFacts;
};
