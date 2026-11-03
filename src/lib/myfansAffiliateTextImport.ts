import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseMyfansAffiliateText } from "./myfans/myfansAffiliateTextParser";

export { parseMyfansAffiliateText } from "./myfans/myfansAffiliateTextParser";

const DEFAULT_MEDIA_NAME = "@lumi_reviw";

export async function saveMyfansAffiliateTextImport(rawText: string) {
  const parsed = parseMyfansAffiliateText(rawText);
  const creatorRecord = {
    display_name: parsed.creator.displayName,
    myfans_url: parsed.creator.myfansUrl,
    x_url: "",
    genre: "",
    activity_note: parsed.creator.activityNote,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const creatorQuery = creatorRecord.myfans_url
    ? supabaseAdmin.from("myfans_creators").upsert(creatorRecord, { onConflict: "myfans_url", ignoreDuplicates: false }).select("id").single()
    : supabaseAdmin.from("myfans_creators").insert(creatorRecord).select("id").single();
  const { data: creator, error: creatorError } = await creatorQuery;
  if (creatorError) throw creatorError;

  const selectionScore = calculateMyfansSelectionScore({
    price: parsed.product.price,
    rewardRate: parsed.product.rewardRate,
    planSignupReward: 0,
    recurringRewardRate: 0,
    popularityRank: null,
    likesCount: parsed.product.likesCount,
    savesCount: parsed.product.savesCount,
    isNew: false,
    hasAffiliateUrl: Boolean(parsed.product.affiliateUrl),
    hasApprovedMedia: true,
  });
  const productRecord = {
    creator_id: creator.id,
    title: parsed.product.title,
    product_url: parsed.product.productUrl,
    affiliate_url: parsed.product.affiliateUrl,
    source_x_url: "",
    genre: "",
    product_type: "single",
    status: "candidate",
    price: parsed.product.price,
    reward_rate: parsed.product.rewardRate,
    estimated_reward: Math.round(parsed.product.price * (parsed.product.rewardRate / 100)),
    plan_signup_reward: 0,
    recurring_reward_rate: 0,
    popularity_rank: null,
    likes_count: parsed.product.likesCount,
    saves_count: parsed.product.savesCount,
    is_new: false,
    selection_reason: parsed.product.selectionReason,
    notes: "",
    approved_media_name: DEFAULT_MEDIA_NAME,
    approved_media_url: "",
    affiliate_media_id: "",
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .upsert(productRecord, { onConflict: "product_url", ignoreDuplicates: false })
    .select("id")
    .single();
  if (productError) throw productError;

  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "product",
    entity_id: product.id,
    action: "affiliate_text_import",
    summary: productRecord.title,
    metadata: { creator_id: creator.id, selectionScore },
  });

  return { creatorId: creator.id, productId: product.id, title: productRecord.title };
}
