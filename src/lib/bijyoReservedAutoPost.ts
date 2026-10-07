import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";
import { analyzeSampleMovie } from "@/lib/xVideoAnalysis";
import { sourceKindFor } from "@/lib/xMediaAssets";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bijyoManualIdempotencyKey, bijyoReservedCandidateSince, buildBijyoMainText, buildBijyoReplyText, evaluateBijyoFutureOperation, filterRecentReleaseWorks, isBijyoReservedCandidate, recentReleaseDateRange, tokyoDate, type RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { calculateBijyoTrimStart } from "@/lib/bijyoTrim";
import { validateTrimStartSeconds } from "@/lib/xMediaAssets";

export { buildBijyoMainText, buildBijyoReplyText, tokyoDate } from "@/lib/bijyoReservedWorkflow";
export const BIJYO_ACCOUNT = "bijyo1010" as const;

type Work = { id: number; title: string; stage: string; created_at: string; release_date: string; image_url: string | null; sample_movie_url: string; product_id: string | null };
export type BijyoRecentReleasedWork = RecentReleaseWork;
export type BijyoJob = {
  id: number; work_id: number; kind: "auto" | "manual"; slot_date: string; slot_index: number | null; scheduled_at: string;
  status: string; trim_start_seconds: number; trim_status: string; trim_reason: string; trim_failure_reason: string | null;
  main_text: string; reply_text: string; x_post_id: string | null; posted_at: string | null; failure_reason: string | null; skip_reason: string | null; work?: Work | null;
};

type BijyoActionResult = { ok: boolean; error?: string; code?: string; state?: string; jobId?: number; existing?: boolean };

function conflictResult(state: string): BijyoActionResult {
  const labels: Record<string, string> = {
    posted: "この作品は投稿済みです。",
    manual_posted: "この作品は投稿済みです。",
    skipped: "この作品はスキップ済みです。",
    excluded: "この作品は対象外に設定されています。",
    pending: "この作品はすでに追加済みです。",
    trim_failed: "この作品はすでに追加済みです。動画を再生成できます。",
  };
  return { ok: false, error: labels[state] ?? "この作品はすでに選択済みです。", code: "already_selected", state };
}

const JOB_SELECT = "id,work_id,kind,slot_date,slot_index,scheduled_at,status,trim_start_seconds,trim_status,trim_reason,trim_failure_reason,main_text,reply_text,x_post_id,posted_at,failure_reason,skip_reason";
const ACTIVE_CANDIDATE_STATUSES = ["pending", "posted", "manual_posted", "skipped", "excluded", "trim_failed"];

const HISTORY_PAGE_SIZE = 20;

async function activeJobs(select = JOB_SELECT, options: { ascending?: boolean; limit?: number; offset?: number; kind?: "auto" | "manual"; statuses?: string[] } = {}) {
  let query = supabaseAdmin.from("bijyo_reserved_post_jobs").select(select).eq("account_handle", BIJYO_ACCOUNT).order("posted_at", { ascending: options.ascending ?? false, nullsFirst: false }).order("scheduled_at", { ascending: false });
  if (options.kind) query = query.eq("kind", options.kind);
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.limit !== undefined) query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
  const result = await query;
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

async function jobRefs() {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("work_id,kind,slot_date,status").eq("account_handle", BIJYO_ACCOUNT);
  return result.error ? { jobs: [] as Array<{ work_id: number; kind: string; slot_date: string; status: string }>, error: result.error.message } : { jobs: (result.data ?? []) as Array<{ work_id: number; kind: string; slot_date: string; status: string }>, error: null };
}

