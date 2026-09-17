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

const GATE_REASONS = /sensitive|login|challenge|blocked/i;

async function ensureQueue(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = Math.min(10, Math.max(1, Math.round(numberValue(payload.batchSize, 5))));
  let existingQuery = supabaseAdmin.from("myfans_visual_verification_jobs").select("*").in("status", ["pending", "running", "paused"]).order("created_at", { ascending: false }).limit(1);
  existingQuery = approvedMediaId ? existingQuery.eq("approved_media_id", approvedMediaId) : existingQuery.is("approved_media_id", null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return existing;

  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,approved_media_id,creator_id,creator_x_url,x_post_url,media_permalink,media_type,visual_analysis_status")
    .or("visual_analysis_status.neq.verified,visual_analysis_status.is.null")
    .order("score", { ascending: false })
    .limit(300);
  if (approvedMediaId) query = query.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data: candidates, error: candidateError } = await query;
  if (candidateError) throw candidateError;
  const unique = new Map<string, Record<string, unknown>>();
  for (const candidate of candidates ?? []) {
    const sourceUrl = String(candidate.media_permalink || candidate.x_post_url || "").trim();
    if (sourceUrl && !unique.has(sourceUrl)) unique.set(sourceUrl, { ...candidate, source_url: sourceUrl });
  }
  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_visual_verification_jobs")
    .insert({ approved_media_id: approvedMediaId, status: "pending", batch_size: batchSize, total_sources: Math.min(42, unique.size), analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION })
    .select("*").single();
  if (jobError) throw jobError;
  const rows = [...unique.values()].slice(0, 42).map((candidate) => ({
    job_id: job.id,
    quote_candidate_id: candidate.id,
    source_url: candidate.source_url,
    creator_id: candidate.creator_id,
    media_type: candidate.media_type || "none",
    analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION,
  }));
  if (rows.length) {
    const { error: queueError } = await supabaseAdmin.from("myfans_visual_verification_queue").insert(rows);
    if (queueError) throw queueError;
  }
  return job;
}

async function queueStatus(payload: Record<string, unknown>) {
  const job = await ensureQueue(payload);
  const { data: items, error } = await supabaseAdmin.from("myfans_visual_verification_queue").select("id,quote_candidate_id,source_url,status,visual_render_status,last_reason,analyzer_version,processed_at").eq("job_id", job.id).order("id", { ascending: true });
  if (error) throw error;
  return NextResponse.json({ ok: true, job, items: items ?? [] });
}

async function controlQueue(payload: Record<string, unknown>) {
  const jobId = numberValue(payload.jobId, 0);
  const action = cleanText(payload.queueAction || payload.action, 20);
  if (!jobId || !["pause", "resume", "cancel"].includes(action)) return NextResponse.json({ error: "visual queue操作が不正です。" }, { status: 400 });
  const update = action === "pause"
    ? { status: "paused", paused_at: new Date().toISOString(), stopped_reason: "ユーザー操作でpause" }
    : action === "resume"
      ? { status: "running", paused_at: null, stopped_reason: null, consecutive_gate_failures: 0 }
      : { status: "cancelled", stopped_reason: "ユーザー操作でcancel", completed_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from("myfans_visual_verification_jobs").update(update).eq("id", jobId).select("*").single();
  if (error) throw error;
  if (action === "resume") {
    await supabaseAdmin.from("myfans_visual_verification_queue").update({ status: "pending", updated_at: new Date().toISOString() }).eq("job_id", jobId).eq("status", "processing");
  }
  return NextResponse.json({ ok: true, job: data });
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
  const queue = await ensureQueue({ ...payload, batchSize: limit });
  if (["paused", "cancelled", "completed"].includes(queue.status)) return NextResponse.json({ ok: true, analyzerVersion: MYFANS_VISUAL_ANALYZER_VERSION, checked: 0, paused: queue.status === "paused", job: queue, candidates: [] });
  if (queue.status === "pending") await supabaseAdmin.from("myfans_visual_verification_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", queue.id);
  const { data: queueItems, error: queueError } = await supabaseAdmin.from("myfans_visual_verification_queue").select("id,quote_candidate_id,source_url,media_type,attempt_count").eq("job_id", queue.id).eq("status", "pending").order("id", { ascending: true }).limit(limit);
  if (queueError) throw queueError;
  const ids = (queueItems ?? []).map((item) => item.quote_candidate_id);
  const candidates = selectVisualVerificationBatch(((data ?? []) as MyfansQuoteCandidate[]).filter((candidate) => ids.includes(candidate.id)), limit);
  const selectedIds = candidates.map((candidate) => candidate.id);
  for (const item of queueItems ?? []) if (selectedIds.includes(item.quote_candidate_id)) await supabaseAdmin.from("myfans_visual_verification_queue").update({ status: "processing", attempt_count: Number(item.attempt_count ?? 0) + 1 }).eq("id", item.id);
  return NextResponse.json({
    ok: true,
    analyzerVersion: MYFANS_VISUAL_ANALYZER_VERSION,
    checked: 0,
    job: { ...queue, status: "running" },
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      queueItemId: (queueItems ?? []).find((item) => item.quote_candidate_id === candidate.id)?.id ?? null,
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
  const queueJobId = numberValue(payload.queueJobId, 0);
  const queueItemId = numberValue(payload.queueItemId, 0);
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
  let queuePaused = false;
  if (queueJobId && queueItemId) {
    const reason = cleanText(payload.reason || analysis.failure_reason, 160);
    const { data: job } = await supabaseAdmin.from("myfans_visual_verification_jobs").select("*").eq("id", queueJobId).single();
    const gateFailures = GATE_REASONS.test(reason) ? (job?.consecutive_gate_failures ?? 0) + 1 : 0;
    queuePaused = gateFailures >= 2;
    await supabaseAdmin.from("myfans_visual_verification_queue").update({ status, visual_render_status: renderStatusValue(payload.visualRenderStatus), result_json: analysis, last_reason: reason, processed_at: new Date().toISOString(), analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION }).eq("id", queueItemId).eq("job_id", queueJobId);
    const { count } = await supabaseAdmin.from("myfans_visual_verification_queue").select("id", { count: "exact", head: true }).eq("job_id", queueJobId).in("status", ["verified", "partial", "unavailable", "skipped"]);
    const nextStatus = queuePaused ? "paused" : undefined;
    await supabaseAdmin.from("myfans_visual_verification_jobs").update({
      ...(status === "verified" ? { verified_count: (job?.verified_count ?? 0) + 1 } : {}),
      ...(status === "partial" ? { partial_count: (job?.partial_count ?? 0) + 1 } : {}),
      ...(status === "unavailable" ? { unavailable_count: (job?.unavailable_count ?? 0) + 1 } : {}),
      processed_sources: count ?? 0,
      consecutive_gate_failures: gateFailures,
      status: nextStatus ?? (count === job?.total_sources ? "completed" : "running"),
      ...(queuePaused ? { paused_at: new Date().toISOString(), stopped_reason: "SENSITIVE_CONTENT_GATE / LOGIN_OR_CHALLENGE が2件連続したため自動pause" } : {}),
      ...(count === job?.total_sources ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", queueJobId);
  }
  return NextResponse.json({ ok: true, id, status, visualRenderStatus: renderStatusValue(payload.visualRenderStatus), analysis, queuePaused });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    if (payload.action === "queue_status") return await queueStatus(payload);
    if (payload.action === "queue_control") return await controlQueue(payload);
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
