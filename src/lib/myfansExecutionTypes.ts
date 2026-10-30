export type HookType =
  | "GAP"
  | "HUMAN_STORY"
  | "STRONG_VISUAL"
  | "RAPID_GROWTH"
  | "DATA_ANOMALY"
  | "NEWCOMER"
  | "RANKING_SURGE"
  | "PRICE_ANOMALY"
  | "SOCIAL_PROOF"
  | "COMPARISON"
  | "SCARCITY_DEADLINE";

export type AudienceIntent = "broad_curiosity" | "creator_interest" | "category_interest" | "comparison_shopper" | "purchase_intent" | "returning_follower";

export type MyfansExecutionDiagnostics = {
  planDateJst: string;
  rawQuoteCount: number;
  rawFresh14dCount: number;
  hardEligibleCount: number;
  ranked12Count: number;
  mediaScopeCount: number;
  freshnessCooldownCount: number;
  sourceValuePassCount: number;
  sourceValueLowCount: number;
  qualifiedDiscoveryCount: number;
  qualifiedDiscoveryIds: Array<number | string>;
  productLinkedCount: number;
  creatorMapHitCount: number;
  growthQuotePoolCount: number;
  postDedupeCount: number;
  qualityGatePassCount: number;
  qualityGateHoldCount: number;
  qualityGateHoldReasons: Array<{ reason: string; count: number }>;
  finalCandidateCount: number;
  finalOptionCount: number;
  selectedCount: number;
};

export type PublicCopyFacts = {
  sourceText: string;
  creatorName: string;
  creatorHandle: string;
  publicMetrics: {
    views: number | null;
    likes: number | null;
    reposts: number | null;
    replies: number | null;
    popularityRank: number | null;
    productLikes: number;
    productSaves: number;
    price: number;
    isNew: boolean;
  };
  visualContext: "video" | "image" | "public_post" | "text_only";
  quoteVisualAnalysis: QuoteVisualAnalysis | null;
  productFacts: {
    title: string;
    genre: string;
  };
};

export type HumanReactionType = "surprise" | "agreement" | "curiosity" | "contrast" | "immediacy" | "specific_appeal" | "unexpected" | "visual_clarity";
export type CopySearchAngle = "direct_reaction" | "surprise" | "contrast" | "curiosity" | "visual_specificity" | "social_proof_secondary" | "editorial_insight";

export type VisualUnderstanding = {
  visualAnalysisStatus: "verified" | "partial" | "unavailable";
  analyzerVersion: string;
  mediaType: "video" | "image" | "public_post" | "text_only";
  frameOrImageCount: number;
  sceneOrSubjectSummary: string;
  subjectSummary: string;
  visibleChangeOrContrast: string;
  visualMoment: string;
  firstImpressionCue: string;
  contrastGap: string;
  visualCue: string;
  motionCue: string;
  compositionOrStyle: string;
  facialExpressionOrPoseCue: string;
  cameraDistanceOrFraming: string;
  textOverlayCue: string;
  sourceTextCue: string;
  sourceAngle: string;
  concreteVisualCue: string;
  cueConfidence: "high" | "medium" | "low";
  sourceEvidence: string;
  evidenceSource: string;
  rawVisualEvidence: string;
  humanObservation: string;
  attentionMoment: string;
  attentionValue: AttentionValue;
  uncertaintyLevel: "low" | "medium" | "high";
  visualExplainsAppeal: boolean;
  standoutMoment: string;
};

export type QuoteVisualAnalysis = {
  status: "verified" | "partial" | "unavailable";
  mediaType: "video" | "image" | "public_post" | "text_only";
  frameOrImageCount: number;
  sceneSummary: string;
  subjectSummary: string;
  composition: string;
  facialExpressionOrPoseCue: string;
  cameraDistanceOrFraming: string;
  visibleChangeOrContrast: string;
  textOverlayCue: string;
  motionCue: string;
  beginningVsLaterChange: string;
  standoutMoment: string;
  concreteObservation: string;
  confidence: "high" | "medium" | "low";
  evidenceSource: string;
  analyzerVersion: string;
};

export type AttentionValue = {
  score: number;
  curiosity: number;
  emotionalPull: number;
  visualSpecificity: number;
  broadComprehensibility: number;
  naturalReaction: number;
  reasons: string[];
  weakCue: boolean;
};
