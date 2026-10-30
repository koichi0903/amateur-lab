import { cleanXStatusUrl } from "@/lib/myfansCompanionInput";
import { mergePersistedQuoteMediaEvidence } from "@/lib/myfansQuoteCandidateEvidence";
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

  const now = new Date().toISOString();
  const rows = (data ?? [])
    .filter((row) => !row.is_repost && !row.last_used_at && (!row.cooldown_until || row.cooldown_until <= now))
    .map((row) => {
      const ageDays = row.collected_at ? Math.max(0, (Date.now() - new Date(row.collected_at).getTime()) / 86_400_000) : 7;
      const visualBoost = row.quote_visual_ready && row.media_permalink
        ? row.media_type === "video" ? 18 : row.media_type === "image" ? 12 : 0
        : row.visual_score ? -12 : 0;
      const renderStatus = row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink")
        ? "browser_visible"
        : /not_rendered/i.test(row.media_permalink_validation_status ?? "")
          ? "app_only"
          : "blocked";
      const visualStatusPenalty = renderStatus === "browser_visible" ? 0 : renderStatus === "app_only" ? 30 : 45;
      const globalScore = Math.round(Math.max(0, Math.min(120, row.score + visualBoost + Math.max(0, 10 - ageDays) - ((row.creator_rank ?? 3) - 1) * 4 - (row.use_count ?? 0) * 12)));
      return { ...row, globalScore: Math.max(0, globalScore - visualStatusPenalty) };
    })
    .sort((a, b) => b.globalScore - a.globalScore || b.score - a.score);

  const { error: resetError } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ global_rank: null, selected_for_today: false })
    .or(approvedMediaId ? `approved_media_id.eq.${approvedMediaId},approved_media_id.is.null` : "approved_media_id.is.null,approved_media_id.not.is.null");
  if (resetError) throw resetError;

  const selectedCreators = new Set<string>();
  let selectedCount = 0;
  for (const [index, row] of rows.entries()) {
    const key = row.creator_id ? `creator:${row.creator_id}` : `x:${String(row.creator_x_url).toLowerCase()}`;
    const isVisualReady = Boolean(row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink"));
    const selectedForToday = isVisualReady && !selectedCreators.has(key) && (selectedCount === 0 || row.globalScore >= 78) && selectedCount < 2;
    if (selectedForToday) {
      selectedCreators.add(key);
      selectedCount += 1;
    }
    const { error: updateError } = await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({ global_score: row.globalScore, global_rank: index + 1, selected_for_today: selectedForToday })
      .eq("id", row.id);
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
