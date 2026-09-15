import { NextResponse } from "next/server";
import { MYFANS_VISUAL_ANALYZER_VERSION } from "@/lib/myfansXExecution";
import { runMyfansVisualVerificationBatch, selectVisualVerificationBatch } from "@/lib/myfansVisualVerification";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, max);
}

function statusValue(value: unknown) {
  const raw = cleanText(value, 40);
  return raw === "verified" || raw === "partial" || raw === "unavailable" ? raw : "partial";
}

function renderStatusValue(value: unknown) {
  const raw = cleanText(value, 40);
  return raw === "browser_visible" || raw === "app_only" || raw === "blocked" || raw === "unknown" ? raw : "unknown";
}

async function selectCompanionBatch(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const limit = Math.min(20, Math.max(1, Math.round(numberValue(payload.limit, 10))));
  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_validation_status,visual_render_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today,visual_analysis_status,visual_analysis_json,visual_analyzed_at,visual_analyzer_version")
    .or("visual_analysis_status.neq.verified,visual_analysis_status.is.null")
    .order("score", { ascending: false })
    .limit(300);
  if (approvedMediaId) query = query.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  const candidates = selectVisualVerificationBatch((data ?? []) as MyfansQuoteCandidate[], limit);
  return NextResponse.json({
    ok: true,
    analyzerVersion: MYFANS_VISUAL_ANALYZER_VERSION,
    checked: 0,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      xPostUrl: candidate.x_post_url,
      mediaPermalink: candidate.media_permalink,
      mediaType: candidate.media_type,
      mediaCount: candidate.media_count,
      sourceXHandle: candidate.source_x_handle,
      textExcerpt: candidate.text_excerpt,
    })),
  });
}

async function saveCompanionEvidence(payload: Record<string, unknown>) {
  const id = numberValue(payload.id, 0);
  if (!id) return NextResponse.json({ error: "candidate idが不正です。" }, { status: 400 });
  const evidence = payload.evidence && typeof payload.evidence === "object" ? payload.evidence as Record<string, unknown> : {};
  const status = statusValue(payload.status);
  const analysis = {
    scene_summary: cleanText(evidence.sceneSummary || evidence.scene_summary),
    subject_summary: cleanText(evidence.subjectSummary || evidence.subject_summary),
    composition: cleanText(evidence.composition),
    standout_moment: cleanText(evidence.standoutMoment || evidence.standout_moment),
    attention_worthy_moment: cleanText(evidence.attentionWorthyMoment || evidence.attention_worthy_moment),
    color_contrast_cue: cleanText(evidence.colorContrastCue || evidence.color_contrast_cue),
    confidence: cleanText(evidence.confidence, 20) === "high" ? "high" : cleanText(evidence.confidence, 20) === "medium" ? "medium" : "low",
    evidence_source: "x_logged_in_chrome_visual",
    frame_or_image_count: Math.max(0, Math.round(numberValue(evidence.frameOrImageCount, 0))),
    first_frame_cue: cleanText(evidence.firstFrameCue || evidence.first_frame_cue),
    motion_change_cue: cleanText(evidence.motionChangeCue || evidence.motion_change_cue),
    beginning_vs_later: cleanText(evidence.beginningVsLater || evidence.beginning_vs_later),
    concrete_observation: cleanText(evidence.concreteObservation || evidence.attentionWorthyMoment || evidence.sceneSummary),
    failure_reason: cleanText(evidence.failureReason || payload.reason, 160),
    inspected_url: cleanText(evidence.inspectedUrl, 240),
    media_type: cleanText(evidence.mediaType, 20),
  };
  const { error } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({
      visual_analysis_status: status,
      visual_analysis_json: analysis,
      visual_analyzed_at: new Date().toISOString(),
      visual_analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION,
      visual_render_status: renderStatusValue(payload.visualRenderStatus),
    })
    .eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true, id, status, visualRenderStatus: renderStatusValue(payload.visualRenderStatus), analysis });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    if (payload.action === "select_companion_batch") return await selectCompanionBatch(payload);
    if (payload.action === "save_companion_evidence") return await saveCompanionEvidence(payload);
    const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
    const limit = numberValue(payload.limit, 10);
    const result = await runMyfansVisualVerificationBatch({ approvedMediaId, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "visual候補分析に失敗しました。" }, { status: 500 });
  }
}
