import { calculateMyfansSelectionScore, myfansLaunchPriority } from "./myfansScore";
import { intValue, nullableId, numberValue, text } from "./formDataValues";

type ProductFormMetrics = {
  price: number;
  rewardRate: number;
  planSignupReward: number;
  recurringRewardRate: number;
  popularityRank: number | null;
  likesCount: number;
  savesCount: number;
  isNew: boolean;
};

type ProductFormAffiliateFields = {
  affiliate_url_generated_at?: string;
  affiliate_url_expires_at?: string | null;
  affiliate_url_source?: string;
};

export function buildMyfansProductFormRecord(
  formData: FormData,
  approvedMediaId: number | null,
  now: () => string = () => new Date().toISOString(),
) {
  const metrics = productFormMetrics(formData);
  const approvedMediaName = text(formData, "approved_media_name");
  const affiliateUrl = text(formData, "affiliate_url");
  const selectionScore = productFormSelectionScore(formData, metrics, approvedMediaName, affiliateUrl);
  const record = productFormFields(formData, metrics, approvedMediaId, approvedMediaName, affiliateUrl, selectionScore, now);
  return { record, selectionScore };
}

function productFormMetrics(formData: FormData): ProductFormMetrics {
  return {
    price: intValue(formData, "price"),
    rewardRate: numberValue(formData, "reward_rate"),
    planSignupReward: intValue(formData, "plan_signup_reward"),
    recurringRewardRate: numberValue(formData, "recurring_reward_rate"),
    popularityRank: nullableId(formData, "popularity_rank"),
    likesCount: intValue(formData, "likes_count"),
    savesCount: intValue(formData, "saves_count"),
    isNew: text(formData, "is_new") === "true",
  };
}

function productFormSelectionScore(formData: FormData, metrics: ProductFormMetrics, approvedMediaName: string, affiliateUrl: string) {
  return calculateMyfansSelectionScore({
    price: metrics.price,
    rewardRate: metrics.rewardRate,
    planSignupReward: metrics.planSignupReward,
    recurringRewardRate: metrics.recurringRewardRate,
    popularityRank: metrics.popularityRank,
    likesCount: metrics.likesCount,
    savesCount: metrics.savesCount,
    isNew: metrics.isNew,
    hasAffiliateUrl: Boolean(affiliateUrl),
    hasApprovedMedia: Boolean(approvedMediaName || text(formData, "affiliate_media_id")),
    source_x_url: text(formData, "source_x_url"),
  });
}

function productFormFields(
  formData: FormData,
  metrics: ProductFormMetrics,
  approvedMediaId: number | null,
  approvedMediaName: string,
  affiliateUrl: string,
  selectionScore: number,
  now: () => string,
) {
  return {
    creator_id: nullableId(formData, "creator_id"),
    approved_media_id: approvedMediaId,
    title: text(formData, "title"),
    product_url: text(formData, "product_url"),
    affiliate_url: affiliateUrl,
    ...productFormAffiliateFields(formData, affiliateUrl, now),
    source_x_url: text(formData, "source_x_url"),
    creator_x_url: text(formData, "creator_x_url"),
    quote_candidate_x_url: productFormQuoteCandidateUrl(formData),
    media_permission_status: formTextOrDefault(formData, "media_permission_status", "unknown"),
    media_permission_note: text(formData, "media_permission_note"),
    genre: text(formData, "genre"),
    product_type: formTextOrDefault(formData, "product_type", "single"),
    status: formTextOrDefault(formData, "status", "candidate"),
    price: metrics.price,
    reward_rate: metrics.rewardRate,
    estimated_reward: Math.round(metrics.price * (metrics.rewardRate / 100)),
    plan_signup_reward: metrics.planSignupReward,
    recurring_reward_rate: metrics.recurringRewardRate,
    popularity_rank: metrics.popularityRank,
    likes_count: metrics.likesCount,
    saves_count: metrics.savesCount,
    is_new: metrics.isNew,
    selection_reason: text(formData, "selection_reason"),
    notes: text(formData, "notes"),
    approved_media_name: approvedMediaName,
    approved_media_url: text(formData, "approved_media_url"),
    affiliate_media_id: text(formData, "affiliate_media_id"),
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
    last_reviewed_at: now(),
    updated_at: now(),
  };
}

function productFormAffiliateFields(formData: FormData, affiliateUrl: string, now: () => string): ProductFormAffiliateFields {
  if (!affiliateUrl) return {};
  return {
    affiliate_url_generated_at: text(formData, "affiliate_url_generated_at") || now(),
    affiliate_url_expires_at: text(formData, "affiliate_url_expires_at") || null,
    affiliate_url_source: text(formData, "affiliate_url_source") || "manual_form",
  };
}

function productFormQuoteCandidateUrl(formData: FormData) {
  return text(formData, "quote_candidate_x_url") || text(formData, "source_x_url");
}

function formTextOrDefault(formData: FormData, name: string, fallback: string) {
  return text(formData, name) || fallback;
}
