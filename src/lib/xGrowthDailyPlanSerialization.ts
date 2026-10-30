import type { DecisionFacts } from "@/lib/domain/decisionFacts";
import type { XMediaAsset } from "@/lib/xMediaAssets";
import type { XVisualVideoFacts } from "@/lib/xVisualVideoFacts";
import type { XDailyTopPick, XGrowthIntent, XGrowthOpportunity } from "./xGrowthOS";

export type XDailyPlanStatus = "draft" | "confirmed" | "completed" | "regenerated";

export type SerializedTopPick = {
  key: string;
  workId: number;
  productId: string;
  title: string;
  url: string;
  pickOrder: number;
  slotId?: XDailyTopPick["slotId"];
  slotRole?: XDailyTopPick["slotRole"];
  slotLabel?: string;
  candidateRank?: XDailyTopPick["candidateRank"];
  candidateId?: string;
  isSelected?: boolean;
  role: XGrowthIntent;
  intent: XGrowthIntent;
  sourceType: XGrowthOpportunity["sourceType"];
  creativeAngle: XGrowthOpportunity["creativeAngle"];
  postText: string;
  replyText: string | null;
  mediaType: XGrowthOpportunity["mediaType"];
  mediaUsage: XGrowthOpportunity["mediaUsage"];
  canNativeVideo: boolean;
  recommendedMediaUrl: string | null;
  recommendedTimeLabel: string;
  whyToday: string[];
  whyBuzz: string;
  mediaDecision: string;
  alternativeReason: string | null;
  dailyScore: number;
  sourceEvidence: string[];
  decisionFacts: DecisionFacts | null;
  visualFacts?: XVisualVideoFacts | null;
  setDiversity: XDailyTopPick["setDiversity"];
  mediaAsset: {
    id: number | undefined;
    work_id: number | null | undefined;
    source_url: string | undefined;
    media_quality: XMediaAsset["media_quality"] | null | undefined;
    manual_tags: NonNullable<XMediaAsset["manual_tags"]>;
    review_source: string | null | undefined;
    x_usage_allowed: boolean | undefined;
    rights_status: XMediaAsset["rights_status"] | undefined;
    can_modify: boolean | undefined;
    trim_start_seconds: number | null | undefined;
    trim_reviewed_at: string | null | undefined;
    trim_modify_confirmed: boolean | undefined;
    trim_note: string | null | undefined;
  } | null;
  selectedVariant: {
    id: string;
    url: string;
    quality: XDailyTopPick["creativeVariants"][number]["quality"];
    buzzPotential: XDailyTopPick["creativeVariants"][number]["buzzPotential"];
    mediaType: XDailyTopPick["creativeVariants"][number]["mediaType"];
    linkPlan: XDailyTopPick["creativeVariants"][number]["linkPlan"];
    linkStrategy: XDailyTopPick["creativeVariants"][number]["linkStrategy"];
    ctaStrategy: XDailyTopPick["creativeVariants"][number]["ctaStrategy"];
    hookDirection: XDailyTopPick["creativeVariants"][number]["hookDirection"];
    hookType: XDailyTopPick["creativeVariants"][number]["hookType"];
  } | null;
};

export type PersistedXDailyPlan = {
  id: number;
  account_handle: string;
  plan_date: string;
  primary_bottleneck: string;
  mission_title: string;
  mission_reason: string;
  target_mix: Record<string, number>;
  recommended_actions: Array<{ intent: XGrowthIntent; label: string; detail: string }>;
  status: XDailyPlanStatus;
  top_picks: SerializedTopPick[];
  supply_diagnostics: Record<string, unknown>;
  native_x_learning: Record<string, unknown>;
  performance_timings: Record<string, number>;
  generated_at: string | null;
  stale_reason: string | null;
};

export type PersistedTopPickMediaAsset = NonNullable<SerializedTopPick["mediaAsset"]> & {
  id: number;
  media_type?: string | null;
};

export function serializeTopPick(item: XDailyTopPick): SerializedTopPick {
  const variant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
  return {
    key: item.key,
    workId: item.workId,
    productId: item.productId,
    title: item.title,
    url: variant?.url ?? `/works/${item.workId}`,
    pickOrder: item.pickOrder,
    slotId: item.slotId,
    slotRole: item.slotRole,
    slotLabel: item.slotLabel,
    candidateRank: item.candidateRank,
    candidateId: item.candidateId,
    isSelected: item.isSelected,
    role: item.role,
    intent: item.intent,
    sourceType: item.sourceType,
    creativeAngle: item.creativeAngle,
    postText: item.postText,
    replyText: item.replyText,
    mediaType: item.mediaType,
    mediaUsage: item.mediaUsage,
    canNativeVideo: item.canNativeVideo,
    recommendedMediaUrl: item.recommendedMediaUrl,
    recommendedTimeLabel: item.recommendedTimeLabel,
    whyToday: item.whyToday,
    whyBuzz: item.whyBuzz,
    mediaDecision: item.mediaDecision,
    alternativeReason: item.alternativeReason,
    dailyScore: item.dailyScore,
    sourceEvidence: item.sourceEvidence,
    decisionFacts: item.decisionFacts ?? null,
    visualFacts: item.visualFacts,
    setDiversity: item.setDiversity,
    mediaAsset: item.mediaAsset ? {
      id: item.mediaAsset.id,
      work_id: item.mediaAsset.work_id,
      source_url: item.mediaAsset.source_url,
      media_quality: item.mediaAsset.media_quality,
      manual_tags: item.mediaAsset.manual_tags ?? [],
      review_source: item.mediaAsset.review_source,
      x_usage_allowed: item.mediaAsset.x_usage_allowed,
      rights_status: item.mediaAsset.rights_status,
      can_modify: item.mediaAsset.can_modify,
      trim_start_seconds: item.mediaAsset.trim_start_seconds ?? 0,
      trim_reviewed_at: item.mediaAsset.trim_reviewed_at,
      trim_modify_confirmed: item.mediaAsset.trim_modify_confirmed,
      trim_note: item.mediaAsset.trim_note,
    } : null,
    selectedVariant: variant ? {
      id: variant.id,
      url: variant.url,
      quality: variant.quality,
      buzzPotential: variant.buzzPotential,
      mediaType: variant.mediaType,
      linkPlan: variant.linkPlan,
      linkStrategy: variant.linkStrategy,
      ctaStrategy: variant.ctaStrategy,
      hookDirection: variant.hookDirection,
      hookType: variant.hookType,
    } : null,
  };
}

export function mergePersistedTopPickMediaAsset(
  pick: SerializedTopPick,
  latestAssets: Map<number, PersistedTopPickMediaAsset>,
  assetsByWorkId: Map<number, PersistedTopPickMediaAsset[]>,
) {
  const existingId = pick.mediaAsset?.id;
  const workAssets = assetsByWorkId.get(pick.workId) ?? [];
  const sourceUrl = pick.mediaAsset?.source_url ?? pick.recommendedMediaUrl;
  const latest = (existingId ? latestAssets.get(existingId) : undefined)
    ?? workAssets.find((asset) => asset.source_url && asset.source_url === sourceUrl)
    ?? workAssets.find((asset) => asset.media_type === "sample_movie")
    ?? workAssets[0];
  if (!latest) return pick;
  return {
    ...pick,
    recommendedMediaUrl: pick.mediaType === "sample_movie" ? latest.source_url ?? pick.recommendedMediaUrl : pick.recommendedMediaUrl,
    mediaAsset: { ...pick.mediaAsset, ...latest },
  };
}
