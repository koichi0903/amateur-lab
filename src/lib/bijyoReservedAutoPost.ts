import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";
import { analyzeSampleMovie } from "@/lib/xVideoAnalysis";
import { sourceKindFor } from "@/lib/xMediaAssets";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allocateTodaySlots, BIJYO_DEFAULT_SLOTS, bijyoManualIdempotencyKey, buildBijyoMainText, buildBijyoReplyText, tokyoDate, todayProgress } from "@/lib/bijyoReservedWorkflow";
import { calculateBijyoTrimStart } from "@/lib/bijyoTrim";
import { validateTrimStartSeconds } from "@/lib/xMediaAssets";

export { BIJYO_DEFAULT_SLOTS, buildBijyoMainText, buildBijyoReplyText, tokyoDate } from "@/lib/bijyoReservedWorkflow";
export const BIJYO_ACCOUNT = "bijyo1010" as const;

type Work = { id: number; title: string; stage: string; created_at: string; release_date: string; sample_movie_url: string; product_id: string | null };
export type BijyoJob = {
  id: number; work_id: number; kind: "auto" | "manual"; slot_date: string; slot_index: number | null; scheduled_at: string;
  status: string; trim_start_seconds: number; trim_status: string; trim_reason: string; trim_failure_reason: string | null;
  main_text: string; reply_text: string; x_post_id: string | null; posted_at: string | null; failure_reason: string | null; skip_reason: string | null; work?: Work | null;
};

const JOB_SELECT = "id,work_id,kind,slot_date,slot_index,scheduled_at,status,trim_start_seconds,trim_status,trim_reason,trim_failure_reason,main_text,reply_text,x_post_id,posted_at,failure_reason,skip_reason";
const ACTIVE_CANDIDATE_STATUSES = ["pending", "posted", "manual_posted", "skipped", "excluded", "trim_failed"];

