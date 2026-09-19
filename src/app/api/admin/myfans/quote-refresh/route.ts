import { NextResponse } from "next/server";
import { selectCreatorRotation, DEFAULT_CREATOR_COOLDOWN_DAYS } from "@/lib/myfansQuoteRotation";
import { summarizeMyfansQuoteRefreshItems } from "@/lib/myfansQuoteRefreshSummary";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const REPLACED_BY_NEW_JOB = "REPLACED_BY_NEW_JOB: 新しい一括更新で置き換えました。";

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBatchSize(value: unknown) {
  return Math.min(50, Math.max(1, Math.round(numberValue(value, 10))));
}

function normalizeCooldownDays(value: unknown) {
  return Math.min(30, Math.max(1, Math.round(numberValue(value, DEFAULT_CREATOR_COOLDOWN_DAYS))));
}

function normalizeQueueLimit(value: unknown) {
  const parsed = Math.round(numberValue(value, 0));
  return parsed > 0 ? Math.min(1000, parsed) : null;
}

function normalizeXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/?$/);
  return match ? `https://x.com/${match[1]}` : "";
}

async function refreshJobCounts(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status")
    .eq("job_id", jobId);
  if (error) throw error;

  const processed = (items ?? []).filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const success = (items ?? []).filter((item) => item.status === "success").length;
  const failed = (items ?? []).filter((item) => item.status === "failed").length;
  const runningItems = (items ?? []).some((item) => item.status === "running");
  const pendingItems = (items ?? []).some((item) => item.status === "pending");
  const currentJob = await getJob(jobId);
  const status = runningItems ? "running" : pendingItems ? currentJob?.status ?? "pending" : "completed";

  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      status,
      processed_creators: processed,
      success_creators: success,
      failed_creators: failed,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
  if (updateError) throw updateError;
}

