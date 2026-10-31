import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";
import type { XGrowthIntent } from "./xGrowthOS";

type OpportunityFallbackRow = Record<string, unknown>;
type PartialPick = Partial<SerializedTopPick>;

function fallbackMediaAsset(row: OpportunityFallbackRow) {
  if (!row.recommended_media_asset_id) return null;
  return {
    id: Number(row.recommended_media_asset_id),
    work_id: row.work_id ? Number(row.work_id) : null,
    source_url: undefined,
    media_quality: undefined,
    manual_tags: [],
    review_source: undefined,
    x_usage_allowed: undefined,
    rights_status: undefined,
    can_modify: undefined,
    trim_start_seconds: 0,
    trim_reviewed_at: undefined,
    trim_modify_confirmed: undefined,
    trim_note: undefined,
  };
}

function fallbackSetDiversity(row: OpportunityFallbackRow, pick: PartialPick): NonNullable<SerializedTopPick["setDiversity"]> {
  const intent = String(row.intent) as XGrowthIntent;
  const sourceType = pick.sourceType ?? "WORK";
  const mediaType = String(row.media_type) as SerializedTopPick["mediaType"];
  return {
    status: "OK",
    roleLabel: "",
    signature: {
      openingPattern: "",
      sentenceStructure: "",
      judgmentPhrase: "",
      subjectStructure: "",
      intent,
      sourceType,
      hookType: "",
      emotionalAngle: "",
      mediaType,
      ctaStrategy: "",
      linkStrategy: "",
      endingPhrase: "",
      numberPlacement: "none",
      semanticHookCategory: "generic_reaction",
      reactionType: "observation",
      judgmentShape: "open_observation",
      primaryFactKind: "none",
      abstractFallback: false,
    },
    reasons: [],
  };
}

function fallbackMediaPresentationFields(row: OpportunityFallbackRow, pick: PartialPick) {
  return {
    mediaUsage: pick.mediaUsage ?? "allowed",
    canNativeVideo: Boolean(pick.canNativeVideo),
    recommendedMediaUrl: pick.recommendedMediaUrl ?? null,
    recommendedTimeLabel: pick.recommendedTimeLabel ?? "",
    whyToday: pick.whyToday ?? [],
    whyBuzz: pick.whyBuzz ?? String(row.adoption_reason ?? ""),
  };
}

function fallbackMediaDecisionFields(pick: PartialPick) {
  return {
    mediaDecision: pick.mediaDecision ?? "",
    alternativeReason: pick.alternativeReason ?? null,
    dailyScore: pick.dailyScore ?? 0,
    sourceEvidence: pick.sourceEvidence ?? [],
    decisionFacts: pick.decisionFacts ?? null,
  };
}

function fallbackMediaReferenceFields(row: OpportunityFallbackRow, pick: PartialPick) {
  return {
    setDiversity: pick.setDiversity ?? fallbackSetDiversity(row, pick),
    mediaAsset: pick.mediaAsset ?? fallbackMediaAsset(row),
    selectedVariant: pick.selectedVariant ?? null,
  };
}

function fallbackMediaFields(row: OpportunityFallbackRow, pick: PartialPick) {
  return {
    ...fallbackMediaPresentationFields(row, pick),
    ...fallbackMediaDecisionFields(pick),
    ...fallbackMediaReferenceFields(row, pick),
  };
}

export function buildPersistedTopPickFallback(row: OpportunityFallbackRow, index: number): SerializedTopPick {
  const genome = (row.creative_genome ?? {}) as Record<string, unknown>;
  const pick = (genome.persisted_top_pick ?? {}) as PartialPick;
  const intent = String(row.intent) as XGrowthIntent;
  return {
    ...pick,
    key: String(row.opportunity_key),
    workId: Number(row.work_id),
    productId: String(row.product_id ?? ""),
    title: String(row.topic ?? pick.title ?? ""),
    url: pick.url ?? `/works/${row.work_id}`,
    pickOrder: Number(pick.pickOrder ?? index + 1),
    role: intent,
    intent,
    sourceType: pick.sourceType ?? "WORK",
    creativeAngle: pick.creativeAngle ?? "VIDEO_FIRST",
    postText: String(row.post_text ?? ""),
    replyText: row.reply_text ? String(row.reply_text) : null,
    mediaType: String(row.media_type) as SerializedTopPick["mediaType"],
    ...fallbackMediaFields(row, pick),
  };
}
