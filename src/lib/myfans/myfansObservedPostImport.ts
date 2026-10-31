import { cleanText } from "@/lib/myfans/myfansCompanionInput";

export type ExistingObservedMyfansProduct = {
  id: number;
  affiliate_url: string | null;
  price: number | null;
  likes_count: number | null;
};

type BuildObservedProductRecordsInput = {
  payload: Record<string, unknown>;
  approvedMediaId: number | null;
  existing: ExistingObservedMyfansProduct | null;
  productUrl: string;
  title: string;
  now: string;
  price: number;
  likesCount: number;
};

export function buildObservedProductRecords({
  payload,
  approvedMediaId,
  existing,
  productUrl,
  title,
  now,
  price,
  likesCount,
}: BuildObservedProductRecordsInput) {
  const sourceMetadata = {
    observed_url: productUrl,
    observed_title: title,
    observed_creator_name: cleanText(payload.creatorName),
    observed_genre: cleanText(payload.genre),
    observed_likes_count: likesCount,
    observed_published_at: cleanText(payload.publishedAt),
    observed_price: price || null,
    creator_linkage: "not_inferred_from_post_url",
    affiliate_linkage: "not_observed",
  };
  const record: Record<string, unknown> = {};

  if (!existing) {
    Object.assign(record, {
      creator_id: null,
      affiliate_url: "",
      source_x_url: "",
      genre: cleanText(payload.genre),
      product_type: "single",
      status: "candidate",
      price: 0,
      reward_rate: 0,
      estimated_reward: 0,
      plan_signup_reward: 0,
      recurring_reward_rate: 0,
      likes_count: 0,
      saves_count: 0,
      is_new: false,
      selection_reason: "通常Chromeで表示確認したmyfans投稿の最小商品レコード。creator/affiliateは未推測。",
      selection_score: 0,
      launch_priority: "low",
    });
  }
  if (approvedMediaId) record.approved_media_id = approvedMediaId;
  record.title = title;
  record.product_url = productUrl;
  if (price > 0 && Number(existing?.price ?? 0) === 0) record.price = price;
  if (Number(existing?.likes_count ?? 0) === 0) record.likes_count = likesCount;
  record.ingest_source = "chrome_observed_myfans_post";
  record.source_observed_at = now;
  record.source_metadata = sourceMetadata;
  record.updated_at = now;

  const legacyRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => !["ingest_source", "source_observed_at", "source_metadata"].includes(key)),
  );
  return { sourceMetadata, record, legacyRecord };
}
