import { NextResponse } from "next/server";
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
  return Math.min(50, Math.max(1, Math.round(numberValue(value, 25))));
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
  return { job, items: items ?? [], skippedCreators: skipped };
}

async function createJob(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = normalizeBatchSize(payload.batchSize);
  const queueLimit = normalizeQueueLimit(payload.queueLimit);
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

  const { data: candidates, error: candidateError } = await supabaseAdmin
    .from("myfans_quote_candidates")
    .select("creator_id,collected_at,score")
    .in("creator_id", creatorRows.map((creator) => creator.id));
  if (candidateError) throw candidateError;

  const candidateMap = new Map<number, Array<{ collected_at: string | null; score: number | null }>>();
  for (const candidate of candidates ?? []) {
    if (!candidate.creator_id) continue;
    candidateMap.set(candidate.creator_id, [...(candidateMap.get(candidate.creator_id) ?? []), candidate]);
  }
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const prioritized = creatorRows
    .map((creator) => {
      const rows = candidateMap.get(creator.id) ?? [];
      const lastCollected = rows.map((row) => new Date(row.collected_at ?? 0).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0] ?? 0;
      const priority = rows.length === 0 ? 500 : lastCollected < sevenDaysAgo ? 300 : rows.length < 5 ? 200 : 0;
      return { creator, priority, lastCollected };
    })
    .filter((row) => row.priority > 0 || payload.includeFresh === true)
    .sort((a, b) => b.priority - a.priority || a.lastCollected - b.lastCollected)
    .map((row) => row.creator)
    .slice(0, queueLimit ?? undefined);

  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .insert({
      approved_media_id: approvedMediaId,
      status: "pending",
      total_creators: prioritized.length,
      batch_size: batchSize,
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

  return NextResponse.json(await progress(job.id));
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
