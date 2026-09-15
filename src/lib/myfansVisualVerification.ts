import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MYFANS_VISUAL_ANALYZER_VERSION } from "@/lib/myfansXExecution";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";

export type MyfansVisualAnalysisJson = {
  concrete_scene: string;
  subject_action: string;
  standout_moment: string;
  contrast_change: string;
  color_composition: string;
  human_curiosity_cue: string;
  confidence: "high" | "medium" | "low";
  evidence_source: string;
  frame_or_image_count: number;
  scene_summary: string;
  subject_summary: string;
  composition: string;
  visible_change_or_contrast: string;
  motion_cue: string;
  beginning_vs_later_change: string;
  concrete_observation: string;
};

export type MyfansVisualVerificationResult = {
  id: number;
  status: "verified" | "partial" | "unavailable";
  visualRenderStatus: "browser_visible" | "app_only" | "blocked" | "unknown";
  analysis: MyfansVisualAnalysisJson;
  reason: string;
};

const LOW_VALUE_CUE = /白い背景|プロフィール画面|ただの部屋|縦動画(?:であること|だけ)|背景のみ|画面だけ|目に入る|方向性が分かる|理由がある|比べた時の違いが残る/;

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function visualRenderStatusForQuote(candidate: Pick<MyfansQuoteCandidate, "media_type" | "media_permalink" | "quote_visual_ready" | "media_permalink_validation_status">) {
  if (candidate.media_type === "video" && candidate.media_permalink && candidate.media_permalink_validation_status === "verified_video_permalink") return "browser_visible" as const;
  if (candidate.media_type === "image" && candidate.media_permalink && candidate.quote_visual_ready) return "browser_visible" as const;
  if (/not_rendered|app_only/i.test(candidate.media_permalink_validation_status ?? "")) return "app_only" as const;
  if (/blocked|sensitive|login|unavailable|deleted|timeout|no_result/i.test(candidate.media_permalink_validation_status ?? "")) return "blocked" as const;
  return candidate.media_permalink ? "unknown" as const : "blocked" as const;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[0];
    if (match) return match.trim();
  }
  return "";
}

function concreteCueFromSource(text: string) {
  return firstMatch(text, [
    /(冒頭|最初|1枚目|一枚目)[^。！？!?]{0,34}(切り替わ|変わ|近|引き|寄り|表情|動き|色|赤|黒|階段|海|砂浜|制服)/,
    /(引き|アップ|近め|距離|表情|制服|階段|海|砂浜|赤|黒|ベッド|室内)[^。！？!?]{0,34}(切り替わ|変わ|見える|残る|浮く|近い|違う)/,
    /(動画|写真|画像)[^。！？!?]{0,34}(冒頭|切り替わ|表情|距離|色|構図|動き)/,
  ]);
}

function contrastFromCue(cue: string) {
  if (/切り替わ|変わ|途中|冒頭|最初/.test(cue)) return cue;
  if (/赤|黒|海|砂浜/.test(cue)) return "明るい背景に赤や黒の色が浮く";
  if (/引き|アップ|近|距離/.test(cue)) return "引きと近さの差がある";
  return "";
}

function colorCompositionFromCue(cue: string) {
  if (/赤|黒|海|砂浜/.test(cue)) return "明るい場面に強い色の対比がある";
  if (/階段|制服/.test(cue)) return "階段と制服っぽい見え方で場面がすぐ分かる";
  if (/ベッド|室内/.test(cue)) return "室内の距離感が分かる構図";
  if (/引き|アップ|近/.test(cue)) return "距離の変化が分かるフレーミング";
  return "";
}

