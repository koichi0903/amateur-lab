import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { MYFANS_VISUAL_ANALYZER_VERSION } from "@/lib/myfansXExecution";
import { runMyfansVisualVerificationBatch, selectVisualVerificationBatch } from "@/lib/myfansVisualVerification";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import {
  buildVisualVerificationSaveInput,
  cleanText,
  deriveVisualVerificationProgress,
  numberValue,
  type VisualVerificationSaveInput,
} from "@/lib/myfansVisualVerificationPayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimedQueueItem = { id: number; quote_candidate_id: number; source_url: string; media_type: string; attempt_count: number; claim_token: string | null };

function queueLog(event: string, fields: Record<string, unknown> = {}) {
  console.info("[MYFANS_VISUAL_QUEUE]", JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

async function ensureQueue(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = 5;
  let existingQuery = supabaseAdmin.from("myfans_visual_verification_jobs").select("*").in("status", ["pending", "running", "paused"]).order("created_at", { ascending: false }).limit(1);
  existingQuery = approvedMediaId ? existingQuery.eq("approved_media_id", approvedMediaId) : existingQuery.is("approved_media_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;
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
    const { error: releaseError } = await supabaseAdmin.from("myfans_visual_verification_queue").update({ status: "pending", claim_token: null, claimed_at: null, claim_expires_at: null, updated_at: new Date().toISOString() }).eq("job_id", jobId).eq("status", "processing").is("processed_at", null);
    if (releaseError) throw releaseError;
  }
  return NextResponse.json({ ok: true, job: data });
}

async function selectCompanionBatch(payload: Record<string, unknown>) {
  const startedAt = Date.now();
  const limit = 5;
  const queue = await ensureQueue({ ...payload, batchSize: limit });
  if (["paused", "cancelled", "completed"].includes(queue.status)) return NextResponse.json({ ok: true, analyzerVersion: MYFANS_VISUAL_ANALYZER_VERSION, checked: 0, paused: queue.status === "paused", job: queue, candidates: [] });
  if (queue.status === "pending") await supabaseAdmin.from("myfans_visual_verification_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", queue.id);
  const claimToken = randomUUID();
  const claimStartedAt = Date.now();
  const { data: claimedItems, error: queueError } = await supabaseAdmin.rpc("claim_myfans_visual_verification_batch", { p_job_id: queue.id, p_requested_limit: limit, p_claim_token: claimToken });
  if (queueError) throw queueError;
  const queueItems = (claimedItems ?? []) as ClaimedQueueItem[];
  queueLog("claim", { jobId: queue.id, claimed: queueItems.length, claimMs: Date.now() - claimStartedAt });
  const ids = (queueItems ?? []).map((item) => item.quote_candidate_id);
  const candidateQuery = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,approved_media_id,creator_id,product_id,creator_x_url,source_x_handle,x_post_url,media_permalink,media_type,media_count,quote_visual_ready,media_permalink_validation_status,visual_render_status,visual_score,posted_at,text_excerpt,views,likes,reposts,replies,bookmarks,has_image,has_video,is_pinned,is_reply,is_repost,is_quote,collected_at,score,score_reason,selected,creator_rank,global_score,global_rank,last_used_at,use_count,cooldown_until,selected_for_today,visual_analysis_status,visual_analysis_json,visual_analyzed_at,visual_analyzer_version")
    .in("id", ids);
  const { data: claimedCandidates, error: candidateError } = await candidateQuery;
  if (candidateError) throw candidateError;
  const candidates = selectVisualVerificationBatch((claimedCandidates ?? []) as MyfansQuoteCandidate[], limit);
  const selectedIds = candidates.map((candidate) => candidate.id);
  const unselectedIds = (queueItems ?? []).filter((item) => !selectedIds.includes(item.quote_candidate_id)).map((item) => item.id);
  if (unselectedIds.length) {
    const { error: releaseError } = await supabaseAdmin.from("myfans_visual_verification_queue").update({ status: "pending", claim_token: null, claimed_at: null, claim_expires_at: null, updated_at: new Date().toISOString() }).in("id", unselectedIds).eq("job_id", queue.id).eq("claim_token", claimToken);
    if (releaseError) throw releaseError;
  }
  queueLog("select_ack", { jobId: queue.id, claimed: queueItems.length, selected: candidates.length, totalMs: Date.now() - startedAt });
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
      claimToken,
    })),
  });
}

async function saveCandidateVisualEvidence(input: VisualVerificationSaveInput) {
  const candidateUpdateStartedAt = Date.now();
  const { error } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({
      visual_analysis_status: input.status,
      visual_analysis_json: input.analysis,
      visual_analyzed_at: new Date().toISOString(),
      visual_analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION,
      visual_render_status: input.visualRenderStatus,
    })
    .eq("id", input.id);
  if (error) throw error;
  queueLog("candidate_saved", {
    candidateId: input.id,
    status: input.status,
    candidateUpdateMs: Date.now() - candidateUpdateStartedAt,
  });
}