async function activeJobs() {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").select(JOB_SELECT).eq("account_handle", BIJYO_ACCOUNT).order("scheduled_at", { ascending: true });
  if (result.error) return { jobs: [] as BijyoJob[], error: result.error.message };
  const rows = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  const workIds = [...new Set(rows.map((row) => Number(row.work_id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const worksResult = workIds.length
    ? await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").in("id", workIds)
    : { data: [], error: null };
  if (worksResult.error) return { jobs: [] as BijyoJob[], error: worksResult.error.message };
  const worksById = new Map((worksResult.data as Work[]).map((work) => [work.id, work]));
  return { jobs: rows.map((row) => ({ ...row, work: worksById.get(Number(row.work_id)) ?? null }) as unknown as BijyoJob), error: null };
}

export async function getBijyoSettings() {
  const result = await supabaseAdmin.from("bijyo_reserved_settings").select("account_handle,enabled,schedule_times,timezone").eq("account_handle", BIJYO_ACCOUNT).maybeSingle();
  if (result.error) return { enabled: false, scheduleTimes: [...BIJYO_DEFAULT_SLOTS], timezone: "Asia/Tokyo", error: result.error.message };
  const row = result.data as { enabled?: boolean; schedule_times?: string[]; timezone?: string } | null;
  return { enabled: row?.enabled === true, scheduleTimes: row?.schedule_times?.length === 4 ? row.schedule_times : [...BIJYO_DEFAULT_SLOTS], timezone: row?.timezone ?? "Asia/Tokyo", error: null };
}

function sevenDaysAgo() { return new Date(Date.now() - 7 * 86_400_000).toISOString(); }

export async function getBijyoCandidates() {
  const result = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").eq("stage", "RESERVED").gte("created_at", sevenDaysAgo()).not("sample_movie_url", "is", null).neq("sample_movie_url", "").not("release_date", "is", null).order("created_at", { ascending: true }).limit(200);
  if (result.error) return { candidates: [] as Work[], error: result.error.message };
  const jobs = await activeJobs();
  if (jobs.error) return { candidates: [] as Work[], error: jobs.error };
  const usedWorkIds = new Set(jobs.jobs.filter((job) => ACTIVE_CANDIDATE_STATUSES.includes(job.status)).map((job) => job.work_id));
  return { candidates: (result.data as Work[]).filter((work) => !usedWorkIds.has(work.id) && sourceKindFor(work.sample_movie_url) === "official_sample"), error: null };
}

async function ensureTodayJobs(date = tokyoDate()) {
  const settings = await getBijyoSettings();
  const current = await activeJobs();
  if (current.error) throw new Error(current.error);
  const candidatesResult = await getBijyoCandidates();
  if (candidatesResult.error) throw new Error(candidatesResult.error);
  const planned = current.jobs.filter((job) => job.slot_date === date && job.kind === "auto" && !["excluded", "skipped"].includes(job.status));
  const slots = allocateTodaySlots({ date, candidates: candidatesResult.candidates, existingJobs: current.jobs.map((job) => ({ work_id: job.work_id, status: job.status, slot_index: job.slot_index, slot_date: job.slot_date, kind: job.kind })), scheduleTimes: settings.scheduleTimes });
  for (const slot of slots) {
    const work = candidatesResult.candidates.find((candidate) => candidate.id === slot.workId);
    if (!work || planned.some((job) => job.slot_index === slot.slotIndex)) continue;
    const inserted = await supabaseAdmin.from("bijyo_reserved_post_jobs").insert({ account_handle: BIJYO_ACCOUNT, work_id: work.id, kind: "auto", slot_date: date, slot_index: slot.slotIndex, scheduled_at: slot.scheduledAt, idempotency_key: `${BIJYO_ACCOUNT}:${date}:${slot.slotIndex}`, status: "pending", main_text: buildBijyoMainText(work), reply_text: buildBijyoReplyText(work.id) }).select("id").single();
    if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);
  }
}

export async function getBijyoDashboard() {
  const date = tokyoDate();
  try {
    await ensureTodayJobs(date);
    const [settings, jobsResult, candidatesResult] = await Promise.all([getBijyoSettings(), activeJobs(), getBijyoCandidates()]);
    if (jobsResult.error) throw new Error(jobsResult.error);
    const jobs = jobsResult.jobs;
    return { ok: true, date, settings, progress: todayProgress(jobs, date), todayJobs: jobs.filter((job) => job.slot_date === date && job.kind === "auto"), candidates: candidatesResult.candidates, jobs, error: candidatesResult.error };
  } catch (error) {
    return { ok: false, date, settings: await getBijyoSettings(), progress: { posted: 0, target: 4, remaining: 4, shortage: 4 }, todayJobs: [] as BijyoJob[], candidates: [] as Work[], jobs: [] as BijyoJob[], error: error instanceof Error ? error.message : String(error) };
  }
}

class BijyoVideoNotFoundError extends Error {
  readonly status = 404;
}

class BijyoTrimValidationError extends Error {
  readonly status = 400;
}

async function loadJob(jobId: number, workId?: number) {
  let jobResult = await supabaseAdmin.from("bijyo_reserved_post_jobs").select(JOB_SELECT).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).maybeSingle();
  if (jobResult.error) return { job: null, error: jobResult.error.message };
  if (!jobResult.data && Number.isSafeInteger(workId) && (workId ?? 0) > 0) {
    jobResult = await supabaseAdmin.from("bijyo_reserved_post_jobs").select(JOB_SELECT).eq("account_handle", BIJYO_ACCOUNT).eq("work_id", workId).maybeSingle();
    if (jobResult.error) return { job: null, error: jobResult.error.message };
  }
  if (!jobResult.data) return { job: null, error: null };
  const job = jobResult.data as unknown as BijyoJob;
  if (Number.isSafeInteger(workId) && (workId ?? 0) > 0 && job.work_id !== workId) return { job: null, error: "jobIdとworkIdの組み合わせが不正です。" };
  const workResult = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").eq("id", job.work_id).maybeSingle();
  if (workResult.error) return { job: null, error: workResult.error.message };
  return { job: { ...job, work: (workResult.data as Work | null) ?? null }, error: null };
}

export async function markBijyoPosted(jobId: number) {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ status: "manual_posted", posted_at: new Date().toISOString(), failure_reason: null }).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).in("status", ["pending", "trim_failed"]).select("id").maybeSingle();
  if (result.error) return { ok: false, error: result.error.message };
  if (!result.data) return { ok: false, error: "この枠はすでに投稿済み、スキップ済み、または対象外です。" };
  return { ok: true };
}

export async function skipBijyoJob(jobId: number, reason = "手動スキップ") {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ status: "skipped", skip_reason: reason }).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).eq("kind", "auto").eq("status", "pending").select("id").maybeSingle();
  if (result.error) return { ok: false, error: result.error.message };
  if (!result.data) return { ok: false, error: "この枠はスキップできません。" };
  await ensureTodayJobs(tokyoDate());
  return { ok: true };
}

export async function excludeBijyoJob(jobId: number) {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ status: "excluded", failure_reason: null }).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).not("status", "in", "(posted,manual_posted)");
  return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

