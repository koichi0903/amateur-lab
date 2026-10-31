import { intValue, nullableId, text } from "../formDataValues";
import { getMyfansStrategy } from "../myfansStrategy";

export type MyfansPostRecordContext = {
  productId: number | null;
  approvedMediaId: number | null;
  approvedMediaName: string;
  patternId: number | null;
};

export function parseMyfansPostCardPayload(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function buildMyfansPostRecord(formData: FormData, context: MyfansPostRecordContext) {
  const growthScore = intValue(formData, "growth_score");
  const revenueScore = intValue(formData, "revenue_score");
  const creatorLtvScore = intValue(formData, "creator_ltv_score");
  const expectedRewardPer1000 = intValue(formData, "expected_reward_per_1000_impressions");
  return {
    product_id: context.productId,
    post_type: text(formData, "post_type") || "discovery",
    status: text(formData, "status") || "draft",
    body: text(formData, "body"),
    self_reply: text(formData, "self_reply"),
    includes_pr: text(formData, "includes_pr") !== "false",
    source_x_url: text(formData, "source_x_url"),
    affiliate_url: text(formData, "affiliate_url"),
    selection_reason: text(formData, "selection_reason"),
    scheduled_at: text(formData, "scheduled_at") || null,
    posted_at: text(formData, "posted_at") || null,
    x_post_url: text(formData, "x_post_url"),
    actual_posted_by: text(formData, "actual_posted_by"),
    impressions: intValue(formData, "impressions"),
    likes_count: intValue(formData, "likes_count"),
    reposts_count: intValue(formData, "reposts_count"),
    replies_count: intValue(formData, "replies_count"),
    clicks: intValue(formData, "clicks"),
    growth_stage: text(formData, "growth_stage"),
    link_strategy: text(formData, "link_strategy") || "no_link",
    cta_strategy: text(formData, "cta_strategy"),
    creative_variant_id: text(formData, "creative_variant_id"),
    creative_strategy: text(formData, "creative_strategy") || "text_only",
    creative_reason: text(formData, "creative_reason"),
    card_payload: parseMyfansPostCardPayload(text(formData, "card_payload")),
    ogp_check_required: text(formData, "ogp_check_required") === "true",
    quote_x_url: text(formData, "quote_x_url"),
    media_permission_status: text(formData, "media_permission_status") || "unknown",
    planned_slot: text(formData, "planned_slot"),
    objective: text(formData, "objective") || "impression",
    approved_media_name: context.approvedMediaName,
    approved_media_id: context.approvedMediaId,
    pattern_id: context.patternId,
    quote_candidate_id: nullableId(formData, "quote_candidate_id"),
    creator_id: nullableId(formData, "creator_id"),
    strategy_type: getMyfansStrategy(context.approvedMediaId).strategyType,
    global_content_fingerprint: text(formData, "global_content_fingerprint") || null,
    growth_score_snapshot: growthScore,
    revenue_score_snapshot: revenueScore,
    creator_ltv_score_snapshot: creatorLtvScore,
    expected_reward_per_1000_impressions_snapshot: expectedRewardPer1000,
    external_metrics_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