export async function getBijyoRecentReleasedWorks(jobs: BijyoJob[], now = new Date()) {
  const dateRange = recentReleaseDateRange(now);
  const result = await supabaseAdmin.from("works")
    .select("id,title,stage,created_at,release_date,image_url,sample_movie_url,product_id")
    .in("stage", ["RESERVED", "NEW"])
    .gte("release_date", dateRange.startDate)
    .lte("release_date", dateRange.endDate)
    .not("sample_movie_url", "is", null)
    .neq("sample_movie_url", "")
    .order("release_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (result.error) return { recentReleased: [] as BijyoRecentReleasedWork[], dateRange, error: result.error.message };
  const works = (result.data ?? []).filter((work) => sourceKindFor(work.sample_movie_url) === "official_sample") as RecentReleaseWork[];
  return { recentReleased: filterRecentReleaseWorks(works, jobs, dateRange), dateRange, error: null };
}

export async function getBijyoCandidates(page = 1) {
  const result = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,image_url,sample_movie_url,product_id").eq("stage", "RESERVED").gte("created_at", bijyoReservedCandidateSince()).not("sample_movie_url", "is", null).neq("sample_movie_url", "").not("release_date", "is", null).order("created_at", { ascending: true }).limit(1000);
  if (result.error) return { candidates: [] as Work[], candidateTotal: 0, candidateHasMore: false, candidatePage: page, error: result.error.message };
  const jobs = await jobRefs();
  if (jobs.error) return { candidates: [] as Work[], candidateTotal: 0, candidateHasMore: false, candidatePage: page, error: jobs.error };
  const usedWorkIds = new Set(jobs.jobs.filter((job) => ACTIVE_CANDIDATE_STATUSES.includes(job.status)).map((job) => job.work_id));
  const eligible = (result.data as Work[]).filter((work) => !usedWorkIds.has(work.id) && isBijyoReservedCandidate(work) && sourceKindFor(work.sample_movie_url) === "official_sample");
  const offset = Math.max(0, page - 1) * 20;
  return { candidates: eligible.slice(offset, offset + 20), candidateTotal: eligible.length, candidateHasMore: offset + 20 < eligible.length, candidatePage: page, error: null };
}

export async function getBijyoDashboard(historyPage = 1, candidatePage = 1) {
  const date = tokyoDate();
  const offset = Math.max(0, historyPage - 1) * HISTORY_PAGE_SIZE;
  try {
    const [jobsResult, candidatesResult, manualJobsResult] = await Promise.all([activeJobs(JOB_SELECT, { limit: HISTORY_PAGE_SIZE, offset }), getBijyoCandidates(candidatePage), activeJobs(JOB_SELECT, { kind: "manual", statuses: ["pending", "trim_failed"] })]);
    if (jobsResult.error) throw new Error(jobsResult.error);
    if (manualJobsResult.error) throw new Error(manualJobsResult.error);
    const jobs = jobsResult.jobs;
    const refs = await jobRefs();
    if (refs.error) throw new Error(refs.error);
    const recentResult = await getBijyoRecentReleasedWorks(refs.jobs as BijyoJob[]);
    return { ok: true, date, candidates: candidatesResult.candidates, candidateTotal: candidatesResult.candidateTotal, candidateHasMore: candidatesResult.candidateHasMore, candidatePage, manualJobs: manualJobsResult.jobs, recentReleased: recentResult.recentReleased, recentReleaseDateRange: recentResult.dateRange, jobs, historyPage, historyPageSize: HISTORY_PAGE_SIZE, historyHasMore: jobs.length === HISTORY_PAGE_SIZE, error: candidatesResult.error ?? recentResult.error };
  } catch (error) {
    return { ok: false, date, candidates: [] as Work[], candidateTotal: 0, candidateHasMore: false, candidatePage, manualJobs: [] as BijyoJob[], recentReleased: [] as BijyoRecentReleasedWork[], recentReleaseDateRange: recentReleaseDateRange(), jobs: [] as BijyoJob[], historyPage, historyPageSize: HISTORY_PAGE_SIZE, historyHasMore: false, error: error instanceof Error ? error.message : String(error) };
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
  if (!result.data) return { ok: false, error: "この枠は投稿済み、スキップ済み、または対象外です。", code: "invalid_transition" };
  return { ok: true };
}

export async function skipBijyoJob(jobId: number, reason = "手動スキップ") {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ status: "skipped", skip_reason: reason }).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).in("kind", ["auto", "manual"]).eq("status", "pending").select("id").maybeSingle();
  if (result.error) return { ok: false, error: result.error.message };
  if (!result.data) return { ok: false, error: "この枠はスキップ済み、投稿済み、または対象外です。", code: "invalid_transition" };
  return { ok: true };
}