async function getJob(jobId: number) {
  const { data: job, error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return job;
}

async function getActiveJob(approvedMediaId?: number | null) {
  let query = supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .in("status", ["pending", "running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (approvedMediaId === null) query = query.is("approved_media_id", null);
  else if (approvedMediaId) query = query.eq("approved_media_id", approvedMediaId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function progress(jobId: number) {
  await refreshJobCounts(jobId);
  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,creator_id,creator_x_url,status,attempts,collected_count,top_score,error,processed_at,myfans_creators(display_name)")
    .eq("job_id", jobId)
    .order("id", { ascending: true });
  if (itemsError) throw itemsError;
  const skipped = (items ?? []).filter((item) => item.status === "skipped").length;
  const summary = summarizeMyfansQuoteRefreshItems(items ?? []);
  return { job, items: items ?? [], skippedCreators: skipped, summary };
}

async function createJob(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = normalizeBatchSize(payload.batchSize);
  const queueLimit = normalizeQueueLimit(payload.queueLimit) ?? batchSize;
  const existing = await getActiveJob(approvedMediaId);
  if (existing) {
    const existingProgress = await progress(existing.id);
    const canReplace =
      payload.replaceActive === true &&
      existingProgress.job.status === "pending" &&
      !existingProgress.job.started_at &&
      existingProgress.job.processed_creators === 0;
    if (!canReplace) return NextResponse.json(existingProgress);
    const { error: cancelError } = await supabaseAdmin
      .from("myfans_quote_refresh_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), last_error: REPLACED_BY_NEW_JOB })
      .eq("id", existing.id);
    if (cancelError) throw cancelError;
    await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: REPLACED_BY_NEW_JOB, processed_at: new Date().toISOString() })
      .eq("job_id", existing.id)
      .eq("status", "pending");
  }
  const { data: creators, error } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,display_name,creator_x_url,is_active")
    .eq("is_active", true)
    .not("creator_x_url", "is", null)
    .neq("creator_x_url", "")
    .limit(1000);
  if (error) throw error;

  const creatorRows = (creators ?? [])
    .map((creator) => ({ ...creator, creator_x_url: normalizeXProfileUrl(creator.creator_x_url) }))
    .filter((creator) => creator.creator_x_url);

  const cooldownDays = normalizeCooldownDays(payload.cooldownDays);
  const { data: visits, error: visitError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("creator_id,processed_at")
    .in("creator_id", creatorRows.map((creator) => creator.id))
    .not("processed_at", "is", null)
    .in("status", ["success", "failed", "skipped"])
    .limit(10000);
  if (visitError) throw visitError;

  const rotation = selectCreatorRotation(creatorRows, visits ?? [], queueLimit, cooldownDays);
  const prioritized = rotation.creators;
  const selectionNote = rotation.selectionMode === "empty"
    ? "全creatorが前日またはcooldown中のため、同日再利用せず対象なし。"
    : rotation.selectionMode === "relaxed"
      ? "全creatorが優先cooldown中のため、前日除外を維持して最古巡回順へ緩和。"
      : `未巡回・${cooldownDays}日以上未巡回を優先。前日巡回creatorは除外。`;

  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .insert({
      approved_media_id: approvedMediaId,
      status: "pending",
      total_creators: prioritized.length,
      batch_size: batchSize,
      rotation_cooldown_days: rotation.cooldownDays,
      minimum_rotation_cooldown_days: rotation.minimumCooldownDays,
      eligible_creators: rotation.eligibleCreators,
      cooldown_excluded_creators: rotation.cooldownExcludedCreators,
      selection_mode: rotation.selectionMode,
      selection_note: selectionNote,
      sensitive_gate_streak_limit: 3,
      sensitive_gate_streak: 0,
    })
    .select("*")
    .single();
  if (jobError) throw jobError;

  if (prioritized.length) {
    const { error: itemError } = await supabaseAdmin.from("myfans_quote_refresh_job_items").insert(
      prioritized.map((creator) => ({
        job_id: job.id,
        creator_id: creator.id,
        creator_x_url: creator.creator_x_url,
      })),
    );
    if (itemError) throw itemError;
  }

  return NextResponse.json({ ...(await progress(job.id)), rotation: { ...rotation, note: selectionNote } });
}

async function nextItem(payload: Record<string, unknown>) {
  const requestedJobId = numberValue(payload.jobId, 0);
  const activeJob = requestedJobId ? await getJob(requestedJobId) : await getActiveJob(numberValue(payload.approvedMediaId, 0) || null);
  if (!activeJob) return NextResponse.json({ done: true, message: "実行中の更新キューはありません。" });
  if (activeJob.status === "paused") return NextResponse.json({ paused: true, job: activeJob });
  if (activeJob.status === "cancelled") return NextResponse.json({ done: true, job: activeJob });

  await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: activeJob.started_at ?? new Date().toISOString() })
    .eq("id", activeJob.id);

  const { data: stale } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id")
    .eq("job_id", activeJob.id)
    .eq("status", "running")
    .lt("processed_at", new Date(Date.now() - 5 * 60_000).toISOString());
  if (stale?.length) {
    await supabaseAdmin.from("myfans_quote_refresh_job_items").update({ status: "pending" }).in("id", stale.map((item) => item.id));
  }

  const { data: item, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .eq("job_id", activeJob.id)
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!item) {
    await refreshJobCounts(activeJob.id);
    return NextResponse.json({ done: true, ...(await progress(activeJob.id)) });
  }

  const { data: running, error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({ status: "running", attempts: item.attempts + 1, processed_at: new Date().toISOString(), error: null })
    .eq("id", item.id)
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .single();
  if (updateError) throw updateError;

  return NextResponse.json({ done: false, jobId: activeJob.id, batchSize: activeJob.batch_size, item: running });
}

async function startJob(payload: Record<string, unknown>) {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "更新キューが見つかりません。" }, { status: 404 });
  if (!["pending", "paused", "running"].includes(job.status)) return NextResponse.json(await progress(jobId));
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: job.started_at ?? new Date().toISOString(), last_error: null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

async function updateJobStatus(payload: Record<string, unknown>, status: "paused" | "running" | "cancelled") {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  if (status === "cancelled") {
    const { error: itemError } = await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: "一括更新をキャンセルしました。", processed_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .in("status", ["pending", "running"]);
    if (itemError) throw itemError;
  }
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status, completed_at: status === "cancelled" ? new Date().toISOString() : null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = numberValue(url.searchParams.get("jobId"), 0);
    const approvedMediaId = numberValue(url.searchParams.get("approvedMediaId"), 0) || null;
    const job = jobId ? await getJob(jobId) : await getActiveJob(approvedMediaId);
    if (!job) return NextResponse.json({ job: null, items: [] });
    return NextResponse.json(await progress(job.id));
  } catch (error) {
    return NextResponse.json({
      job: null,
      items: [],
      warning: error instanceof Error ? error.message : "進捗を取得できませんでした。",
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const action = cleanText(payload.action || "create");
    if (action === "create") return await createJob(payload);
    if (action === "start") return await startJob(payload);
    if (action === "next") return await nextItem(payload);
    if (action === "pause") return await updateJobStatus(payload, "paused");
    if (action === "resume") return await updateJobStatus(payload, "running");
    if (action === "cancel") return await updateJobStatus(payload, "cancelled");
    return NextResponse.json({ error: "未対応の操作です。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新キュー操作に失敗しました。" }, { status: 500 });
  }
}