async function resolveVisualVerificationQueueClaim(input: VisualVerificationSaveInput) {
  let jobId = input.queueJobId;
  let itemId = input.queueItemId;
  let claimToken = input.claimToken;
  if (!jobId || !itemId) {
    const { data: legacyQueueItem, error } = await supabaseAdmin
      .from("myfans_visual_verification_queue")
      .select("id,job_id,claim_token")
      .eq("quote_candidate_id", input.id)
      .eq("status", "processing")
      .is("processed_at", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (legacyQueueItem) {
      jobId = Number(legacyQueueItem.job_id);
      itemId = Number(legacyQueueItem.id);
      claimToken = claimToken || String(legacyQueueItem.claim_token || "");
      queueLog("legacy_claim_reconciled", {
        candidateId: input.id,
        queueJobId: jobId,
        queueItemId: itemId,
      });
    }
  }
  return { jobId, itemId, claimToken };
}

async function finishVisualVerificationQueueClaim({
  input,
  jobId,
  itemId,
  claimToken,
  startedAt,
}: {
  input: VisualVerificationSaveInput;
  jobId: number;
  itemId: number;
  claimToken: string;
  startedAt: number;
}) {
  const reason = input.reason;
  const { data: job } = await supabaseAdmin
    .from("myfans_visual_verification_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  const queueUpdate = supabaseAdmin
    .from("myfans_visual_verification_queue")
    .update({
      status: input.status,
      visual_render_status: input.visualRenderStatus,
      result_json: input.analysis,
      last_reason: reason,
      processed_at: new Date().toISOString(),
      analyzer_version: MYFANS_VISUAL_ANALYZER_VERSION,
      claim_token: null,
      claimed_at: null,
      claim_expires_at: null,
    })
    .eq("id", itemId)
    .eq("job_id", jobId)
    .eq("status", "processing");
  const { data: claimedRow, error: queueUpdateError } = claimToken
    ? await queueUpdate.eq("claim_token", claimToken).select("id").maybeSingle()
    : await queueUpdate.select("id").maybeSingle();
  if (queueUpdateError) throw queueUpdateError;
  if (!claimedRow) {
    return {
      conflictResponse: NextResponse.json(
        { error: "queue claimが期限切れまたは別workerで処理済みです。" },
        { status: 409 },
      ),
      queuePaused: false,
    };
  }

  const { count } = await supabaseAdmin
    .from("myfans_visual_verification_queue")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["verified", "partial", "unavailable", "skipped"]);
  const progress = deriveVisualVerificationProgress({
    job,
    count,
    status: input.status,
    reason,
  });
  const jobUpdateStartedAt = Date.now();
  const { error: jobUpdateError } = await supabaseAdmin
    .from("myfans_visual_verification_jobs")
    .update(progress.jobUpdate)
    .eq("id", jobId);
  if (jobUpdateError) throw jobUpdateError;
  queueLog("evidence_saved", {
    jobId,
    queueItemId: itemId,
    status: input.status,
    terminalCount: count ?? 0,
    queuePaused: progress.queuePaused || progress.batchComplete,
    jobUpdateMs: Date.now() - jobUpdateStartedAt,
    totalMs: Date.now() - startedAt,
  });
  return {
    conflictResponse: null,
    queuePaused: progress.queuePaused || progress.batchComplete,
  };
}

async function saveCompanionEvidence(payload: Record<string, unknown>) {
  const startedAt = Date.now();
  const input = buildVisualVerificationSaveInput(payload);
  if (!input.id) {
    return NextResponse.json({ error: "candidate idが不正です。" }, { status: 400 });
  }
  await saveCandidateVisualEvidence(input);
  const queueClaim = await resolveVisualVerificationQueueClaim(input);
  let queuePaused = false;
  if (queueClaim.jobId && queueClaim.itemId) {
    const result = await finishVisualVerificationQueueClaim({
      input,
      jobId: queueClaim.jobId,
      itemId: queueClaim.itemId,
      claimToken: queueClaim.claimToken,
      startedAt,
    });
    if (result.conflictResponse) return result.conflictResponse;
    queuePaused = result.queuePaused;
  }
  return NextResponse.json({
    ok: true,
    id: input.id,
    status: input.status,
    visualRenderStatus: input.visualRenderStatus,
    analysis: input.analysis,
    queuePaused,
  });
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
    console.error("[MYFANS_VISUAL_QUEUE_ERROR]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "visual候補分析に失敗しました。" }, { status: 500 });
  }
}
