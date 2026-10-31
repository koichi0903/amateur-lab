import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansQuoteCandidate } from "./myfansAnalyticsTypes";
export { fetchAllMyfansDailyFunnelInputs } from "./myfansDailyFunnelInputs";

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const QUOTE_CANDIDATE_SELECT =
  "id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_verified_at,media_permalink_validation_status,visual_render_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today,visual_analysis_status,visual_analysis_json,visual_analyzed_at,visual_analyzer_version,source_value_score,source_value_verdict,source_value_reasons,reaction_angles,source_specificity";
const QUOTE_CANDIDATE_SELECT_LEGACY =
  "id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_verified_at,media_permalink_validation_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today";
const MYFANS_X_POST_SELECT_BASE =
  "id,product_id,approved_media_id,pattern_id,quote_candidate_id,creator_id,strategy_type,global_content_fingerprint,post_type,status,body,self_reply,includes_pr,source_x_url,affiliate_url,selection_reason,scheduled_at,posted_at,x_post_url,x_post_id,impressions,likes_count,reposts_count,replies_count,clicks,growth_stage,link_strategy,cta_strategy,creative_variant_id,creative_strategy,creative_reason,card_payload,ogp_check_required,quote_x_url,media_permission_status,planned_slot,objective,approved_media_name,growth_score_snapshot,revenue_score_snapshot,creator_ltv_score_snapshot,expected_reward_per_1000_impressions_snapshot,metrics_sync_error,created_at,myfans_products(title,price,estimated_reward)";
const MYFANS_X_POST_SELECT_WITH_METRICS_RECORDED =
  MYFANS_X_POST_SELECT_BASE.replace("created_at,", "metrics_recorded_at,created_at,");
const MYFANS_PRODUCT_SELECT_BASE =
  "id,creator_id,approved_media_id,title,product_url,genre,product_type,status,price,reward_rate,estimated_reward,plan_signup_reward,recurring_reward_rate,popularity_rank,likes_count,saves_count,is_new,source_x_url,creator_x_url,quote_candidate_x_url,affiliate_url,media_permission_status,media_permission_note,selection_reason,approved_media_name,approved_media_url,affiliate_media_id,selection_score,launch_priority,created_at,myfans_creators(display_name)";
const MYFANS_PRODUCT_SELECT_WITH_AFFILIATE_METADATA =
  MYFANS_PRODUCT_SELECT_BASE.replace("affiliate_url,", "affiliate_url,affiliate_url_generated_at,affiliate_url_expires_at,affiliate_url_source,");

export async function fetchMyfansXPosts() {
  const withRecorded = await supabaseAdmin
    .from("myfans_x_posts")
    .select(MYFANS_X_POST_SELECT_WITH_METRICS_RECORDED)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!withRecorded.error || !/metrics_recorded_at|schema cache|column/i.test(withRecorded.error.message)) return withRecorded;
  return supabaseAdmin
    .from("myfans_x_posts")
    .select(MYFANS_X_POST_SELECT_BASE)
    .order("created_at", { ascending: false })
    .limit(100);
}

export async function fetchMyfansProducts() {
  const withMetadata = await supabaseAdmin
    .from("myfans_products")
    .select(MYFANS_PRODUCT_SELECT_WITH_AFFILIATE_METADATA, { count: "exact" })
    .order("selection_score", { ascending: false })
    .limit(100);
  if (!withMetadata.error || !/affiliate_url_generated_at|affiliate_url_expires_at|affiliate_url_source|schema cache|column/i.test(withMetadata.error.message)) return withMetadata;
  return supabaseAdmin
    .from("myfans_products")
    .select(MYFANS_PRODUCT_SELECT_BASE, { count: "exact" })
    .order("selection_score", { ascending: false })
    .limit(100);
}

export async function fetchAllMyfansQuoteCandidates() {
  const pageSize = 1000;
  const data: MyfansQuoteCandidate[] = [];
  let count = 0;
  let from = 0;

  let select = QUOTE_CANDIDATE_SELECT;
  while (true) {
    const result = await supabaseAdmin
      .from("myfans_quote_candidates")
      .select(select, from === 0 ? { count: "exact" } : undefined)
      .order("collected_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (result.error) {
      if (select === QUOTE_CANDIDATE_SELECT && /visual_analysis|visual_analyzed|visual_analyzer|source_value|reaction_angles|schema cache|column/i.test(result.error.message)) {
        select = QUOTE_CANDIDATE_SELECT_LEGACY;
        data.length = 0;
        count = 0;
        from = 0;
        continue;
      }
      return { data, count, pageSize, error: result.error };
    }
    if (from === 0) count = result.count ?? 0;

    const page = (result.data ?? []) as unknown as MyfansQuoteCandidate[];
    data.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { data, count: count || data.length, pageSize, error: null };
}