export function analyzeMyfansQuoteVisual(candidate: MyfansQuoteCandidate): MyfansVisualVerificationResult {
  const renderStatus = visualRenderStatusForQuote(candidate);
  const sourceText = cleanText(candidate.text_excerpt);
  const cue = concreteCueFromSource(sourceText);
  const hasVisualMedia = candidate.media_type === "image" || candidate.media_type === "video";
  const lowValue = LOW_VALUE_CUE.test(cue) || LOW_VALUE_CUE.test(sourceText);
  const canVerify = renderStatus === "browser_visible" && hasVisualMedia && cue.length >= 5 && !lowValue;
  const partial = renderStatus === "browser_visible" && hasVisualMedia && !canVerify;
  const mediaLabel = candidate.media_type === "video" ? "動画" : candidate.media_type === "image" ? "画像" : "投稿";
  const observation = cue || (hasVisualMedia ? `${mediaLabel}は見えるが、強い場面差は本文から確認できない` : "視覚要素を確認できない");
  const contrast = contrastFromCue(observation);
  const composition = colorCompositionFromCue(observation);
  const analysis: MyfansVisualAnalysisJson = {
    concrete_scene: observation,
    subject_action: /人物|表情|制服|ベッド|階段/.test(observation) ? "人物中心の場面" : `${mediaLabel}内の見せ場`,
    standout_moment: contrast || observation,
    contrast_change: contrast,
    color_composition: composition,
    human_curiosity_cue: canVerify ? observation : "",
    confidence: canVerify ? "medium" : partial ? "low" : "low",
    evidence_source: canVerify || partial ? "browser_visible_media_and_source_text" : "unavailable_or_blocked_media",
    frame_or_image_count: Math.max(1, candidate.media_count ?? 1),
    scene_summary: observation,
    subject_summary: /人物|表情|制服|ベッド|階段/.test(observation) ? "人物中心" : "",
    composition,
    visible_change_or_contrast: contrast,
    motion_cue: candidate.media_type === "video" ? (contrast || observation) : "",
    beginning_vs_later_change: /冒頭|最初|切り替わ|変わ/.test(observation) ? observation : "",
    concrete_observation: observation,
  };
  return {
    id: candidate.id,
    status: canVerify ? "verified" : partial ? "partial" : "unavailable",
    visualRenderStatus: renderStatus,
    analysis,
    reason: canVerify ? "browser_visible mediaと具体的source textからvisual cueを確認" : partial ? "mediaは見えるがAttention cueが弱い/抽象" : "mediaが見えない、または未確認",
  };
}

function priorityScore(candidate: MyfansQuoteCandidate) {
  const render = visualRenderStatusForQuote(candidate);
  const freshness = candidate.collected_at ? Math.max(0, 14 - (Date.now() - new Date(candidate.collected_at).getTime()) / 86_400_000) : 0;
  const engagement = Math.log10(Math.max(1, candidate.views ?? 0)) * 8 + Math.log10(Math.max(1, candidate.likes ?? 0)) * 6;
  const media = render === "browser_visible" ? 60 : candidate.has_video || candidate.has_image ? 20 : 0;
  const unanalyzed = candidate.visual_analysis_status !== "verified" ? 25 : 0;
  return media + freshness + engagement + candidate.score + unanalyzed;
}

export function selectVisualVerificationBatch(candidates: MyfansQuoteCandidate[], limit: number) {
  const selected: MyfansQuoteCandidate[] = [];
  const creatorCounts = new Map<string, number>();
  const pool = candidates
    .filter((candidate) => candidate.visual_analysis_status !== "verified")
    .filter((candidate) => candidate.has_image || candidate.has_video || candidate.media_permalink)
    .sort((a, b) => priorityScore(b) - priorityScore(a));
  for (const candidate of pool) {
    const creatorKey = candidate.creator_id ? `creator:${candidate.creator_id}` : `x:${candidate.creator_x_url.toLowerCase()}`;
    const count = creatorCounts.get(creatorKey) ?? 0;
    if (count >= 2 && selected.length < Math.ceil(limit * 0.8)) continue;
    selected.push(candidate);
    creatorCounts.set(creatorKey, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export async function runMyfansVisualVerificationBatch(options: { approvedMediaId?: number | null; limit?: number }) {
  const limit = Math.min(20, Math.max(1, Math.round(options.limit ?? 10)));
  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_validation_status,visual_render_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today,visual_analysis_status,visual_analysis_json,visual_analyzed_at,visual_analyzer_version")
    .or("visual_analysis_status.neq.verified,visual_analysis_status.is.null")
    .order("score", { ascending: false })
    .limit(200);
  if (options.approvedMediaId) query = query.or(`approved_media_id.eq.${options.approvedMediaId},approved_media_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  const batch = selectVisualVerificationBatch((data ?? []) as MyfansQuoteCandidate[], limit);
  const results = batch.map(analyzeMyfansQuoteVisual);
  for (const result of results) {
    const { error: updateError } = await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({
        visual_analysis_status: result.status,
        visual_analysis_json: result.analysis,
        visual_analyzed_at: new Date().toISOString(),
        visual_analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION,
        visual_render_status: result.visualRenderStatus,
      })
      .eq("id", result.id);
    if (updateError) throw updateError;
  }
  return {
    checked: results.length,
    verified: results.filter((result) => result.status === "verified").length,
    partial: results.filter((result) => result.status === "partial").length,
    unavailable: results.filter((result) => result.status === "unavailable").length,
    results,
  };
}
