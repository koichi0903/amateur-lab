import { cleanXStatusUrl } from "@/lib/myfansCompanionInput";
import { mergePersistedQuoteMediaEvidence } from "@/lib/myfansQuoteCandidateEvidence";
import {
  projectGlobalQuoteCandidates,
  projectGlobalQuoteRankUpdates,
  type GlobalQuoteRankCandidate,
} from "@/lib/myfansQuoteGlobalRankProjection";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function updateGlobalQuoteRanks(approvedMediaId: number | null) {
  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,creator_id,creator_x_url,score,creator_rank,collected_at,cooldown_until,last_used_at,use_count,is_repost,x_post_url,media_type,media_permalink,quote_visual_ready,media_permalink_validation_status,visual_score")
    .lte("creator_rank", 3)
    .gte("score", 55)
    .order("score", { ascending: false })
    .limit(500);
  if (approvedMediaId) query = query.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;

  const rows = projectGlobalQuoteCandidates(
    (data ?? []) as GlobalQuoteRankCandidate[],
    new Date().toISOString(),
  );

  const { error: resetError } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ global_rank: null, selected_for_today: false })
    .or(approvedMediaId ? `approved_media_id.eq.${approvedMediaId},approved_media_id.is.null` : "approved_media_id.is.null,approved_media_id.not.is.null");
  if (resetError) throw resetError;

  const updates = projectGlobalQuoteRankUpdates(rows);
  for (const update of updates) {
    const { error: updateError } = await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({ global_score: update.global_score, global_rank: update.global_rank, selected_for_today: update.selected_for_today })
      .eq("id", update.id);
    if (updateError) throw updateError;
  }
}

export async function saveQuoteCandidate(record: Record<string, unknown>, creatorId: number, existingCandidateId?: number | null) {
  const postUrl = cleanXStatusUrl(record.x_post_url);
  const query = existingCandidateId
    ? supabaseAdmin.from("myfans_quote_candidates").select("id,selected,media_type,media_permalink,media_count,quote_visual_ready,media_permalink_validation_status,media_permalink_verified_at,visual_score,has_image,has_video").eq("id", existingCandidateId).maybeSingle()
    : supabaseAdmin.from("myfans_quote_candidates").select("id,selected,media_type,media_permalink,media_count,quote_visual_ready,media_permalink_validation_status,media_permalink_verified_at,visual_score,has_image,has_video").eq("creator_id", creatorId).eq("x_post_url", postUrl).order("id", { ascending: true }).limit(1).maybeSingle();
  const { data: existing, error: findError } = await query;
  if (findError) throw findError;
  if (existing?.id) {
    const mergedRecord = mergePersistedQuoteMediaEvidence(existing, record);
    const { error } = await supabaseAdmin.from("myfans_quote_candidates").update({ ...record, ...mergedRecord, selected: Boolean(existing.selected) }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.from("myfans_quote_candidates").insert(record).select("id").single();
  if (error) throw error;
  return data?.id ?? null;
}