export async function createBijyoManualJob(workId: number) {
  const workResult = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").eq("id", workId).single();
  const work = workResult.data as Work | null;
  if (workResult.error || !work || work.stage !== "RESERVED" || !work.sample_movie_url || !work.release_date || sourceKindFor(work.sample_movie_url) !== "official_sample") return { ok: false, error: "手動投稿には予約作品・発売日・FANZA/DMM公式サンプル動画が必要です。" };
  const existing = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };
  if (existing.data) return { ok: true, jobId: Number(existing.data.id), existing: true };
  const inserted = await supabaseAdmin.from("bijyo_reserved_post_jobs").insert({ account_handle: BIJYO_ACCOUNT, work_id: work.id, kind: "manual", slot_date: tokyoDate(), scheduled_at: new Date().toISOString(), idempotency_key: bijyoManualIdempotencyKey(work.id), status: "pending", main_text: buildBijyoMainText(work), reply_text: buildBijyoReplyText(work.id) }).select("id").single();
  if (!inserted.error) return { ok: true, jobId: Number(inserted.data.id), existing: false };
  if (inserted.error.code !== "23505") return { ok: false, error: inserted.error.message };
  const raced = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  if (raced.error || !raced.data) return { ok: false, error: raced.error?.message ?? inserted.error.message };
  return { ok: true, jobId: Number(raced.data.id), existing: true };
}

type PrepareBijyoVideoOptions = { mode?: "auto" | "manual"; trimStartSeconds?: unknown };

export async function prepareBijyoVideo(jobId: number, workId?: number, options: PrepareBijyoVideoOptions = {}) {
  let loaded = await loadJob(jobId, workId);
  const resolvedWorkId = Number.isSafeInteger(workId) && (workId ?? 0) > 0 ? workId : undefined;
  if (!loaded.job && !loaded.error && resolvedWorkId !== undefined) {
    const ensured = await createBijyoManualJob(resolvedWorkId);
    if (!ensured.ok || !ensured.jobId) throw new BijyoVideoNotFoundError(ensured.error ?? "投稿候補が見つかりません。");
    loaded = await loadJob(ensured.jobId, workId);
  }
  if (loaded.error || !loaded.job || !loaded.job.work) throw new BijyoVideoNotFoundError(loaded.error ?? "投稿候補が見つかりません。");
  const job = loaded.job;
  const work = job.work as Work;
  const previousTrimStatus = job.trim_status;
  const preparing = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ trim_status: "preparing", trim_failure_reason: null }).eq("account_handle", BIJYO_ACCOUNT).eq("id", job.id);
  if (preparing.error) throw new Error(preparing.error.message);
  try {
    let trimStartSeconds: number;
    let reason: string;
    if (options.mode === "manual") {
      const validation = validateTrimStartSeconds(options.trimStartSeconds);
      if (!validation.ok) throw new BijyoTrimValidationError(validation.error);
      trimStartSeconds = validation.value;
      reason = "manual_override";
    } else if (options.mode !== "auto" && job.trim_reason === "manual_override") {
      trimStartSeconds = Number(job.trim_start_seconds);
      reason = "manual_override";
    } else {
      const analysis = await analyzeSampleMovie({ sourceUrl: work.sample_movie_url, jacketUrl: null });
      const calculated = calculateBijyoTrimStart(analysis, options.mode === "auto" ? 0 : job.trim_start_seconds);
      trimStartSeconds = calculated.trimStartSeconds;
      reason = calculated.reason;
    }
    const trimmed = await trimVideoForX({ sourceUrl: work.sample_movie_url, trimStartSeconds });
    if (trimmed.trimStartSeconds !== trimStartSeconds) throw new Error("トリム開始位置の検証に失敗しました。");
    const bytes = await readAndCleanupTrimmedVideo(trimmed);
    const saved = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ trim_start_seconds: trimStartSeconds, trim_reason: reason, trim_status: "ready", trim_failure_reason: null }).eq("account_handle", BIJYO_ACCOUNT).eq("id", job.id);
    if (saved.error) throw new Error(saved.error.message);
    return { bytes, filename: `bijyo1010-${work.id}-trim-${trimStartSeconds.toFixed(1)}s.mp4` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ trim_status: previousTrimStatus === "ready" ? "ready" : "trim_failed", trim_failure_reason: reason }).eq("id", job.id);
    if (reason.includes("開始秒")) throw new BijyoTrimValidationError(reason);
    throw new Error(reason);
  }
}

// Legacy scheduler entry point is intentionally disabled. Manual operations never call X API.
export async function runBijyoReservedSlot(...args: number[]) { void args; return { ok: true, skipped: true, status: "manual_only" as const }; }