export async function skipBijyoFutureWork(workId: number, reason = "発売予定一覧から手動スキップ") {
  const workResult = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").eq("id", workId).maybeSingle();
  const work = workResult.data as Work | null;
  const dateRange = recentReleaseDateRange();
  if (workResult.error || !work || !evaluateBijyoFutureOperation(work.stage, work.release_date, dateRange).eligible || !work.sample_movie_url || sourceKindFor(work.sample_movie_url) !== "official_sample") return { ok: false, error: "今日から1週間の対象作品ではありません。" };
  const existing = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id,status").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };
  if (existing.data) return existing.data.status === "skipped" ? { ok: true, existing: true } : conflictResult(String(existing.data.status));
  const inserted = await supabaseAdmin.from("bijyo_reserved_post_jobs").insert({ account_handle: BIJYO_ACCOUNT, work_id: work.id, kind: "auto", slot_date: work.release_date.slice(0, 10), slot_index: null, scheduled_at: new Date().toISOString(), idempotency_key: `bijyo1010:skip:${work.id}`, status: "skipped", main_text: buildBijyoMainText(work), reply_text: buildBijyoReplyText(work.id), skip_reason: reason }).select("id").single();
  if (!inserted.error) return { ok: true, existing: false };
  if (inserted.error.code !== "23505") return { ok: false, error: inserted.error.message };
  const raced = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id,status").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  return raced.data?.status === "skipped" ? { ok: true, existing: true } : raced.data ? conflictResult(String(raced.data.status)) : { ok: false, error: "同時更新を確認できませんでした。もう一度画面を更新してください。", code: "retry_required" };
}

export async function excludeBijyoJob(jobId: number) {
  const result = await supabaseAdmin.from("bijyo_reserved_post_jobs").update({ status: "excluded", failure_reason: null }).eq("account_handle", BIJYO_ACCOUNT).eq("id", jobId).not("status", "in", "(posted,manual_posted)");
  return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

export async function createBijyoManualJob(workId: number): Promise<BijyoActionResult> {
  const workResult = await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").eq("id", workId).single();
  const work = workResult.data as Work | null;
  if (workResult.error || !work || !isBijyoReservedCandidate(work) || !work.sample_movie_url || sourceKindFor(work.sample_movie_url) !== "official_sample") return { ok: false, error: "手動投稿には過去7日以内に登録されたRESERVED作品とFANZA/DMM公式サンプル動画が必要です。" };
  const existing = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id,status").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };
  if (existing.data) {
    const status = String(existing.data.status ?? "");
    if (["pending", "trim_failed"].includes(status)) return { ok: true, jobId: Number(existing.data.id), existing: true };
    return { ...conflictResult(status), jobId: Number(existing.data.id) };
  }
  const inserted = await supabaseAdmin.from("bijyo_reserved_post_jobs").insert({ account_handle: BIJYO_ACCOUNT, work_id: work.id, kind: "manual", slot_date: tokyoDate(), scheduled_at: new Date().toISOString(), idempotency_key: bijyoManualIdempotencyKey(work.id), status: "pending", main_text: buildBijyoMainText(work), reply_text: buildBijyoReplyText(work.id) }).select("id").single();
  if (!inserted.error) return { ok: true, jobId: Number(inserted.data.id), existing: false };
  if (inserted.error.code !== "23505") return { ok: false, error: inserted.error.message };
  const raced = await supabaseAdmin.from("bijyo_reserved_post_jobs").select("id,status").eq("account_handle", BIJYO_ACCOUNT).eq("work_id", work.id).maybeSingle();
  if (raced.error || !raced.data) return { ok: false, error: "同時更新を確認できませんでした。もう一度画面を更新してください。", code: "retry_required" };
  const status = String(raced.data.status ?? "");
  if (!["pending", "trim_failed"].includes(status)) return { ...conflictResult(status), jobId: Number(raced.data.id) };
  return { ok: true, jobId: Number(raced.data.id), existing: true };
}

// Scheduler compatibility entry point. The Bijyo admin page no longer creates daily candidates.
export async function runBijyoReservedSlot(...args: number[]) { void args; return { ok: true, skipped: true, status: "manual_only" as const }; }

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

